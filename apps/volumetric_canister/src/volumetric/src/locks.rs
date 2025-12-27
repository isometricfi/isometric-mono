use std::cell::RefCell;
use std::collections::BTreeSet;

use candid::Principal;

use crate::errors::VolumetricError;

thread_local! {
    static PENDING_ACCEPTS: RefCell<BTreeSet<Principal>> = RefCell::new(BTreeSet::new());
    static PENDING_WITHDRAWALS: RefCell<BTreeSet<Principal>> = RefCell::new(BTreeSet::new());
    static SETTLING_OPTIONS: RefCell<BTreeSet<u64>> = RefCell::new(BTreeSet::new());
}

#[derive(Debug)]
pub struct AcceptLock {
    principal: Principal,
}

impl AcceptLock {
    pub fn new(principal: Principal) -> Result<Self, VolumetricError> {
        PENDING_ACCEPTS.with(|pending| {
            let mut pending = pending.borrow_mut();
            if pending.contains(&principal) {
                return Err(VolumetricError::accept_in_progress());
            }
            pending.insert(principal);
            Ok(Self { principal })
        })
    }
}

impl Drop for AcceptLock {
    fn drop(&mut self) {
        PENDING_ACCEPTS.with(|pending| {
            pending.borrow_mut().remove(&self.principal);
        });
    }
}

#[derive(Debug)]
pub struct WithdrawalLock {
    principal: Principal,
}

impl WithdrawalLock {
    pub fn new(principal: Principal) -> Result<Self, VolumetricError> {
        PENDING_WITHDRAWALS.with(|pending| {
            let mut pending = pending.borrow_mut();
            if pending.contains(&principal) {
                return Err(VolumetricError::withdrawal_in_progress());
            }
            pending.insert(principal);
            Ok(Self { principal })
        })
    }
}

impl Drop for WithdrawalLock {
    fn drop(&mut self) {
        PENDING_WITHDRAWALS.with(|pending| {
            pending.borrow_mut().remove(&self.principal);
        });
    }
}

#[derive(Debug)]
pub struct SettlementLock {
    option_id: u64,
}

impl SettlementLock {
    pub fn new(option_id: u64) -> Result<Self, VolumetricError> {
        SETTLING_OPTIONS.with(|settling| {
            let mut settling = settling.borrow_mut();
            if settling.contains(&option_id) {
                return Err(VolumetricError::option_settling());
            }
            settling.insert(option_id);
            Ok(Self { option_id })
        })
    }
}

impl Drop for SettlementLock {
    fn drop(&mut self) {
        SETTLING_OPTIONS.with(|settling| {
            settling.borrow_mut().remove(&self.option_id);
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::errors::error_codes;

    #[test]
    fn test_accept_lock_allows_different_principals() {
        // given
        let principal_1 = Principal::anonymous();
        let principal_2 = Principal::management_canister();

        // when
        let lock_1 = AcceptLock::new(principal_1);
        let lock_2 = AcceptLock::new(principal_2);

        // then
        assert!(lock_1.is_ok());
        assert!(lock_2.is_ok());
    }

    #[test]
    fn test_accept_lock_blocks_same_principal() {
        // given
        let principal = Principal::anonymous();

        // when
        let lock_1 = AcceptLock::new(principal);
        let lock_2 = AcceptLock::new(principal);

        // then
        assert!(lock_1.is_ok());
        assert!(lock_2.is_err());
        let error = lock_2.unwrap_err();
        assert_eq!(error.code, error_codes::ACCEPT_IN_PROGRESS.code);
    }

    #[test]
    fn test_accept_lock_releases_on_drop() {
        // given
        let principal = Principal::anonymous();

        // when
        {
            let _lock = AcceptLock::new(principal);
            assert!(_lock.is_ok());
        }

        // then
        let lock_2 = AcceptLock::new(principal);
        assert!(lock_2.is_ok());
    }

    #[test]
    fn test_withdrawal_lock_allows_different_principals() {
        // given
        let principal_1 = Principal::anonymous();
        let principal_2 = Principal::management_canister();

        // when
        let lock_1 = WithdrawalLock::new(principal_1);
        let lock_2 = WithdrawalLock::new(principal_2);

        // then
        assert!(lock_1.is_ok());
        assert!(lock_2.is_ok());
    }

    #[test]
    fn test_withdrawal_lock_blocks_same_principal() {
        // given
        let principal = Principal::management_canister();

        // when
        let lock_1 = WithdrawalLock::new(principal);
        let lock_2 = WithdrawalLock::new(principal);

        // then
        assert!(lock_1.is_ok());
        assert!(lock_2.is_err());
        let error = lock_2.unwrap_err();
        assert_eq!(error.code, error_codes::WITHDRAWAL_IN_PROGRESS.code);
    }

    #[test]
    fn test_withdrawal_lock_releases_on_drop() {
        // given
        let principal = Principal::management_canister();

        // when
        {
            let _lock = WithdrawalLock::new(principal);
            assert!(_lock.is_ok());
        }

        // then
        let lock_2 = WithdrawalLock::new(principal);
        assert!(lock_2.is_ok());
    }

    #[test]
    fn test_settlement_lock_allows_different_options() {
        // given
        let option_id_1 = 1u64;
        let option_id_2 = 2u64;

        // when
        let lock_1 = SettlementLock::new(option_id_1);
        let lock_2 = SettlementLock::new(option_id_2);

        // then
        assert!(lock_1.is_ok());
        assert!(lock_2.is_ok());
    }

    #[test]
    fn test_settlement_lock_blocks_same_option() {
        // given
        let option_id = 42u64;

        // when
        let lock_1 = SettlementLock::new(option_id);
        let lock_2 = SettlementLock::new(option_id);

        // then
        assert!(lock_1.is_ok());
        assert!(lock_2.is_err());
        let error = lock_2.unwrap_err();
        assert_eq!(error.code, error_codes::OPTION_SETTLING.code);
    }

    #[test]
    fn test_settlement_lock_releases_on_drop() {
        // given
        let option_id = 42u64;

        // when
        {
            let _lock = SettlementLock::new(option_id);
            assert!(_lock.is_ok());
        }

        // then
        let lock_2 = SettlementLock::new(option_id);
        assert!(lock_2.is_ok());
    }

    #[test]
    fn test_accept_and_withdrawal_locks_are_independent() {
        // given
        let principal = Principal::anonymous();

        // when
        let accept_lock = AcceptLock::new(principal);
        let withdrawal_lock = WithdrawalLock::new(principal);

        // then
        assert!(accept_lock.is_ok());
        assert!(withdrawal_lock.is_ok());
    }
}
