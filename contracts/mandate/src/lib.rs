// Mandate: a revocable, policy-bounded spending permission for an AI agent.
//
// An agent never holds an unrestricted key. It holds a Mandate: a daily cap,
// an optional contract allow-list, and an optional expiry. Every spend goes
// through `authorize_spend`, which enforces the policy before the caller is
// allowed to proceed with a transfer or cross-contract call. A `guard`
// account (the anomaly watcher in `agents/`) can force-revoke a mandate
// independently of its issuer the moment spend velocity looks wrong.

use near_sdk::store::{LookupMap, Vector};
use near_sdk::{env, near, AccountId, NearToken, PanicOnDefault};

pub type MandateId = u64;

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Mandate {
    pub id: MandateId,
    /// The agent this mandate authorizes to spend.
    pub owner: AccountId,
    /// Who funded/created this mandate; the only account (besides `guard`) that can revoke it.
    pub issuer: AccountId,
    pub daily_cap: NearToken,
    pub spent_today: NearToken,
    /// Day bucket, in whole days since epoch, used to roll `spent_today` over.
    pub day_index: u64,
    /// Empty = any target allowed. Non-empty = only these contracts.
    pub allowed_contracts: Vec<AccountId>,
    /// Nanosecond timestamp; 0 = never expires.
    pub expires_at: u64,
    pub revoked: bool,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct MandateRegistry {
    pub mandates: LookupMap<MandateId, Mandate>,
    /// Every issued mandate id, in issue order — lets `list_mandates` page
    /// through them without an indexer. `LookupMap` alone has no iteration.
    pub mandate_ids: Vector<MandateId>,
    pub next_id: MandateId,
    /// Account allowed to force-revoke any mandate on anomaly (the Guard watcher).
    pub guard: AccountId,
}

#[near]
impl MandateRegistry {
    #[init]
    pub fn new(guard: AccountId) -> Self {
        Self { mandates: LookupMap::new(b"m"), mandate_ids: Vector::new(b"i"), next_id: 0, guard }
    }

    /// Issue a new mandate to `owner`. Called by whoever is granting the agent its budget
    /// (a human, or a coordinator agent delegating a slice of its own mandate).
    pub fn issue_mandate(
        &mut self,
        owner: AccountId,
        daily_cap: NearToken,
        allowed_contracts: Vec<AccountId>,
        expires_at: u64,
    ) -> MandateId {
        let id = self.next_id;
        self.next_id += 1;
        let mandate = Mandate {
            id,
            owner,
            issuer: env::predecessor_account_id(),
            daily_cap,
            spent_today: NearToken::from_yoctonear(0),
            day_index: Self::day_index(),
            allowed_contracts,
            expires_at,
            revoked: false,
        };
        self.mandates.insert(id, mandate);
        self.mandate_ids.push(id);
        id
    }

    /// Page through every mandate ever issued, newest-covering-oldest ids in
    /// issue order. Used by the Guard watcher (which has no other way to
    /// enumerate live mandates) and by the dashboard.
    pub fn list_mandates(&self, from_index: u64, limit: u64) -> Vec<Mandate> {
        self.mandate_ids
            .iter()
            .skip(from_index as usize)
            .take(limit as usize)
            .filter_map(|id| self.mandates.get(id).cloned())
            .collect()
    }

    /// Check and record a spend against a mandate's policy. Panics (aborting the transaction)
    /// if the mandate is revoked, expired, over its daily cap, or the target isn't allow-listed.
    /// A worker contract calls this before acting on the agent's behalf.
    pub fn authorize_spend(&mut self, id: MandateId, target: AccountId, amount: NearToken) -> bool {
        let mut mandate = self.mandates.get(&id).cloned().expect("no such mandate");
        assert_eq!(env::predecessor_account_id(), mandate.owner, "only the mandate owner can spend");
        assert!(!mandate.revoked, "mandate revoked");
        if mandate.expires_at != 0 {
            assert!(env::block_timestamp() < mandate.expires_at, "mandate expired");
        }
        assert!(
            mandate.allowed_contracts.is_empty() || mandate.allowed_contracts.contains(&target),
            "target not allow-listed for this mandate"
        );

        let today = Self::day_index();
        if today != mandate.day_index {
            mandate.day_index = today;
            mandate.spent_today = NearToken::from_yoctonear(0);
        }

        let new_spent = NearToken::from_yoctonear(mandate.spent_today.as_yoctonear() + amount.as_yoctonear());
        assert!(
            new_spent.as_yoctonear() <= mandate.daily_cap.as_yoctonear(),
            "daily cap exceeded"
        );
        mandate.spent_today = new_spent;
        self.mandates.insert(id, mandate);
        true
    }

    /// Revoke a mandate. Only its issuer or the registered `guard` can do this —
    /// the Guard watcher calls this the moment it flags anomalous spend velocity.
    pub fn revoke(&mut self, id: MandateId) {
        let mut mandate = self.mandates.get(&id).cloned().expect("no such mandate");
        let caller = env::predecessor_account_id();
        assert!(caller == mandate.issuer || caller == self.guard, "not authorized to revoke");
        mandate.revoked = true;
        self.mandates.insert(id, mandate);
    }

    pub fn get_mandate(&self, id: MandateId) -> Option<Mandate> {
        self.mandates.get(&id).cloned()
    }

    fn day_index() -> u64 {
        env::block_timestamp() / 86_400_000_000_000
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn ctx(predecessor: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id(predecessor);
        builder
    }

    fn registry() -> MandateRegistry {
        testing_env!(ctx(accounts(0)).build());
        MandateRegistry::new(accounts(1) /* guard */)
    }

    #[test]
    fn issue_and_get_mandate() {
        let mut registry = registry();
        testing_env!(ctx(accounts(0)).build());
        let id = registry.issue_mandate(accounts(2), NearToken::from_near(1), vec![], 0);
        let mandate = registry.get_mandate(id).unwrap();
        assert_eq!(mandate.owner, accounts(2));
        assert_eq!(mandate.issuer, accounts(0));
        assert!(!mandate.revoked);
        assert_eq!(mandate.spent_today, NearToken::from_yoctonear(0));
    }

    #[test]
    fn authorize_spend_within_cap_succeeds_and_records_spend() {
        let mut registry = registry();
        testing_env!(ctx(accounts(0)).build());
        let id = registry.issue_mandate(accounts(2), NearToken::from_near(1), vec![], 0);
        testing_env!(ctx(accounts(2)).build());
        assert!(registry.authorize_spend(id, accounts(3), NearToken::from_millinear(400)));
        let mandate = registry.get_mandate(id).unwrap();
        assert_eq!(mandate.spent_today, NearToken::from_millinear(400));
    }

    #[test]
    #[should_panic(expected = "daily cap exceeded")]
    fn authorize_spend_over_cap_panics() {
        let mut registry = registry();
        testing_env!(ctx(accounts(0)).build());
        let id = registry.issue_mandate(accounts(2), NearToken::from_near(1), vec![], 0);
        testing_env!(ctx(accounts(2)).build());
        registry.authorize_spend(id, accounts(3), NearToken::from_near(2));
    }

    #[test]
    #[should_panic(expected = "only the mandate owner can spend")]
    fn authorize_spend_by_non_owner_panics() {
        let mut registry = registry();
        testing_env!(ctx(accounts(0)).build());
        let id = registry.issue_mandate(accounts(2), NearToken::from_near(1), vec![], 0);
        testing_env!(ctx(accounts(3)).build());
        registry.authorize_spend(id, accounts(3), NearToken::from_millinear(100));
    }

    #[test]
    #[should_panic(expected = "target not allow-listed")]
    fn authorize_spend_outside_allow_list_panics() {
        let mut registry = registry();
        testing_env!(ctx(accounts(0)).build());
        let id = registry.issue_mandate(accounts(2), NearToken::from_near(1), vec![accounts(4)], 0);
        testing_env!(ctx(accounts(2)).build());
        registry.authorize_spend(id, accounts(3), NearToken::from_millinear(100));
    }

    #[test]
    fn revoke_by_issuer_succeeds() {
        let mut registry = registry();
        testing_env!(ctx(accounts(0)).build());
        let id = registry.issue_mandate(accounts(2), NearToken::from_near(1), vec![], 0);
        registry.revoke(id);
        assert!(registry.get_mandate(id).unwrap().revoked);
    }

    #[test]
    fn revoke_by_guard_succeeds_independent_of_issuer() {
        let mut registry = registry();
        testing_env!(ctx(accounts(0)).build());
        let id = registry.issue_mandate(accounts(2), NearToken::from_near(1), vec![], 0);
        testing_env!(ctx(accounts(1) /* guard */).build());
        registry.revoke(id);
        assert!(registry.get_mandate(id).unwrap().revoked);
    }

    #[test]
    #[should_panic(expected = "not authorized to revoke")]
    fn revoke_by_stranger_panics() {
        let mut registry = registry();
        testing_env!(ctx(accounts(0)).build());
        let id = registry.issue_mandate(accounts(2), NearToken::from_near(1), vec![], 0);
        testing_env!(ctx(accounts(3) /* neither issuer nor guard */).build());
        registry.revoke(id);
    }

    #[test]
    #[should_panic(expected = "mandate revoked")]
    fn authorize_spend_after_revoke_panics() {
        let mut registry = registry();
        testing_env!(ctx(accounts(0)).build());
        let id = registry.issue_mandate(accounts(2), NearToken::from_near(1), vec![], 0);
        registry.revoke(id);
        testing_env!(ctx(accounts(2)).build());
        registry.authorize_spend(id, accounts(3), NearToken::from_millinear(1));
    }
}
