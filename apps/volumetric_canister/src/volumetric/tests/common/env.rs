use candid::{encode_one, CandidType, Decode, Principal};
use flate2::read::GzDecoder;
use ic_management_canister_types::CanisterSettings;
use pocket_ic::PocketIc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::PathBuf;

const INIT_CYCLES: u128 = 2_000_000_000_000;

const POCKET_IC_VOLUMETRIC_CONTROLLER_SEED: &[u8] = b"pocket-ic-volumetric-controller";

fn pocket_ic_volumetric_controller() -> Principal {
    Principal::self_authenticating(POCKET_IC_VOLUMETRIC_CONTROLLER_SEED)
}

pub struct TestEnv {
    pub pic: PocketIc,
    pub volumetric_canister: Principal,
    pub ledger_canister: Principal,
    pub minter_canister: Principal,
    #[allow(dead_code)]
    pub controller: Principal,
}

impl TestEnv {
    #[allow(dead_code)]
    pub fn query<T: CandidType, R: for<'a> Deserialize<'a> + CandidType>(
        &self,
        canister_id: Principal,
        method: &str,
        arg: T,
    ) -> R {
        let response = self
            .pic
            .query_call(
                canister_id,
                Principal::anonymous(),
                method,
                encode_one(arg).unwrap(),
            )
            .expect("Query call failed");

        Decode!(&response, R).expect("Failed to decode response")
    }

    #[allow(dead_code)]
    pub fn update<T: CandidType, R: for<'a> Deserialize<'a> + CandidType>(
        &self,
        canister_id: Principal,
        sender: Principal,
        method: &str,
        arg: T,
    ) -> Result<R, String> {
        let response = self
            .pic
            .update_call(canister_id, sender, method, encode_one(arg).unwrap())
            .expect("Update call failed");

        Decode!(&response, R).map_err(|e| format!("Failed to decode response: {:?}", e))
    }

    #[allow(dead_code)]
    pub fn get_time_ns(&self) -> u64 {
        self.pic.get_time().as_nanos_since_unix_epoch()
    }

    #[allow(dead_code)]
    pub fn advance_time_secs(&self, seconds: u64) {
        self.pic
            .advance_time(std::time::Duration::from_secs(seconds));
        self.pic.tick();
    }

    #[allow(dead_code)]
    pub fn advance_time_ns(&self, nanos: u64) {
        self.pic
            .advance_time(std::time::Duration::from_nanos(nanos));
    }

    #[allow(dead_code)]
    pub fn upgrade_volumetric_canister(&self) {
        let volumetric_wasm = load_volumetric_wasm();
        self.pic
            .upgrade_canister(
                self.volumetric_canister,
                volumetric_wasm,
                encode_one(()).expect("Failed to encode upgrade args"),
                Some(self.controller),
            )
            .expect("Failed to upgrade volumetric canister");
    }
}

fn volumetric_wasm_path() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("volumetric.wasm")
}

fn test_assets_dir() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("test-assets")
}

fn find_wasm_by_prefix(prefix: &str) -> PathBuf {
    let dir = test_assets_dir();
    let entries = fs::read_dir(&dir).unwrap_or_else(|e| {
        panic!(
            "Failed to read test-assets directory at {}: {}",
            dir.display(),
            e
        )
    });

    for entry in entries.map(|e| e.expect("Failed to read directory entry")) {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(prefix) && name.contains(".wasm") {
            return entry.path();
        }
    }

    panic!(
        "No WASM file found with prefix '{}' in {}. Run the download script first.",
        prefix,
        dir.display()
    )
}

fn load_wasm_file(path: &PathBuf) -> Vec<u8> {
    let data = fs::read(path)
        .unwrap_or_else(|e| panic!("Failed to read WASM at {}: {}", path.display(), e));

    if path.to_string_lossy().contains(".gz") {
        let mut decoder = GzDecoder::new(&data[..]);
        let mut decompressed = Vec::new();
        decoder
            .read_to_end(&mut decompressed)
            .unwrap_or_else(|e| panic!("Failed to decompress WASM at {}: {}", path.display(), e));
        decompressed
    } else {
        data
    }
}

fn load_volumetric_wasm() -> Vec<u8> {
    let path = volumetric_wasm_path();
    fs::read(&path).unwrap_or_else(|e| {
        panic!(
            "Failed to read wasm at {}: {}. Run `make build` in apps/volumetric_canister first.",
            path.display(),
            e
        )
    })
}

fn load_ledger_wasm() -> Vec<u8> {
    let path = find_wasm_by_prefix("ic-icrc1-ledger");
    load_wasm_file(&path)
}

pub fn create_test_env() -> TestEnv {
    create_test_env_with_network("Testnet")
}

pub fn create_test_env_with_network(network: &str) -> TestEnv {
    let pic = PocketIc::new();

    let minter_canister = pic.create_canister();
    pic.add_cycles(minter_canister, INIT_CYCLES);

    let ledger_canister = pic.create_canister();
    pic.add_cycles(ledger_canister, INIT_CYCLES);

    let ledger_wasm = load_ledger_wasm();

    use icrc_ledger_types::icrc::generic_metadata_value::MetadataValue;
    use icrc_ledger_types::icrc1::account::Account as IcrcAccount;

    #[derive(CandidType, Serialize)]
    struct LedgerInitArgs {
        minting_account: IcrcAccount,
        fee_collector_account: Option<IcrcAccount>,
        initial_balances: Vec<(IcrcAccount, candid::Nat)>,
        transfer_fee: candid::Nat,
        token_name: String,
        token_symbol: String,
        metadata: Vec<(String, MetadataValue)>,
        archive_options: ArchiveOptions,
        max_memo_length: Option<u16>,
        feature_flags: Option<FeatureFlags>,
        decimals: Option<u8>,
        maximum_number_of_accounts: Option<u64>,
        accounts_overflow_trim_quantity: Option<u64>,
    }

    #[derive(CandidType, Serialize)]
    struct ArchiveOptions {
        num_blocks_to_archive: u64,
        trigger_threshold: u64,
        max_message_size_bytes: Option<u64>,
        cycles_for_archive_creation: Option<u64>,
        node_max_memory_size_bytes: Option<u64>,
        controller_id: Principal,
    }

    #[derive(CandidType, Serialize)]
    struct FeatureFlags {
        icrc2: bool,
    }

    #[derive(CandidType, Serialize)]
    enum LedgerArg {
        Init(LedgerInitArgs),
    }

    let init_args = LedgerInitArgs {
        minting_account: IcrcAccount {
            owner: minter_canister,
            subaccount: None,
        },
        fee_collector_account: None,
        initial_balances: vec![],
        transfer_fee: candid::Nat::from(10u64),
        token_name: "Test ckBTC".to_string(),
        token_symbol: "TckBTC".to_string(),
        metadata: vec![],
        archive_options: ArchiveOptions {
            num_blocks_to_archive: 1000,
            trigger_threshold: 2000,
            max_message_size_bytes: None,
            cycles_for_archive_creation: None,
            node_max_memory_size_bytes: None,
            controller_id: minter_canister,
        },
        max_memo_length: Some(80),
        feature_flags: Some(FeatureFlags { icrc2: true }),
        decimals: Some(8),
        maximum_number_of_accounts: None,
        accounts_overflow_trim_quantity: None,
    };

    let ledger_arg = LedgerArg::Init(init_args);
    let ledger_init_payload = encode_one(ledger_arg).unwrap();
    pic.install_canister(ledger_canister, ledger_wasm, ledger_init_payload, None);

    let controller = pocket_ic_volumetric_controller();
    let volumetric_canister = pic.create_canister_with_settings(
        None,
        Some(CanisterSettings {
            controllers: Some(vec![controller]),
            ..Default::default()
        }),
    );
    pic.add_cycles(volumetric_canister, INIT_CYCLES);

    let volumetric_wasm = load_volumetric_wasm();
    let volumetric_init_arg = encode_one(Some(network.to_string())).unwrap();
    pic.install_canister(
        volumetric_canister,
        volumetric_wasm,
        volumetric_init_arg,
        Some(controller),
    );

    TestEnv {
        pic,
        volumetric_canister,
        ledger_canister,
        minter_canister,
        controller,
    }
}
