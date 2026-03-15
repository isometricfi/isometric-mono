use crate::storage::accepts::{AcceptPhase, ACCEPT_JOURNAL};
use crate::storage::accounts::{NONCES, PROFILES, WALLET_REGISTRY};
use crate::storage::balances::BALANCES;
use crate::storage::events::EVENTS;
use crate::storage::options::{OfferStatus, ACTIVE_OPTIONS, OFFERS};
use crate::storage::settlements::{SettlementPhase, SETTLEMENT_JOURNAL};
use crate::storage::withdrawals::{WithdrawalPhase, WITHDRAWAL_JOURNAL};
use crate::storage::WHITELIST;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct ObservabilityStorageCounts {
    pub profiles_total: u64,
    pub wallet_registrations_total: u64,
    pub signature_nonces_total: u64,
    pub whitelist_entries_total: u64,
    pub balances_total: u64,
    pub offers_total: u64,
    pub open_offers_total: u64,
    pub active_options_total: u64,
    pub events_total: u64,
    pub pending_withdrawals_total: u64,
    pub failed_withdrawals_total: u64,
    pub pending_accepts_total: u64,
    pub failed_accepts_total: u64,
    pub pending_settlements_total: u64,
    pub failed_settlements_total: u64,
}

pub(crate) fn collect_observability_storage_counts() -> ObservabilityStorageCounts {
    ObservabilityStorageCounts {
        profiles_total: PROFILES.with_borrow(|profiles| profiles.len()),
        wallet_registrations_total: WALLET_REGISTRY
            .with_borrow(|wallet_registry| wallet_registry.len()),
        signature_nonces_total: NONCES.with_borrow(|nonces| nonces.len()),
        whitelist_entries_total: WHITELIST.with_borrow(|whitelist| whitelist.len()),
        balances_total: BALANCES.with_borrow(|balances| balances.len()),
        offers_total: OFFERS.with_borrow(|offers| offers.len()),
        open_offers_total: OFFERS.with_borrow(|offers| {
            offers
                .iter()
                .filter(|entry| {
                    matches!(
                        entry.value().0.status,
                        OfferStatus::Open | OfferStatus::PartiallyFilled
                    )
                })
                .count() as u64
        }),
        active_options_total: ACTIVE_OPTIONS.with_borrow(|active_options| active_options.len()),
        events_total: EVENTS.with_borrow(|events| events.len()),
        pending_withdrawals_total: WITHDRAWAL_JOURNAL.with_borrow(|journal| {
            journal
                .iter()
                .filter(|entry| {
                    !matches!(
                        entry.value().phase,
                        WithdrawalPhase::Completed { .. } | WithdrawalPhase::Failed { .. }
                    )
                })
                .count() as u64
        }),
        failed_withdrawals_total: WITHDRAWAL_JOURNAL.with_borrow(|journal| {
            journal
                .iter()
                .filter(|entry| matches!(entry.value().phase, WithdrawalPhase::Failed { .. }))
                .count() as u64
        }),
        pending_accepts_total: ACCEPT_JOURNAL.with_borrow(|journal| {
            journal
                .iter()
                .filter(|entry| {
                    !matches!(
                        entry.value().phase,
                        AcceptPhase::Completed | AcceptPhase::Failed { .. }
                    )
                })
                .count() as u64
        }),
        failed_accepts_total: ACCEPT_JOURNAL.with_borrow(|journal| {
            journal
                .iter()
                .filter(|entry| matches!(entry.value().phase, AcceptPhase::Failed { .. }))
                .count() as u64
        }),
        pending_settlements_total: SETTLEMENT_JOURNAL.with_borrow(|journal| {
            journal
                .iter()
                .filter(|entry| {
                    !matches!(
                        entry.value().phase,
                        SettlementPhase::Completed | SettlementPhase::Failed { .. }
                    )
                })
                .count() as u64
        }),
        failed_settlements_total: SETTLEMENT_JOURNAL.with_borrow(|journal| {
            journal
                .iter()
                .filter(|entry| matches!(entry.value().phase, SettlementPhase::Failed { .. }))
                .count() as u64
        }),
    }
}
