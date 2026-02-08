use crate::ic;
use crate::storage::{list_open_offers, Offer};

pub fn get_open_offers_use_case() -> Vec<Offer> {
    let now = ic::time();
    list_open_offers()
        .into_iter()
        .filter(|o| o.offer_valid_until > now)
        .collect()
}
