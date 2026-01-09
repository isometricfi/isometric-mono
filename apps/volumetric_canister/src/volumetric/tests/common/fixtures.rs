use candid::Principal;

use super::minter::{self, MockUtxo};

#[allow(dead_code)]
pub fn test_principal(seed: u8) -> Principal {
    let mut bytes = [0u8; 29];
    bytes[0] = seed;
    Principal::from_slice(&bytes)
}

#[allow(dead_code)]
pub fn test_principals(count: usize) -> Vec<Principal> {
    (0..count).map(|i| test_principal(i as u8)).collect()
}

#[allow(dead_code)]
pub fn mock_utxos(values: Vec<u64>) -> Vec<MockUtxo> {
    values
        .into_iter()
        .enumerate()
        .map(|(i, value)| minter::create_utxo(value, 100 + i as u32))
        .collect()
}

#[allow(dead_code)]
pub mod amounts {
    pub const ONE_BTC: u64 = 100_000_000;
    pub const TENTH_BTC: u64 = 10_000_000;
}
