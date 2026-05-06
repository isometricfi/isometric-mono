use std::cell::RefCell;

use candid::Principal;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, StableCell};

use super::cbor::Cbor;
use super::config::Config;

pub enum MemoryIndex {
    /// Canister configuration (ckBTC ledger principal, etc.)
    ConfigMemory = 0,
    /// Admin whitelist for privileged operations
    WhitelistMemory = 1,
    /// Replay protection nonces for signature verification
    NoncesMemory = 2,
    /// User profiles linked to Bitcoin addresses
    ProfilesMemory = 3,
    /// Bitcoin address to Principal mapping
    WalletsMemory = 4,
    /// User ckBTC balances (available + locked as writer)
    BalancesMemory = 5,
    /// Option offers created by writers
    OffersMemory = 6,
    /// Active options between buyers and writers
    ActiveOptionsMemory = 7,
    /// Auto-increment ID counters (offers, options, fill groups, events)
    CountersMemory = 8,
    /// Pending withdrawals journal for recovery
    WithdrawalJournalMemory = 9,
    /// Pending accepts journal for recovery
    AcceptJournalMemory = 10,
    /// Pending settlements journal for recovery
    SettlementJournalMemory = 11,
    /// User activity events for history tracking
    EventsMemory = 12,
    /// Durable WAL entries for async side effects
    WalMemory = 13,
    /// Invite code to principal lookup
    InviteCodeRegistryMemory = 14,
    /// Reserved for the completed one-off nanoseconds-to-seconds migration marker.
    ReservedTimestampSecondsMigrationMemory = 15,
    /// Hashed bearer token for protected HTTP log access.
    LogAccessTokenHashMemory = 16,
    /// Cached BTC/USD rates fetched from the XRC.
    XrcBtcUsdRatesMemory = 17,
}

pub type Memory = VirtualMemory<DefaultMemoryImpl>;
pub type ConfigCell = StableCell<Cbor<Config>, Memory>;
pub type LogAccessTokenHashCell = StableCell<Cbor<Option<String>>, Memory>;

thread_local! {
    pub static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    pub static CONFIG: RefCell<ConfigCell> = RefCell::new(
        ConfigCell::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::ConfigMemory as u8))),
            Cbor(Config::default())
        )
    );

    pub static LOG_ACCESS_TOKEN_HASH: RefCell<LogAccessTokenHashCell> = RefCell::new(
        LogAccessTokenHashCell::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::LogAccessTokenHashMemory as u8))),
            Cbor(None)
        )
    );

    pub static WHITELIST: RefCell<StableBTreeMap<Principal, bool, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER
                .with_borrow(|m| m.get(MemoryId::new(MemoryIndex::WhitelistMemory as u8))),
        )
    );
}
