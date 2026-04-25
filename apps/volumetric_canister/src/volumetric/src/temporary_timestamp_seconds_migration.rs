use std::borrow::Cow;

use candid::{CandidType, Decode, Encode, Principal};
use ic_stable_structures::memory_manager::MemoryId;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{StableBTreeMap, StableCell, Storable};
use serde::{Deserialize, Serialize};

use crate::journaling::{OperationId, WalEntry, WalKind, WalResult, WalStatus};
use crate::storage::{
    AcceptPhase, AcceptedOffer, ActiveOption, ActiveOptionStatus, Asset, Cbor, Event, EventData,
    EventType, Memory, MemoryIndex, Offer, OfferStatus, OptionType, PendingAccept,
    PendingSettlement, PendingWithdrawal, Profile, SettlementPhase, TradeRole, WithdrawalPhase,
    MEMORY_MANAGER,
};
use crate::time::nanos_to_seconds;

/// Temporary one-upgrade bridge. Delete this module after the timestamp migration has run.
const TEMPORARY_TIMESTAMP_SECONDS_MIGRATION_VERSION: u64 = 1;

macro_rules! impl_candid_storable {
    ($type_name:ty, $max_size:expr) => {
        impl Storable for $type_name {
            fn to_bytes(&self) -> Cow<'_, [u8]> {
                Cow::Owned(Encode!(self).unwrap())
            }

            fn from_bytes(bytes: Cow<[u8]>) -> Self {
                Decode!(bytes.as_ref(), Self).unwrap()
            }

            fn into_bytes(self) -> Vec<u8> {
                Encode!(&self).unwrap()
            }

            const BOUND: Bound = Bound::Bounded {
                max_size: $max_size,
                is_fixed_size: false,
            };
        }
    };
}

pub fn run_temporary_timestamp_seconds_migration() {
    let mut marker = StableCell::init(
        memory(MemoryIndex::TemporaryTimestampSecondsMigrationMemory),
        0u64,
    );
    if *marker.get() >= TEMPORARY_TIMESTAMP_SECONDS_MIGRATION_VERSION {
        return;
    }

    migrate_profiles();
    migrate_offers();
    migrate_active_options();
    migrate_events();
    migrate_accept_journal();
    migrate_settlement_journal();
    migrate_withdrawal_journal();
    migrate_wal();

    let _ = marker.set(TEMPORARY_TIMESTAMP_SECONDS_MIGRATION_VERSION);
}

pub fn mark_temporary_timestamp_seconds_migration_complete() {
    let mut marker = StableCell::init(
        memory(MemoryIndex::TemporaryTimestampSecondsMigrationMemory),
        0u64,
    );
    let _ = marker.set(TEMPORARY_TIMESTAMP_SECONDS_MIGRATION_VERSION);
}

fn memory(index: MemoryIndex) -> Memory {
    MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(index as u8)))
}

fn migrate_profiles() {
    let entries: Vec<(Principal, Profile)> = {
        let legacy_map = StableBTreeMap::<Principal, Cbor<LegacyProfile>, Memory>::init(memory(
            MemoryIndex::ProfilesMemory,
        ));
        legacy_map
            .iter()
            .map(|entry| (*entry.key(), entry.value().0.into()))
            .collect()
    };
    let mut new_map = StableBTreeMap::<Principal, Cbor<Profile>, Memory>::init(memory(
        MemoryIndex::ProfilesMemory,
    ));
    for (principal, profile) in entries {
        new_map.insert(principal, Cbor(profile));
    }
}

fn migrate_offers() {
    let entries: Vec<(u64, Offer)> = {
        let legacy_map = StableBTreeMap::<u64, Cbor<LegacyOffer>, Memory>::init(memory(
            MemoryIndex::OffersMemory,
        ));
        legacy_map
            .iter()
            .map(|entry| (*entry.key(), entry.value().0.into()))
            .collect()
    };
    let mut new_map =
        StableBTreeMap::<u64, Cbor<Offer>, Memory>::init(memory(MemoryIndex::OffersMemory));
    for (id, offer) in entries {
        new_map.insert(id, Cbor(offer));
    }
}

fn migrate_active_options() {
    let entries: Vec<(u64, ActiveOption)> = {
        let legacy_map = StableBTreeMap::<u64, Cbor<LegacyActiveOption>, Memory>::init(memory(
            MemoryIndex::ActiveOptionsMemory,
        ));
        legacy_map
            .iter()
            .map(|entry| (*entry.key(), entry.value().0.into()))
            .collect()
    };
    let mut new_map = StableBTreeMap::<u64, Cbor<ActiveOption>, Memory>::init(memory(
        MemoryIndex::ActiveOptionsMemory,
    ));
    for (id, option) in entries {
        new_map.insert(id, Cbor(option));
    }
}

fn migrate_events() {
    let entries: Vec<(u64, Event)> = {
        let legacy_map = StableBTreeMap::<u64, Cbor<LegacyEvent>, Memory>::init(memory(
            MemoryIndex::EventsMemory,
        ));
        legacy_map
            .iter()
            .map(|entry| (*entry.key(), entry.value().0.into()))
            .collect()
    };
    let mut new_map =
        StableBTreeMap::<u64, Cbor<Event>, Memory>::init(memory(MemoryIndex::EventsMemory));
    for (id, event) in entries {
        new_map.insert(id, Cbor(event));
    }
}

fn migrate_accept_journal() {
    let entries: Vec<(u64, PendingAccept)> = {
        let legacy_map = StableBTreeMap::<u64, LegacyPendingAccept, Memory>::init(memory(
            MemoryIndex::AcceptJournalMemory,
        ));
        legacy_map
            .iter()
            .map(|entry| (*entry.key(), entry.value().into()))
            .collect()
    };
    let mut new_map = StableBTreeMap::<u64, PendingAccept, Memory>::init(memory(
        MemoryIndex::AcceptJournalMemory,
    ));
    for (id, accept) in entries {
        new_map.insert(id, accept);
    }
}

fn migrate_settlement_journal() {
    let entries: Vec<(u64, PendingSettlement)> = {
        let legacy_map = StableBTreeMap::<u64, LegacyPendingSettlement, Memory>::init(memory(
            MemoryIndex::SettlementJournalMemory,
        ));
        legacy_map
            .iter()
            .map(|entry| (*entry.key(), entry.value().into()))
            .collect()
    };
    let mut new_map = StableBTreeMap::<u64, PendingSettlement, Memory>::init(memory(
        MemoryIndex::SettlementJournalMemory,
    ));
    for (id, settlement) in entries {
        new_map.insert(id, settlement);
    }
}

fn migrate_withdrawal_journal() {
    let entries: Vec<(u64, PendingWithdrawal)> = {
        let legacy_map = StableBTreeMap::<u64, LegacyPendingWithdrawal, Memory>::init(memory(
            MemoryIndex::WithdrawalJournalMemory,
        ));
        legacy_map
            .iter()
            .map(|entry| (*entry.key(), entry.value().into()))
            .collect()
    };
    let mut new_map = StableBTreeMap::<u64, PendingWithdrawal, Memory>::init(memory(
        MemoryIndex::WithdrawalJournalMemory,
    ));
    for (id, withdrawal) in entries {
        new_map.insert(id, withdrawal);
    }
}

fn migrate_wal() {
    let entries: Vec<(OperationId, WalEntry)> = {
        let legacy_map = StableBTreeMap::<OperationId, Cbor<LegacyWalEntry>, Memory>::init(memory(
            MemoryIndex::WalMemory,
        ));
        legacy_map
            .iter()
            .map(|entry| (*entry.key(), entry.value().0.into()))
            .collect()
    };
    let mut new_map =
        StableBTreeMap::<OperationId, Cbor<WalEntry>, Memory>::init(memory(MemoryIndex::WalMemory));
    for (operation_id, wal_entry) in entries {
        new_map.insert(operation_id, Cbor(wal_entry));
    }
}

#[derive(Clone, Serialize, Deserialize)]
struct LegacyProfile {
    wallet_address: String,
    username: Option<String>,
    created_at: u64,
    #[serde(default)]
    invite_code: Option<String>,
    #[serde(default)]
    referred_by: Option<Principal>,
}

impl From<LegacyProfile> for Profile {
    fn from(legacy: LegacyProfile) -> Self {
        Self {
            wallet_address: legacy.wallet_address,
            username: legacy.username,
            created_at_seconds: nanos_to_seconds(legacy.created_at),
            invite_code: legacy.invite_code,
            referred_by: legacy.referred_by,
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
struct LegacyOffer {
    id: u64,
    writer: Principal,
    asset: Asset,
    option_type: OptionType,
    strike_basis_points: u16,
    premium_basis_points: u16,
    total_quantity: u64,
    remaining_quantity: u64,
    offer_valid_until: u64,
    option_duration_seconds: u64,
    status: OfferStatus,
    created_at: u64,
}

impl From<LegacyOffer> for Offer {
    fn from(legacy: LegacyOffer) -> Self {
        Self {
            id: legacy.id,
            writer: legacy.writer,
            asset: legacy.asset,
            option_type: legacy.option_type,
            strike_basis_points: legacy.strike_basis_points,
            premium_basis_points: legacy.premium_basis_points,
            total_quantity: legacy.total_quantity,
            remaining_quantity: legacy.remaining_quantity,
            offer_valid_until_seconds: nanos_to_seconds(legacy.offer_valid_until),
            option_duration_seconds: legacy.option_duration_seconds,
            status: legacy.status,
            created_at_seconds: nanos_to_seconds(legacy.created_at),
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
struct LegacyActiveOption {
    id: u64,
    offer_id: u64,
    buyer: Principal,
    writer: Principal,
    asset: Asset,
    option_type: OptionType,
    quantity: u64,
    entry_price_cents: u64,
    strike_price_cents: u64,
    premium_paid: u64,
    accepted_at: u64,
    expiry: u64,
    status: ActiveOptionStatus,
    fill_group_id: Option<u64>,
    #[serde(default)]
    profit_fee_basis_points: u64,
}

impl From<LegacyActiveOption> for ActiveOption {
    fn from(legacy: LegacyActiveOption) -> Self {
        Self {
            id: legacy.id,
            offer_id: legacy.offer_id,
            buyer: legacy.buyer,
            writer: legacy.writer,
            asset: legacy.asset,
            option_type: legacy.option_type,
            quantity: legacy.quantity,
            entry_price_cents: legacy.entry_price_cents,
            strike_price_cents: legacy.strike_price_cents,
            premium_paid: legacy.premium_paid,
            accepted_at_seconds: nanos_to_seconds(legacy.accepted_at),
            expiry_seconds: nanos_to_seconds(legacy.expiry),
            status: legacy.status,
            fill_group_id: legacy.fill_group_id,
            profit_fee_basis_points: legacy.profit_fee_basis_points,
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
struct LegacyEvent {
    id: u64,
    event_type: EventType,
    principal: Principal,
    timestamp: u64,
    data: LegacyEventData,
}

impl From<LegacyEvent> for Event {
    fn from(legacy: LegacyEvent) -> Self {
        Self {
            id: legacy.id,
            event_type: legacy.event_type,
            principal: legacy.principal,
            timestamp_seconds: nanos_to_seconds(legacy.timestamp),
            data: legacy.data.into(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
enum LegacyEventData {
    AccountCreated {
        wallet_address: String,
    },
    UsernameUpdated {
        old_username: Option<String>,
        new_username: String,
    },
    Deposit {
        amount_sats: u64,
    },
    Withdrawal {
        amount_sats: u64,
        destination: String,
    },
    WithdrawalFailed {
        amount_sats: u64,
        reason: String,
    },
    OfferCreated {
        offer_id: u64,
        quantity_sats: u64,
        strike_basis_points: u16,
        premium_basis_points: u16,
        duration_seconds: u64,
        offer_valid_until_ns: u64,
    },
    OfferCancelled {
        offer_id: u64,
        remaining_quantity_sats: u64,
    },
    OfferAccepted {
        offer_id: u64,
        option_id: u64,
        fill_group_id: u64,
        counterparty: Principal,
        quantity_sats: u64,
        premium_sats: u64,
        entry_price_cents: u64,
        strike_price_cents: u64,
        expiry_ns: u64,
        role: TradeRole,
    },
    OfferAcceptFailed {
        offer_ids: Vec<u64>,
        reason: String,
    },
    OptionSettled {
        option_id: u64,
        quantity_sats: u64,
        entry_price_cents: u64,
        strike_price_cents: u64,
        settlement_price_cents: u64,
        premium_sats: u64,
        payout_sats: u64,
        accepted_at_ns: u64,
        settled_at_ns: u64,
        role: TradeRole,
    },
    OptionSettlementFailed {
        option_id: u64,
        reason: String,
    },
    #[serde(other)]
    Unknown,
}

impl From<LegacyEventData> for EventData {
    fn from(legacy: LegacyEventData) -> Self {
        match legacy {
            LegacyEventData::AccountCreated { wallet_address } => {
                EventData::AccountCreated { wallet_address }
            }
            LegacyEventData::UsernameUpdated {
                old_username,
                new_username,
            } => EventData::UsernameUpdated {
                old_username,
                new_username,
            },
            LegacyEventData::Deposit { amount_sats } => EventData::Deposit { amount_sats },
            LegacyEventData::Withdrawal {
                amount_sats,
                destination,
            } => EventData::Withdrawal {
                amount_sats,
                destination,
            },
            LegacyEventData::WithdrawalFailed {
                amount_sats,
                reason,
            } => EventData::WithdrawalFailed {
                amount_sats,
                reason,
            },
            LegacyEventData::OfferCreated {
                offer_id,
                quantity_sats,
                strike_basis_points,
                premium_basis_points,
                duration_seconds,
                offer_valid_until_ns,
            } => EventData::OfferCreated {
                offer_id,
                quantity_sats,
                strike_basis_points,
                premium_basis_points,
                duration_seconds,
                offer_valid_until_seconds: nanos_to_seconds(offer_valid_until_ns),
            },
            LegacyEventData::OfferCancelled {
                offer_id,
                remaining_quantity_sats,
            } => EventData::OfferCancelled {
                offer_id,
                remaining_quantity_sats,
            },
            LegacyEventData::OfferAccepted {
                offer_id,
                option_id,
                fill_group_id,
                counterparty,
                quantity_sats,
                premium_sats,
                entry_price_cents,
                strike_price_cents,
                expiry_ns,
                role,
            } => EventData::OfferAccepted {
                offer_id,
                option_id,
                fill_group_id,
                counterparty,
                quantity_sats,
                premium_sats,
                entry_price_cents,
                strike_price_cents,
                expiry_seconds: nanos_to_seconds(expiry_ns),
                role,
            },
            LegacyEventData::OfferAcceptFailed { offer_ids, reason } => {
                EventData::OfferAcceptFailed { offer_ids, reason }
            }
            LegacyEventData::OptionSettled {
                option_id,
                quantity_sats,
                entry_price_cents,
                strike_price_cents,
                settlement_price_cents,
                premium_sats,
                payout_sats,
                accepted_at_ns,
                settled_at_ns,
                role,
            } => EventData::OptionSettled {
                option_id,
                quantity_sats,
                entry_price_cents,
                strike_price_cents,
                settlement_price_cents,
                premium_sats,
                payout_sats,
                accepted_at_seconds: nanos_to_seconds(accepted_at_ns),
                settled_at_seconds: nanos_to_seconds(settled_at_ns),
                role,
            },
            LegacyEventData::OptionSettlementFailed { option_id, reason } => {
                EventData::OptionSettlementFailed { option_id, reason }
            }
            LegacyEventData::Unknown => EventData::Unknown,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct LegacyPendingAccept {
    id: u64,
    buyer: Principal,
    total_buyer_debit_required_sats: u64,
    offers: Vec<AcceptedOffer>,
    phase: AcceptPhase,
    created_at: u64,
    updated_at: u64,
    fill_group_id: u64,
    entry_price_cents: Option<u64>,
    platform_fee_collected: Option<bool>,
}

impl_candid_storable!(LegacyPendingAccept, 1024);

impl From<LegacyPendingAccept> for PendingAccept {
    fn from(legacy: LegacyPendingAccept) -> Self {
        Self {
            id: legacy.id,
            buyer: legacy.buyer,
            total_buyer_debit_required_sats: legacy.total_buyer_debit_required_sats,
            offers: legacy.offers,
            phase: legacy.phase,
            created_at_seconds: nanos_to_seconds(legacy.created_at),
            updated_at_seconds: nanos_to_seconds(legacy.updated_at),
            fill_group_id: legacy.fill_group_id,
            entry_price_cents: legacy.entry_price_cents,
            platform_fee_collected: legacy.platform_fee_collected,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct LegacyPendingSettlement {
    option_id: u64,
    writer: Principal,
    buyer: Principal,
    payout_to_buyer: u64,
    payout_to_writer: u64,
    settlement_price_cents: u64,
    phase: SettlementPhase,
    created_at: u64,
    updated_at: u64,
}

impl_candid_storable!(LegacyPendingSettlement, 512);

impl From<LegacyPendingSettlement> for PendingSettlement {
    fn from(legacy: LegacyPendingSettlement) -> Self {
        Self {
            option_id: legacy.option_id,
            writer: legacy.writer,
            buyer: legacy.buyer,
            payout_to_buyer: legacy.payout_to_buyer,
            payout_to_writer: legacy.payout_to_writer,
            settlement_price_cents: legacy.settlement_price_cents,
            phase: legacy.phase,
            created_at_seconds: nanos_to_seconds(legacy.created_at),
            updated_at_seconds: nanos_to_seconds(legacy.updated_at),
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct LegacyPendingWithdrawal {
    id: u64,
    principal: Principal,
    amount: u64,
    btc_address: String,
    phase: WithdrawalPhase,
    created_at: u64,
    updated_at: u64,
    created_at_time: u64,
}

impl_candid_storable!(LegacyPendingWithdrawal, 512);

impl From<LegacyPendingWithdrawal> for PendingWithdrawal {
    fn from(legacy: LegacyPendingWithdrawal) -> Self {
        Self {
            id: legacy.id,
            principal: legacy.principal,
            amount: legacy.amount,
            btc_address: legacy.btc_address,
            phase: legacy.phase,
            created_at_seconds: nanos_to_seconds(legacy.created_at),
            updated_at_seconds: nanos_to_seconds(legacy.updated_at),
            created_at_time_ns: legacy.created_at_time,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
struct LegacyWalEntry {
    id: OperationId,
    kind: WalKind,
    attempts: u32,
    status: WalStatus,
    first_seen_ns: u64,
    last_update_ns: u64,
    last_err: Option<String>,
    payload: LegacyWalPayload,
    max_retries: u32,
    backoff_secs: u64,
    next_attempt_at_ns: u64,
    result: Option<WalResult>,
}

impl From<LegacyWalEntry> for crate::journaling::WalEntry {
    fn from(legacy: LegacyWalEntry) -> Self {
        Self {
            id: legacy.id,
            kind: legacy.kind,
            attempts: legacy.attempts,
            status: legacy.status,
            first_seen_seconds: nanos_to_seconds(legacy.first_seen_ns),
            last_update_seconds: nanos_to_seconds(legacy.last_update_ns),
            last_err: legacy.last_err,
            payload: legacy.payload.into(),
            max_retries: legacy.max_retries,
            backoff_secs: legacy.backoff_secs,
            next_attempt_at_seconds: nanos_to_seconds(legacy.next_attempt_at_ns),
            result: legacy.result,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
enum LegacyWalPayload {
    Settlement(crate::journaling::SettlementWalPayload),
    Withdrawal(crate::journaling::WithdrawalWalPayload),
    Accept(LegacyAcceptWalPayload),
}

impl From<LegacyWalPayload> for crate::journaling::WalPayload {
    fn from(legacy: LegacyWalPayload) -> Self {
        match legacy {
            LegacyWalPayload::Settlement(payload) => {
                crate::journaling::WalPayload::Settlement(payload)
            }
            LegacyWalPayload::Withdrawal(payload) => {
                crate::journaling::WalPayload::Withdrawal(payload)
            }
            LegacyWalPayload::Accept(payload) => {
                crate::journaling::WalPayload::Accept(payload.into())
            }
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
struct LegacyAcceptWalPayload {
    accept_journal_entry_id: u64,
    buyer: Principal,
    fill_group_id: u64,
    total_buyer_debit_required_sats: u64,
    planned_platform_fee_sats: u64,
    transfer_fee_sats: u64,
    created_at_time_ns: u64,
    prepared_accepts: Vec<LegacyAcceptWalPreparedAccept>,
    writer_transfers: Vec<crate::journaling::AcceptWalTransfer>,
}

impl From<LegacyAcceptWalPayload> for crate::journaling::AcceptWalPayload {
    fn from(legacy: LegacyAcceptWalPayload) -> Self {
        Self {
            accept_journal_entry_id: legacy.accept_journal_entry_id,
            buyer: legacy.buyer,
            fill_group_id: legacy.fill_group_id,
            total_buyer_debit_required_sats: legacy.total_buyer_debit_required_sats,
            planned_platform_fee_sats: legacy.planned_platform_fee_sats,
            transfer_fee_sats: legacy.transfer_fee_sats,
            created_at_time_ns: legacy.created_at_time_ns,
            prepared_accepts: legacy
                .prepared_accepts
                .into_iter()
                .map(Into::into)
                .collect(),
            writer_transfers: legacy.writer_transfers,
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
struct LegacyAcceptWalPreparedAccept {
    offer_id: u64,
    writer: Principal,
    asset: Asset,
    option_type: OptionType,
    strike_basis_points: u16,
    quantity_sats: u64,
    premium_sats: u64,
    premium_to_writer_sats: u64,
    premium_fee_sats: u64,
    option_id: u64,
    expiry_ns: u64,
    original_remaining_quantity_sats: u64,
    original_status: OfferStatus,
    profit_fee_basis_points: u64,
}

impl From<LegacyAcceptWalPreparedAccept> for crate::journaling::AcceptWalPreparedAccept {
    fn from(legacy: LegacyAcceptWalPreparedAccept) -> Self {
        Self {
            offer_id: legacy.offer_id,
            writer: legacy.writer,
            asset: legacy.asset,
            option_type: legacy.option_type,
            strike_basis_points: legacy.strike_basis_points,
            quantity_sats: legacy.quantity_sats,
            premium_sats: legacy.premium_sats,
            premium_to_writer_sats: legacy.premium_to_writer_sats,
            premium_fee_sats: legacy.premium_fee_sats,
            option_id: legacy.option_id,
            expiry_seconds: nanos_to_seconds(legacy.expiry_ns),
            original_remaining_quantity_sats: legacy.original_remaining_quantity_sats,
            original_status: legacy.original_status,
            profit_fee_basis_points: legacy.profit_fee_basis_points,
        }
    }
}
