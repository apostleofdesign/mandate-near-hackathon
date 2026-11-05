// Checkout: the on-chain settlement record behind the universal checkout widget.
//
// This contract doesn't know or care what chain or asset the customer started
// with — that's NEAR Intents' job, handled by the checkout widget before it
// ever calls `pay_order` (see app/lib/intents.ts and app/components/CheckoutWidget.tsx).
// By the time `pay_order` runs, the payer already holds NEAR and is paying it
// directly. This contract just needs to answer one question reliably: did
// this order get paid, by whom, for how much.
//
// It does not call into the Mandate contract directly — same decoupling as
// `task-market`. A payer acting under a Mandate calls
// `mandate.authorize_spend(mandate_id, checkout_contract_id, amount)` first;
// if that panics, nothing here ever runs. The checkout contract stays usable
// by any payer, mandated or not.

use near_sdk::store::LookupMap;
use near_sdk::{env, near, AccountId, NearToken, PanicOnDefault, Promise};

pub type OrderId = u64;

#[near(serializers = [borsh, json])]
#[derive(Clone, PartialEq)]
pub enum OrderStatus {
    Pending,
    Paid,
    Cancelled,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Merchant {
    pub account: AccountId,
    pub label: String,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Order {
    pub id: OrderId,
    pub merchant: AccountId,
    pub amount: NearToken,
    /// Free-form reference the storefront can match back to its own cart/session.
    pub memo: String,
    pub status: OrderStatus,
    pub payer: Option<AccountId>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Checkout {
    pub merchants: LookupMap<AccountId, Merchant>,
    pub orders: LookupMap<OrderId, Order>,
    pub next_id: OrderId,
}

#[near]
impl Checkout {
    #[init]
    pub fn new() -> Self {
        Self { merchants: LookupMap::new(b"c"), orders: LookupMap::new(b"o"), next_id: 0 }
    }

    /// A merchant registers itself before accepting orders. Self-service: the
    /// caller is the merchant account being registered.
    pub fn register_merchant(&mut self, label: String) {
        let account = env::predecessor_account_id();
        self.merchants.insert(account.clone(), Merchant { account, label });
    }

    /// The storefront backend creates an order once a customer reaches checkout.
    /// `amount` is denominated in NEAR — the widget has already quoted and will
    /// settle the customer's original asset/chain into this amount via Intents
    /// before `pay_order` is ever called.
    pub fn create_order(&mut self, merchant: AccountId, amount: NearToken, memo: String) -> OrderId {
        assert!(self.merchants.get(&merchant).is_some(), "merchant not registered");
        assert!(amount.as_yoctonear() > 0, "amount must be positive");
        let id = self.next_id;
        self.next_id += 1;
        self.orders.insert(
            id,
            Order { id, merchant, amount, memo, status: OrderStatus::Pending, payer: None },
        );
        id
    }

    /// Pay a pending order. The attached deposit must exactly match the order
    /// amount — if the payer is acting under a Mandate, they must have already
    /// called `authorize_spend` against it in a prior call; this contract has
    /// no opinion on that and will accept payment from anyone.
    #[payable]
    pub fn pay_order(&mut self, order_id: OrderId) -> Promise {
        let mut order = self.orders.get(&order_id).cloned().expect("no such order");
        assert_eq!(order.status, OrderStatus::Pending, "order not pending");
        let deposit = env::attached_deposit();
        assert_eq!(deposit.as_yoctonear(), order.amount.as_yoctonear(), "deposit must match order amount exactly");

        order.status = OrderStatus::Paid;
        order.payer = Some(env::predecessor_account_id());
        self.orders.insert(order_id, order.clone());

        Promise::new(order.merchant).transfer(deposit)
    }

    pub fn cancel_order(&mut self, order_id: OrderId) {
        let mut order = self.orders.get(&order_id).cloned().expect("no such order");
        assert_eq!(order.status, OrderStatus::Pending, "only a pending order can be cancelled");
        assert_eq!(env::predecessor_account_id(), order.merchant, "only the merchant can cancel");
        order.status = OrderStatus::Cancelled;
        self.orders.insert(order_id, order);
    }

    pub fn get_order(&self, order_id: OrderId) -> Option<Order> {
        self.orders.get(&order_id).cloned()
    }

    pub fn get_merchant(&self, account: AccountId) -> Option<Merchant> {
        self.merchants.get(&account).cloned()
    }
}
