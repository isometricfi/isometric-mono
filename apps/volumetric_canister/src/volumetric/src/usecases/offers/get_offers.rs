use crate::storage::{list_open_offers, Offer};
use crate::time::current_time_seconds;

pub fn get_open_offers_use_case() -> Vec<Offer> {
    let now_seconds = current_time_seconds();
    list_open_offers()
        .into_iter()
        .filter(|offer| offer.offer_valid_until_seconds > now_seconds)
        .collect()
}
