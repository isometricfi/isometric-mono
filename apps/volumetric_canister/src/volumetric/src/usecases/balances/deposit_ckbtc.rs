use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;

use crate::auth::derive_subaccount;
use crate::errors::{error_codes, VolumetricError};
use crate::generated::ckbtc::{GetBtcAddressArg, UpdateBalanceArg, UtxoStatus};
use crate::locks::BalanceMutationLock;
use crate::storage::{
    add_available, emit_event, get_balance, set_balance, EventData, EventType, UserBalance,
};
use crate::{ic, ledger, minter};

pub struct DepositAddressResult {
    pub btc_address: String,
    pub account: Account,
}

fn get_user_subaccount(principal: Principal) -> [u8; 32] {
    derive_subaccount(principal)
}

fn get_user_account(principal: Principal) -> Account {
    let subaccount = get_user_subaccount(principal);
    Account {
        owner: ic::canister_self(),
        subaccount: Some(subaccount),
    }
}

pub async fn get_deposit_address(
    principal: Principal,
) -> Result<DepositAddressResult, VolumetricError> {
    let subaccount = get_user_subaccount(principal);

    let args = GetBtcAddressArg {
        owner: Some(ic::canister_self()),
        subaccount: Some(serde_bytes::ByteBuf::from(subaccount.to_vec())),
    };

    let btc_address = minter::get_btc_address(args).await?;

    let account = get_user_account(principal);
    Ok(DepositAddressResult {
        btc_address,
        account,
    })
}

pub async fn mint_ckbtc_from_utxos(
    principal: Principal,
) -> Result<Vec<UtxoStatus>, VolumetricError> {
    let subaccount = get_user_subaccount(principal);

    let args = UpdateBalanceArg {
        owner: Some(ic::canister_self()),
        subaccount: Some(serde_bytes::ByteBuf::from(subaccount.to_vec())),
    };

    let statuses = minter::update_balance(args).await?;
    let total_minted = calculate_total_minted_sats(&statuses)?;

    if total_minted > 0 {
        add_available(principal, total_minted);
        emit_event(
            principal,
            EventType::Deposit,
            EventData::Deposit {
                amount_sats: total_minted,
            },
        );
        logging::log!(
            "deposit minted principal={} amount_sats={}",
            principal,
            total_minted
        );
    }

    Ok(statuses)
}

fn calculate_total_minted_sats(statuses: &[UtxoStatus]) -> Result<u64, VolumetricError> {
    statuses
        .iter()
        .filter_map(|status| match status {
            UtxoStatus::Minted { minted_amount, .. } => Some(*minted_amount),
            _ => None,
        })
        .try_fold(0u64, |total_minted_sats, minted_amount_sats| {
            total_minted_sats
                .checked_add(minted_amount_sats)
                .ok_or_else(|| {
                    VolumetricError::from_def(
                        error_codes::INTERNAL_ERROR,
                        Some("minted amount total overflow"),
                        None,
                    )
                })
        })
}

pub async fn get_ledger_balance(principal: Principal) -> Result<Nat, VolumetricError> {
    let account = get_user_account(principal);
    ledger::icrc1_balance_of(account).await
}

pub async fn sync_balance_from_ledger(principal: Principal) -> Result<u64, VolumetricError> {
    let balance_before_sync = get_balance(&principal);
    if balance_before_sync.locked_as_writer > 0 {
        return Err(VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("Cannot sync balance while locked collateral exists"),
            None,
        ));
    }

    let _sync_balance_lock = BalanceMutationLock::new(principal)?;

    let account = get_user_account(principal);
    let balance = ledger::icrc1_balance_of(account).await?;

    let balance_u64: u64 = balance.0.try_into().map_err(|_| {
        VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("Balance too large to fit in u64"),
            None,
        )
    })?;

    let balance_after_sync = get_balance(&principal);
    if balance_after_sync.locked_as_writer > 0 {
        return Err(VolumetricError::from_def(
            error_codes::INTERNAL_ERROR,
            Some("Cannot sync balance while locked collateral exists"),
            None,
        ));
    }

    set_balance(
        principal,
        UserBalance {
            available: balance_u64,
            locked_as_writer: balance_after_sync.locked_as_writer,
        },
    );

    Ok(balance_u64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    use std::rc::Rc;

    use async_trait::async_trait;
    use icrc_ledger_types::icrc1::transfer::Memo;
    use icrc_ledger_types::icrc2::approve::ApproveArgs;

    use crate::errors::error_codes;
    use crate::generated::ckbtc::{Utxo, UtxoOutpoint, UtxoStatus};
    use crate::ic::IcRuntime;
    use crate::ledger::LedgerClient;
    use crate::locks::BalanceMutationLock;
    use crate::minter::MinterClient;
    use crate::storage::{get_balance, Config};

    const TEST_NOW_NS: u64 = 1_000_000_000_000;
    const TEST_CANISTER_ID: Principal = Principal::anonymous();
    const MINTED_AMOUNT_SATS: u64 = 500_000;
    const LEDGER_BALANCE_SATS: u64 = 1_000_000;
    const TEST_BTC_ADDRESS: &str = "tb1qtest";

    fn test_principal() -> Principal {
        Principal::from_slice(&[1; 29])
    }

    struct MockRuntime;

    impl IcRuntime for MockRuntime {
        fn time(&self) -> u64 {
            TEST_NOW_NS
        }
        fn canister_self(&self) -> Principal {
            TEST_CANISTER_ID
        }
        fn log(&self, _msg: &str) {}
    }

    struct MockLedger {
        balance: Nat,
    }

    #[async_trait(?Send)]
    impl LedgerClient for MockLedger {
        async fn icrc1_transfer(
            &self,
            _from_subaccount: Option<[u8; 32]>,
            _to: Account,
            _amount: u64,
            _created_at_time: u64,
            _memo: Option<Memo>,
        ) -> Result<u64, VolumetricError> {
            Ok(1)
        }
        async fn icrc1_balance_of(&self, _account: Account) -> Result<Nat, VolumetricError> {
            Ok(self.balance.clone())
        }
        async fn icrc2_approve(&self, _args: ApproveArgs) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc1_fee(&self) -> Result<u64, VolumetricError> {
            Ok(10)
        }
    }

    struct BalanceMutationLockProbeLedger {
        balance: Nat,
        principal: Principal,
        lock_was_acquired_during_sync: Rc<Cell<bool>>,
    }

    #[async_trait(?Send)]
    impl LedgerClient for BalanceMutationLockProbeLedger {
        async fn icrc1_transfer(
            &self,
            _from_subaccount: Option<[u8; 32]>,
            _to: Account,
            _amount: u64,
            _created_at_time: u64,
            _memo: Option<Memo>,
        ) -> Result<u64, VolumetricError> {
            Ok(1)
        }
        async fn icrc1_balance_of(&self, _account: Account) -> Result<Nat, VolumetricError> {
            if let Ok(balance_mutation_lock) = BalanceMutationLock::new(self.principal) {
                self.lock_was_acquired_during_sync.set(true);
                drop(balance_mutation_lock);
            }
            Ok(self.balance.clone())
        }
        async fn icrc2_approve(&self, _args: ApproveArgs) -> Result<Nat, VolumetricError> {
            Ok(Nat::from(0u64))
        }

        async fn icrc1_fee(&self) -> Result<u64, VolumetricError> {
            Ok(10)
        }
    }

    struct MockMinter {
        btc_address: String,
        minted_amounts: Vec<u64>,
    }

    #[async_trait(?Send)]
    impl MinterClient for MockMinter {
        async fn get_btc_address(
            &self,
            _args: GetBtcAddressArg,
        ) -> Result<String, VolumetricError> {
            Ok(self.btc_address.clone())
        }
        async fn update_balance(
            &self,
            _args: UpdateBalanceArg,
        ) -> Result<Vec<UtxoStatus>, VolumetricError> {
            let statuses = self
                .minted_amounts
                .iter()
                .enumerate()
                .map(|(i, &amount)| UtxoStatus::Minted {
                    minted_amount: amount,
                    block_index: i as u64,
                    utxo: Utxo {
                        height: 100,
                        value: amount,
                        outpoint: UtxoOutpoint {
                            txid: serde_bytes::ByteBuf::from(vec![i as u8; 32]),
                            vout: 0,
                        },
                    },
                })
                .collect();
            Ok(statuses)
        }
        async fn retrieve_btc_with_approval(
            &self,
            _args: crate::generated::ckbtc::RetrieveBtcWithApprovalArgs,
        ) -> Result<crate::generated::ckbtc::RetrieveBtcOk, VolumetricError> {
            unimplemented!()
        }
    }

    fn setup(ledger_balance: u64, minted_amounts: Vec<u64>) {
        ic::set_runtime(Box::new(MockRuntime));
        Config::set_deposit_amount_sats(50_000);
        ledger::set_ledger(Rc::new(MockLedger {
            balance: Nat::from(ledger_balance),
        }));
        minter::set_minter(Rc::new(MockMinter {
            btc_address: TEST_BTC_ADDRESS.to_string(),
            minted_amounts,
        }));
    }

    /// Given: a valid principal
    /// When: get_deposit_address is called
    /// Then: returns the BTC address from the minter
    #[tokio::test]
    async fn test_get_deposit_address_returns_btc_address() {
        // given
        setup(0, vec![]);
        let principal = test_principal();

        // when
        let result = get_deposit_address(principal).await;

        // then
        let deposit = result.unwrap();
        assert_eq!(deposit.btc_address, TEST_BTC_ADDRESS);
        assert_eq!(deposit.account.owner, TEST_CANISTER_ID);
        assert!(deposit.account.subaccount.is_some());
    }

    /// Given: minter returns a Minted UTXO
    /// When: mint_ckbtc_from_utxos is called
    /// Then: available balance is increased by minted amount
    #[tokio::test]
    async fn test_mint_ckbtc_adds_minted_amount_to_balance() {
        // given
        setup(0, vec![MINTED_AMOUNT_SATS]);
        let principal = test_principal();

        // when
        let result = mint_ckbtc_from_utxos(principal).await;

        // then
        assert!(result.is_ok());
        let balance = get_balance(&principal);
        assert_eq!(balance.available, MINTED_AMOUNT_SATS);
    }

    /// Given: minter returns no minted UTXOs
    /// When: mint_ckbtc_from_utxos is called
    /// Then: balance remains zero
    #[tokio::test]
    async fn test_mint_ckbtc_no_utxos_leaves_balance_unchanged() {
        // given
        setup(0, vec![]);
        let principal = test_principal();

        // when
        let result = mint_ckbtc_from_utxos(principal).await;

        // then
        assert!(result.is_ok());
        let balance = get_balance(&principal);
        assert_eq!(balance.available, 0);
    }

    /// Given: minter returns multiple minted UTXOs
    /// When: mint_ckbtc_from_utxos is called
    /// Then: all minted amounts are summed and added to balance
    #[tokio::test]
    async fn test_mint_ckbtc_sums_multiple_minted_utxos() {
        // given
        let second_mint: u64 = 250_000;
        setup(0, vec![MINTED_AMOUNT_SATS, second_mint]);
        let principal = test_principal();

        // when
        let result = mint_ckbtc_from_utxos(principal).await;

        // then
        assert!(result.is_ok());
        let expected_total = MINTED_AMOUNT_SATS + second_mint;
        let balance = get_balance(&principal);
        assert_eq!(balance.available, expected_total);
    }

    /// Given: minter returns minted UTXOs whose total overflows u64
    /// When: mint_ckbtc_from_utxos is called
    /// Then: returns an error instead of overflowing
    #[tokio::test]
    async fn test_mint_ckbtc_rejects_minted_total_overflow() {
        // given
        setup(0, vec![u64::MAX, 1]);
        let principal = test_principal();

        // when
        let result = mint_ckbtc_from_utxos(principal).await;

        // then
        assert!(result.is_err());
    }

    /// Given: configured minimum deposit amount exceeds newly minted total
    /// When: mint_ckbtc_from_utxos is called
    /// Then: minted funds are still credited
    #[tokio::test]
    async fn test_mint_ckbtc_allows_minted_total_below_configured_minimum() {
        // given
        const CONFIGURED_MINIMUM_DEPOSIT_SATS: u64 = 100_000;
        const MINTED_BELOW_MINIMUM_SATS: u64 = 10_000;
        setup(0, vec![MINTED_BELOW_MINIMUM_SATS]);
        Config::set_deposit_amount_sats(CONFIGURED_MINIMUM_DEPOSIT_SATS);
        let principal = test_principal();

        // when
        let result = mint_ckbtc_from_utxos(principal).await;

        // then
        assert!(result.is_ok());
        let balance = get_balance(&principal);
        assert_eq!(balance.available, MINTED_BELOW_MINIMUM_SATS);
    }

    /// Given: a ledger with a known balance
    /// When: sync_balance_from_ledger is called
    /// Then: the internal balance is set to the ledger balance
    #[tokio::test]
    async fn test_sync_balance_from_ledger_sets_internal_balance() {
        // given
        setup(LEDGER_BALANCE_SATS, vec![]);
        let principal = test_principal();
        add_available(principal, 100);

        // when
        let result = sync_balance_from_ledger(principal).await;

        // then
        assert_eq!(result.unwrap(), LEDGER_BALANCE_SATS);
        let balance = get_balance(&principal);
        assert_eq!(balance.available, LEDGER_BALANCE_SATS);
        assert_eq!(balance.locked_as_writer, 0);
    }

    /// Given: a user still has locked collateral
    /// When: sync_balance_from_ledger is called
    /// Then: the sync is rejected and the existing balance is preserved
    #[tokio::test]
    async fn test_sync_balance_from_ledger_rejects_nonzero_locked_balance() {
        // given
        setup(LEDGER_BALANCE_SATS, vec![]);
        let principal = test_principal();
        let existing_balance = UserBalance {
            available: 123_456,
            locked_as_writer: 654_321,
        };
        set_balance(principal, existing_balance.clone());

        // when
        let error = sync_balance_from_ledger(principal)
            .await
            .expect_err("sync should reject active locked collateral");

        // then
        assert_eq!(error.code, error_codes::INTERNAL_ERROR.code);

        let balance = get_balance(&principal);
        assert_eq!(balance.available, existing_balance.available);
        assert_eq!(balance.locked_as_writer, existing_balance.locked_as_writer);
    }

    /// Given: sync_balance_from_ledger is in progress
    /// When: a ledger callback attempts to acquire the lock used by accept path
    /// Then: the lock is not acquired during the sync window
    #[tokio::test]
    async fn test_sync_balance_from_ledger_blocks_accept_path_lock_during_await_window() {
        // given
        setup(LEDGER_BALANCE_SATS, vec![]);
        let principal = test_principal();
        let lock_was_acquired_during_sync = Rc::new(Cell::new(false));
        ledger::set_ledger(Rc::new(BalanceMutationLockProbeLedger {
            balance: Nat::from(LEDGER_BALANCE_SATS),
            principal,
            lock_was_acquired_during_sync: Rc::clone(&lock_was_acquired_during_sync),
        }));

        // when
        let result = sync_balance_from_ledger(principal).await;

        // then
        assert!(result.is_ok());
        assert!(
            !lock_was_acquired_during_sync.get(),
            "accept path lock should not be acquirable while sync is in progress"
        );
    }

    /// Given: sync_balance_from_ledger is in progress
    /// When: a ledger callback attempts to acquire the lock used by withdrawal path
    /// Then: the lock is not acquired during the sync window
    #[tokio::test]
    async fn test_sync_balance_from_ledger_blocks_withdraw_path_lock_during_await_window() {
        // given
        setup(LEDGER_BALANCE_SATS, vec![]);
        let principal = test_principal();
        let lock_was_acquired_during_sync = Rc::new(Cell::new(false));
        ledger::set_ledger(Rc::new(BalanceMutationLockProbeLedger {
            balance: Nat::from(LEDGER_BALANCE_SATS),
            principal,
            lock_was_acquired_during_sync: Rc::clone(&lock_was_acquired_during_sync),
        }));

        // when
        let result = sync_balance_from_ledger(principal).await;

        // then
        assert!(result.is_ok());
        assert!(
            !lock_was_acquired_during_sync.get(),
            "withdraw path lock should not be acquirable while sync is in progress"
        );
    }
}
