use candid::Principal;
use sha2::Digest;
use std::collections::HashMap;
use std::sync::Mutex;

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct MockUtxo {
    pub outpoint: MockOutpoint,
    pub value: u64,
    pub height: u32,
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct MockOutpoint {
    pub txid: Vec<u8>,
}

#[allow(dead_code)]
#[allow(clippy::type_complexity)]
static MOCK_UTXOS: Mutex<Option<HashMap<(Principal, Option<Vec<u8>>), Vec<MockUtxo>>>> =
    Mutex::new(None);

#[allow(dead_code)]
pub fn init() {
    let mut utxos = MOCK_UTXOS.lock().unwrap();
    *utxos = Some(HashMap::new());
}

#[allow(dead_code)]
pub fn clear() {
    let mut utxos = MOCK_UTXOS.lock().unwrap();
    *utxos = None;
}

#[allow(dead_code)]
pub fn get_btc_address(principal: Principal, subaccount: Option<[u8; 32]>) -> String {
    let mut data = principal.as_slice().to_vec();
    if let Some(sub) = subaccount {
        data.extend_from_slice(&sub);
    }

    let hash = sha2::Sha256::digest(&data);
    let hex = hex::encode(&hash[0..20]);
    format!("tb1q{}", hex)
}

#[allow(dead_code)]
pub fn inject_utxos(principal: Principal, subaccount: Option<[u8; 32]>, utxos: Vec<MockUtxo>) {
    let mut storage = MOCK_UTXOS.lock().unwrap();
    if let Some(ref mut map) = *storage {
        let key = (principal, subaccount.map(|s| s.to_vec()));
        map.insert(key, utxos);
    }
}

#[allow(dead_code)]
pub fn create_utxo(value: u64, height: u32) -> MockUtxo {
    use sha2::{Digest, Sha256};

    let mut hasher = Sha256::new();
    hasher.update(value.to_le_bytes());
    hasher.update(height.to_le_bytes());
    let txid = hasher.finalize().to_vec();

    MockUtxo {
        outpoint: MockOutpoint { txid },
        value,
        height,
    }
}
