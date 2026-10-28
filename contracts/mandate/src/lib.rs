// Mandate: a revocable, policy-bounded spending permission for an AI agent.
//
// An agent never holds an unrestricted key. It holds a Mandate: a daily cap,
// an optional contract allow-list, and an optional expiry. Every spend goes
// through `authorize_spend`, which enforces the policy before the caller is
// allowed to proceed with a transfer or cross-contract call. A `guard`
// account (the anomaly watcher in `agents/`) can force-revoke a mandate
// independently of its issuer the moment spend velocity looks wrong.

use near_sdk::store::LookupMap;
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
    pub next_id: MandateId,
    /// Account allowed to force-revoke any mandate on anomaly (the Guard watcher).
    pub guard: AccountId,
}

#[near]
impl MandateRegistry {
    #[init]
    pub fn new(guard: AccountId) -> Self {
        Self { mandates: LookupMap::new(b"m"), next_id: 0, guard }
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
        id
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
