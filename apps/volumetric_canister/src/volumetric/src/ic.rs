/// Wraps ICP runtime calls behind a swappable implementation.
///
/// - Production: calls go through [`IcProd`] → `ic_cdk`.
/// - Tests: call [`set_runtime`] to swap in a mock. `set_runtime` is
///   `#[cfg(test)]` so it doesn't exist in the production binary.
use std::cell::RefCell;

use candid::Principal;

pub trait IcRuntime {
    fn time(&self) -> u64;
    fn canister_self(&self) -> Principal;
    fn log(&self, message: &str);
}

/// Production implementation — delegates to `ic_cdk` APIs.
struct IcProd;

impl IcRuntime for IcProd {
    fn time(&self) -> u64 {
        ic_cdk::api::time()
    }

    fn canister_self(&self) -> Principal {
        ic_cdk::api::canister_self()
    }

    fn log(&self, message: &str) {
        logging::log!("{}", message);
    }
}

thread_local! {
    static RUNTIME: RefCell<Box<dyn IcRuntime>> = RefCell::new(Box::new(IcProd));
}

pub fn time() -> u64 {
    RUNTIME.with_borrow(|r| r.time())
}

pub fn canister_self() -> Principal {
    RUNTIME.with_borrow(|r| r.canister_self())
}

pub fn log(message: &str) {
    RUNTIME.with_borrow(|r| r.log(message));
}

/// Swap the runtime implementation (test-only, compiled out in production).
#[cfg(test)]
pub fn set_runtime(runtime: Box<dyn IcRuntime>) {
    RUNTIME.with(|r| *r.borrow_mut() = runtime);
}
