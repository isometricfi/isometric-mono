use candid::{encode_one, Principal};
use pocket_ic::PocketIc;
use std::fs;
use std::path::PathBuf;

const INIT_CYCLES: u128 = 2_000_000_000_000;

pub fn wasm_path() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    // Go up from src/volumetric to apps/volumetric_canister where volumetric.wasm is
    manifest_dir
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("volumetric.wasm")
}

pub fn load_wasm() -> Vec<u8> {
    let path = wasm_path();
    fs::read(&path).unwrap_or_else(|e| {
        panic!(
            "Failed to read wasm at {}: {}. Run `make build` in apps/volumetric_canister first.",
            path.display(),
            e
        )
    })
}

pub fn setup_canister() -> (PocketIc, Principal) {
    let pic = PocketIc::new();
    let canister_id = pic.create_canister();
    pic.add_cycles(canister_id, INIT_CYCLES);

    let wasm = load_wasm();
    let init_arg = encode_one(Some("Testnet".to_string())).unwrap();
    pic.install_canister(canister_id, wasm, init_arg, None);

    (pic, canister_id)
}

pub fn get_controller(pic: &PocketIc, canister_id: Principal) -> Principal {
    pic.get_controllers(canister_id)[0]
}

