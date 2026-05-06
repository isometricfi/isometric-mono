mod accept_offers;
mod accept_offers_wal;
#[cfg(test)]
mod tests;

use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::journaling::OperationId;
use crate::storage::{AcceptPhase, ActiveOption};

pub use self::accept_offers::{accept_offers_use_case, get_accept_status};
pub(crate) use self::accept_offers_wal::finalize_failed_accept_wal;
pub use self::accept_offers_wal::run_accept_wal;

pub struct AcceptOfferItem {
    pub offer_id: u64,
    pub quantity: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct AcceptOffersReceipt {
    pub operation_id: OperationId,
    pub accept_journal_entry_id: u64,
    pub fill_group_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AcceptOffersResult {
    pub active_options: Vec<ActiveOption>,
    pub fill_group_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum AcceptOffersStatus {
    Pending {
        receipt: AcceptOffersReceipt,
        phase: AcceptPhase,
        last_error: Option<String>,
    },
    Succeeded {
        receipt: AcceptOffersReceipt,
        result: AcceptOffersResult,
    },
    RetryRequired {
        receipt: AcceptOffersReceipt,
        phase: AcceptPhase,
        last_error: Option<String>,
        next_attempt_at_seconds: u64,
    },
    RecoveryRequired {
        receipt: AcceptOffersReceipt,
        phase: AcceptPhase,
        last_error: Option<String>,
    },
    Failed {
        receipt: AcceptOffersReceipt,
        message: String,
    },
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct AcceptWalResult {
    pub option_ids: Vec<u64>,
    pub fill_group_id: u64,
}
