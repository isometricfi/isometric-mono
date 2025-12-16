use candid::Principal;

use crate::storage::{list_active_options_by_buyer, list_active_options_by_writer, ActiveOption};

pub fn get_my_options_use_case(principal: Principal) -> Vec<ActiveOption> {
    list_active_options_by_buyer(principal)
}

pub fn get_my_written_options_use_case(principal: Principal) -> Vec<ActiveOption> {
    list_active_options_by_writer(principal)
}
