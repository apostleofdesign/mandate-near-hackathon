// Task Market: requesters post a bounty, agents bid, the winner is assigned,
// delivery is attested on-chain, and settlement pays the winning bid the moment
// the requester accepts. A coordinator agent (see `agents/`) can be both a
// requester here (sub-bounties a decomposed task to specialist agents) and a
// bidder on a larger task elsewhere — delegation composes.

use near_sdk::store::{LookupMap, Vector};
use near_sdk::{env, near, AccountId, NearToken, PanicOnDefault, Promise};

pub type TaskId = u64;

#[near(serializers = [borsh, json])]
#[derive(Clone, PartialEq, Debug)]
pub enum TaskStatus {
    Open,
    Assigned,
    Delivered,
    Settled,
    Cancelled,
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Bid {
    pub bidder: AccountId,
    pub price: NearToken,
    pub note: String,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Task {
    pub id: TaskId,
    pub requester: AccountId,
    pub spec: String,
    pub budget: NearToken,
    pub bids: Vec<Bid>,
    pub assignee: Option<AccountId>,
    pub status: TaskStatus,
    /// The actual work product, stored on-chain so the requester can read what
    /// they paid for — not just prove something was computed.
    pub delivery_content: Option<String>,
    /// sha256 of `delivery_content`, computed on-chain in `deliver` so the hash
    /// is guaranteed to match the content instead of being a caller-supplied
    /// claim.
    pub delivery_hash: Option<String>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct TaskMarket {
    pub tasks: LookupMap<TaskId, Task>,
    /// Every posted task id, in post order — lets `list_tasks` page through
    /// the board without an indexer. `LookupMap` alone has no iteration.
    pub task_ids: Vector<TaskId>,
    pub next_id: TaskId,
}

/// The pre-`delivery_content` shape of a Task, kept only so `migrate` can
/// read old entries back and rewrite them in the new shape.
#[near(serializers = [borsh])]
pub struct TaskV0 {
    pub id: TaskId,
    pub requester: AccountId,
    pub spec: String,
    pub budget: NearToken,
    pub bids: Vec<Bid>,
    pub assignee: Option<AccountId>,
    pub status: TaskStatus,
    pub delivery_hash: Option<String>,
}

#[near]
impl TaskMarket {
    /// One-time migration for tasks stored before `delivery_content` existed:
    /// re-reads each one under the old shape and rewrites it with
    /// `delivery_content: None`, leaving everything else untouched. The
    /// contract's own top-level fields didn't change shape, so this is a
    /// plain `#[private]` call, not an init — only the per-task entries
    /// inside the `LookupMap` needed rewriting.
    #[private]
    pub fn migrate(&mut self) {
        let old_tasks: LookupMap<TaskId, TaskV0> = LookupMap::new(b"t");
        let ids: Vec<TaskId> = self.task_ids.iter().cloned().collect();
        for id in ids {
            if let Some(old) = old_tasks.get(&id) {
                self.tasks.insert(
                    id,
                    Task {
                        id: old.id,
                        requester: old.requester.clone(),
                        spec: old.spec.clone(),
                        budget: old.budget,
                        bids: old.bids.clone(),
                        assignee: old.assignee.clone(),
                        status: old.status.clone(),
                        delivery_content: None,
                        delivery_hash: old.delivery_hash.clone(),
                    },
                );
            }
        }
    }

    #[init]
    pub fn new() -> Self {
        Self { tasks: LookupMap::new(b"t"), task_ids: Vector::new(b"i"), next_id: 0 }
    }

    /// Post a bounty. The attached deposit becomes the budget and sits in the
    /// contract until settlement or cancellation.
    #[payable]
    pub fn post_task(&mut self, spec: String) -> TaskId {
        let budget = env::attached_deposit();
        assert!(budget.as_yoctonear() > 0, "attach a budget");
        let id = self.next_id;
        self.next_id += 1;
        self.tasks.insert(
            id,
            Task {
                id,
                requester: env::predecessor_account_id(),
                spec,
                budget,
                bids: vec![],
                assignee: None,
                status: TaskStatus::Open,
                delivery_content: None,
                delivery_hash: None,
            },
        );
        self.task_ids.push(id);
        id
    }

    /// Page through the whole board, oldest-first by post order. Used by the
    /// marketplace UI and by worker agents polling for open work.
    pub fn list_tasks(&self, from_index: u64, limit: u64) -> Vec<Task> {
        self.task_ids
            .iter()
            .skip(from_index as usize)
            .take(limit as usize)
            .filter_map(|id| self.tasks.get(id).cloned())
            .collect()
    }

    pub fn bid(&mut self, task_id: TaskId, price: NearToken, note: String) {
        let mut task = self.tasks.get(&task_id).cloned().expect("no such task");
        assert_eq!(task.status, TaskStatus::Open, "task not open for bids");
        assert!(price.as_yoctonear() <= task.budget.as_yoctonear(), "bid exceeds budget");
        task.bids.push(Bid { bidder: env::predecessor_account_id(), price, note });
        self.tasks.insert(task_id, task);
    }

    pub fn assign(&mut self, task_id: TaskId, bidder: AccountId) {
        let mut task = self.tasks.get(&task_id).cloned().expect("no such task");
        assert_eq!(env::predecessor_account_id(), task.requester, "only the requester assigns");
        assert_eq!(task.status, TaskStatus::Open, "task not open");
        assert!(task.bids.iter().any(|b| b.bidder == bidder), "bidder did not bid on this task");
        task.assignee = Some(bidder);
        task.status = TaskStatus::Assigned;
        self.tasks.insert(task_id, task);
    }

    /// The assignee delivers the actual work product. Stored on-chain so the
    /// requester can read it directly — the hash is computed here too, from
    /// the real content, as a tamper-evident record rather than a claim the
    /// caller could mismatch.
    pub fn deliver(&mut self, task_id: TaskId, delivery_content: String) {
        let mut task = self.tasks.get(&task_id).cloned().expect("no such task");
        assert_eq!(Some(env::predecessor_account_id()), task.assignee, "only the assignee delivers");
        assert_eq!(task.status, TaskStatus::Assigned, "task not assigned");
        task.delivery_hash = Some(to_hex(&env::sha256(delivery_content.as_bytes())));
        task.delivery_content = Some(delivery_content);
        task.status = TaskStatus::Delivered;
        self.tasks.insert(task_id, task);
    }

    /// Requester accepts delivery: the winning bid pays out to the assignee, and
    /// any unspent remainder of the budget (budget minus the winning bid) returns
    /// to the requester in the same transaction — nothing is left stranded.
    ///
    /// Returns nothing rather than a `Promise`: NEAR's protocol rejects a
    /// function that returns a joined promise (`a.and(b)`) directly — "Returning
    /// joint promise is currently prohibited." Each `Promise::new(...).transfer(...)`
    /// call schedules its action the moment it's constructed regardless of
    /// whether the value is returned, so both transfers still happen; this
    /// function just doesn't try to hand the joined promise back as its result.
    pub fn accept_and_settle(&mut self, task_id: TaskId) {
        let mut task = self.tasks.get(&task_id).cloned().expect("no such task");
        assert_eq!(env::predecessor_account_id(), task.requester, "only the requester settles");
        assert_eq!(task.status, TaskStatus::Delivered, "nothing delivered yet");
        let winning_bid = task
            .bids
            .iter()
            .find(|b| Some(&b.bidder) == task.assignee.as_ref())
            .expect("missing winning bid")
            .clone();
        let assignee = task.assignee.clone().unwrap();
        let requester = task.requester.clone();
        let remainder = task.budget.as_yoctonear().saturating_sub(winning_bid.price.as_yoctonear());
        task.status = TaskStatus::Settled;
        self.tasks.insert(task_id, task);
        let _ = Promise::new(assignee).transfer(winning_bid.price);
        if remainder > 0 {
            let _ = Promise::new(requester).transfer(NearToken::from_yoctonear(remainder));
        }
    }

    /// Cancel a task that hasn't been assigned yet and refund the full budget to
    /// the requester. Once a bid is assigned the job is underway, so cancellation
    /// stops there — resolving what a working assignee is owed is a separate
    /// decision the requester makes through `accept_and_settle`, not `cancel_task`.
    pub fn cancel_task(&mut self, task_id: TaskId) -> Promise {
        let mut task = self.tasks.get(&task_id).cloned().expect("no such task");
        assert_eq!(env::predecessor_account_id(), task.requester, "only the requester cancels");
        assert_eq!(task.status, TaskStatus::Open, "can only cancel a task with no assignee yet");
        let requester = task.requester.clone();
        let budget = task.budget;
        task.status = TaskStatus::Cancelled;
        self.tasks.insert(task_id, task);
        Promise::new(requester).transfer(budget)
    }

    pub fn get_task(&self, task_id: TaskId) -> Option<Task> {
        self.tasks.get(&task_id).cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn ctx(predecessor: AccountId, deposit: NearToken) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id(predecessor).attached_deposit(deposit);
        builder
    }

    fn market() -> TaskMarket {
        testing_env!(ctx(accounts(0), NearToken::from_yoctonear(0)).build());
        TaskMarket::new()
    }

    fn post(market: &mut TaskMarket, requester: AccountId, budget: NearToken) -> TaskId {
        testing_env!(ctx(requester, budget).build());
        market.post_task("a task".to_string())
    }

    #[test]
    fn post_and_get_task() {
        let mut market = market();
        let id = post(&mut market, accounts(0), NearToken::from_near(1));
        let task = market.get_task(id).unwrap();
        assert_eq!(task.requester, accounts(0));
        assert_eq!(task.budget, NearToken::from_near(1));
        assert_eq!(task.status, TaskStatus::Open);
    }

    #[test]
    #[should_panic(expected = "bid exceeds budget")]
    fn bid_over_budget_panics() {
        let mut market = market();
        let id = post(&mut market, accounts(0), NearToken::from_millinear(500));
        testing_env!(ctx(accounts(1), NearToken::from_yoctonear(0)).build());
        market.bid(id, NearToken::from_near(1), "too much".to_string());
    }

    #[test]
    #[should_panic(expected = "bidder did not bid on this task")]
    fn assign_requires_an_existing_bid() {
        let mut market = market();
        let id = post(&mut market, accounts(0), NearToken::from_near(1));
        testing_env!(ctx(accounts(0), NearToken::from_yoctonear(0)).build());
        market.assign(id, accounts(1));
    }

    #[test]
    #[should_panic(expected = "only the requester assigns")]
    fn assign_by_non_requester_panics() {
        let mut market = market();
        let id = post(&mut market, accounts(0), NearToken::from_near(1));
        testing_env!(ctx(accounts(1), NearToken::from_yoctonear(0)).build());
        market.bid(id, NearToken::from_millinear(500), "bid".to_string());
        testing_env!(ctx(accounts(1) /* not the requester */, NearToken::from_yoctonear(0)).build());
        market.assign(id, accounts(1));
    }

    #[test]
    #[should_panic(expected = "only the assignee delivers")]
    fn deliver_by_non_assignee_panics() {
        let mut market = market();
        let id = post(&mut market, accounts(0), NearToken::from_near(1));
        testing_env!(ctx(accounts(1), NearToken::from_yoctonear(0)).build());
        market.bid(id, NearToken::from_millinear(500), "bid".to_string());
        testing_env!(ctx(accounts(0), NearToken::from_yoctonear(0)).build());
        market.assign(id, accounts(1));
        testing_env!(ctx(accounts(2) /* not the assignee */, NearToken::from_yoctonear(0)).build());
        market.deliver(id, "hash".to_string());
    }

    #[test]
    fn cancel_open_task_refunds_and_marks_cancelled() {
        let mut market = market();
        let id = post(&mut market, accounts(0), NearToken::from_near(1));
        testing_env!(ctx(accounts(0), NearToken::from_yoctonear(0)).build());
        let _ = market.cancel_task(id);
        assert_eq!(market.get_task(id).unwrap().status, TaskStatus::Cancelled);
    }

    #[test]
    #[should_panic(expected = "only the requester cancels")]
    fn cancel_by_non_requester_panics() {
        let mut market = market();
        let id = post(&mut market, accounts(0), NearToken::from_near(1));
        testing_env!(ctx(accounts(1), NearToken::from_yoctonear(0)).build());
        let _ = market.cancel_task(id);
    }

    #[test]
    #[should_panic(expected = "can only cancel a task with no assignee yet")]
    fn cancel_assigned_task_panics() {
        let mut market = market();
        let id = post(&mut market, accounts(0), NearToken::from_near(1));
        testing_env!(ctx(accounts(1), NearToken::from_yoctonear(0)).build());
        market.bid(id, NearToken::from_millinear(500), "bid".to_string());
        testing_env!(ctx(accounts(0), NearToken::from_yoctonear(0)).build());
        market.assign(id, accounts(1));
        let _ = market.cancel_task(id);
    }

    #[test]
    fn accept_and_settle_moves_task_to_settled() {
        let mut market = market();
        let id = post(&mut market, accounts(0), NearToken::from_near(1));
        testing_env!(ctx(accounts(1), NearToken::from_yoctonear(0)).build());
        market.bid(id, NearToken::from_millinear(600), "bid".to_string());
        testing_env!(ctx(accounts(0), NearToken::from_yoctonear(0)).build());
        market.assign(id, accounts(1));
        testing_env!(ctx(accounts(1), NearToken::from_yoctonear(0)).build());
        market.deliver(id, "hash".to_string());
        testing_env!(ctx(accounts(0), NearToken::from_yoctonear(0)).build());
        market.accept_and_settle(id);
        assert_eq!(market.get_task(id).unwrap().status, TaskStatus::Settled);
    }

    #[test]
    fn deliver_stores_content_and_the_matching_sha256() {
        let mut market = market();
        let id = post(&mut market, accounts(0), NearToken::from_near(1));
        testing_env!(ctx(accounts(1), NearToken::from_yoctonear(0)).build());
        market.bid(id, NearToken::from_millinear(500), "bid".to_string());
        testing_env!(ctx(accounts(0), NearToken::from_yoctonear(0)).build());
        market.assign(id, accounts(1));
        testing_env!(ctx(accounts(1), NearToken::from_yoctonear(0)).build());
        market.deliver(id, "the real work product".to_string());
        let task = market.get_task(id).unwrap();
        assert_eq!(task.delivery_content.as_deref(), Some("the real work product"));
        assert_eq!(
            task.delivery_hash.as_deref(),
            Some(to_hex(&near_sdk::env::sha256(b"the real work product")).as_str())
        );
    }
}
