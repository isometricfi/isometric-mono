use std::cell::RefCell;

use candid::Principal;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, StableCell};

use super::cbor::Cbor;
use super::config::Config;

pub enum MemoryIndex {
    ConfigMemory = 0,
    WhitelistMemory = 1,
}

pub type Memory = VirtualMemory<DefaultMemoryImpl>;
pub type ConfigCell = StableCell<Cbor<Config>, Memory>;

thread_local! {
    pub static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    pub static CONFIG: RefCell<ConfigCell> = RefCell::new(
        ConfigCell::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(MemoryIndex::ConfigMemory as u8))),
            Cbor(Config::default())
        )
    );

    pub static WHITELIST: RefCell<StableBTreeMap<Principal, bool, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER
                .with_borrow(|m| m.get(MemoryId::new(MemoryIndex::WhitelistMemory as u8))),
        )
    );
}
