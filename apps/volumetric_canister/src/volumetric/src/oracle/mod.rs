use crate::errors::VolumetricError;

pub trait PriceOracle {
    fn get_btc_usd_price_cents(&self) -> Result<u64, VolumetricError>;
}

pub struct StubOracle {
    price_cents: u64,
}

impl Default for StubOracle {
    fn default() -> Self {
        Self {
            price_cents: 10_000_000,
        }
    }
}

impl StubOracle {
    pub fn new(price_cents: u64) -> Self {
        Self { price_cents }
    }

    pub fn set_price(&mut self, price_cents: u64) {
        self.price_cents = price_cents;
    }
}

impl PriceOracle for StubOracle {
    fn get_btc_usd_price_cents(&self) -> Result<u64, VolumetricError> {
        Ok(self.price_cents)
    }
}

use std::cell::RefCell;

thread_local! {
    static ORACLE: RefCell<StubOracle> = RefCell::new(StubOracle::default());
}

// Returns the current BTC/USD price in cents. Currently hardcoded to $100,000.00.
pub fn get_btc_usd_price_cents() -> Result<u64, VolumetricError> {
    ORACLE.with_borrow(|o| o.get_btc_usd_price_cents())
}

// Internal function to set price. Only called from whitelisted endpoint.
pub(crate) fn set_oracle_price_internal(price_cents: u64) {
    ORACLE.with_borrow_mut(|o| o.set_price(price_cents));
}

pub fn calculate_call_option_payout(
    settlement_price_cents: u64,
    strike_price_cents: u64,
    quantity_sats: u64,
) -> u64 {
    if settlement_price_cents <= strike_price_cents {
        return 0;
    }

    let profit_cents = settlement_price_cents - strike_price_cents;
    let payout = (quantity_sats as u128 * profit_cents as u128) / settlement_price_cents as u128;
    payout as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_itm_payout() {
        // given
        let settlement = 12_000_000;
        let strike = 10_000_000;
        let quantity = 50_000_000;

        // when
        let payout = calculate_call_option_payout(settlement, strike, quantity);

        // then
        let profit_cents = settlement - strike;
        let expected = (quantity as u128 * profit_cents as u128) / settlement as u128;
        assert_eq!(payout, expected as u64);
    }

    #[test]
    fn test_otm_payout() {
        // given
        let settlement = 9_000_000;
        let strike = 10_000_000;
        let quantity = 50_000_000;

        // when
        let payout = calculate_call_option_payout(settlement, strike, quantity);

        // then
        assert_eq!(payout, 0);
    }

    #[test]
    fn test_atm_payout() {
        // given
        let settlement = 10_000_000;
        let strike = 10_000_000;
        let quantity = 50_000_000;

        // when
        let payout = calculate_call_option_payout(settlement, strike, quantity);

        // then
        assert_eq!(payout, 0);
    }
}
