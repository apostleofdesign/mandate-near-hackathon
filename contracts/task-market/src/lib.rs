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

#[near]
impl TaskMarket {
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

    /// The assignee attests delivery with a content hash (e.g. of the work product,
    /// a report, or a commit). What the hash commits to is a README convention,
    /// not something this contract interprets.
    pub fn deliver(&mut self, task_id: TaskId, delivery_hash: String) {
        let mut task = self.tasks.get(&task_id).cloned().expect("no such task");
        assert_eq!(Some(env::predecessor_account_id()), task.assignee, "only the assignee delivers");
        assert_eq!(task.status, TaskStatus::Assigned, "task not assigned");
        task.delivery_hash = Some(delivery_hash);
        task.status = TaskStatus::Delivered;
        self.tasks.insert(task_id, task);
    }

    /// Requester accepts delivery; the winning bid amount pays out to the assignee
    /// immediately, any remainder of the budget stays claimable by the requester
    /// via `cancel` logic in a later revision.
    pub fn accept_and_settle(&mut self, task_id: TaskId) -> Promise {
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
        task.status = TaskStatus::Settled;
        self.tasks.insert(task_id, task);
        Promise::new(assignee).transfer(winning_bid.price)
    }

    pub fn get_task(&self, task_id: TaskId) -> Option<Task> {
        self.tasks.get(&task_id).cloned()
    }
}
