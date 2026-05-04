.PHONY: build release deploy orbit-deploy generate generate-external-types reinstall-local verify verify-prod-wasm info status set-backup-controller set-freezing-threshold clean start stop test test-integration test-integration-fast help

# Use Homebrew LLVM on macOS if available, otherwise use system clang
ifneq ($(wildcard /opt/homebrew/opt/llvm/bin/clang),)
    export CC := /opt/homebrew/opt/llvm/bin/clang
endif

TARGET ?= local

ifeq ($(TARGET),prod)
    CANISTER = volumetric_prod
    NETWORK = ic
else ifeq ($(TARGET),stage)
    CANISTER = volumetric_stage
    NETWORK = ic
else ifeq ($(TARGET),dev)
    CANISTER = volumetric_dev
    NETWORK = ic
else ifeq ($(TARGET),local)
    CANISTER = volumetric_dev
    NETWORK = local
else
    $(error Unknown TARGET "$(TARGET)". Use: dev, stage, prod, or local)
endif

DOCKER_IMAGE := volumetric-canister
WASM_FILE := volumetric.wasm
DID_DIR := did
# Production Candid (no testing-only methods); updated by `make release`.
DID_FILE := $(DID_DIR)/volumetric.did
# Local / PocketIC: full interface including `testing_*` (from `make build` with --features testing).
DID_TESTING_FILE := $(DID_DIR)/volumetric.testing.did
BACKUP_CONTROLLER ?=
FREEZING_THRESHOLD_SECONDS ?= 7776000
ORBIT_ASSET_CANISTER := volumetric_orbit_assets

build:
	@echo "Building locally (with testing features; use 'make release' for production wasm)..."
	cargo build --locked --target wasm32-unknown-unknown --release --features testing
	mkdir -p $(DID_DIR)
	candid-extractor target/wasm32-unknown-unknown/release/volumetric.wasm > $(DID_TESTING_FILE)
	ic-wasm target/wasm32-unknown-unknown/release/volumetric.wasm -o $(WASM_FILE) shrink
	ic-wasm $(WASM_FILE) -o $(WASM_FILE) metadata candid:service -f $(DID_TESTING_FILE) -v public
	@echo "Build complete: $(WASM_FILE)"
	@sha256sum $(WASM_FILE)

release:
	@echo "Building production wasm (reproducible; no --features testing)..."
	docker build -t $(DOCKER_IMAGE) -f docker/Dockerfile .
	docker run --rm -v "$(PWD)":/canister $(DOCKER_IMAGE)
	mkdir -p $(DID_DIR)
	candid-extractor $(WASM_FILE) > $(DID_FILE)
	ic-wasm $(WASM_FILE) -o $(WASM_FILE) metadata candid:service -f $(DID_FILE) -v public
	@echo "Build complete: $(WASM_FILE)"
	@sha256sum $(WASM_FILE)

generate: build
	@echo "Generating TypeScript declarations..."
	dfx generate $(CANISTER)
	@echo "Copying to @volumetric/canister-types..."
	rm -rf ../../packages/canister-types/src/generated
	mkdir -p ../../packages/canister-types/src/generated
	cp src/declarations/$(CANISTER)/* ../../packages/canister-types/src/generated/
	@echo "Declarations updated in packages/canister-types/src/generated"

generate-external-types:
	@echo "Updating external Candid interfaces..."
	curl -sL "https://raw.githubusercontent.com/dfinity/ic/master/rs/bitcoin/ckbtc/minter/ckbtc_minter.did" -o did/ckbtc_minter.did
	curl -sL "https://raw.githubusercontent.com/dfinity/exchange-rate-canister/main/src/xrc/xrc.did" -o did/xrc.did
	@echo "Generating Rust types..."
	didc bind did/ckbtc_minter.did --target rs > src/volumetric/src/generated/ckbtc.rs
	didc bind did/xrc.did --target rs > src/volumetric/src/generated/xrc.rs
	@echo "Generated types updated in src/volumetric/src/generated/"

deploy:
ifeq ($(TARGET),local)
	@echo "Deploying to local..."
	dfx deploy $(CANISTER)
else
	@echo "Deploying $(WASM_FILE) to $(CANISTER) on $(NETWORK)..."
	@if [ ! -f "$(WASM_FILE)" ]; then \
		echo "Error: $(WASM_FILE) not found. Run 'make build' or 'make release' first."; \
		exit 1; \
	fi
	dfx canister install $(CANISTER) --network $(NETWORK) --mode upgrade --wasm $(WASM_FILE) --yes
endif
	@echo "Deploy complete."

orbit-deploy:
ifeq ($(TARGET),local)
	$(error orbit-deploy requires TARGET=dev, stage, or prod)
else
	@echo "Requesting Orbit upgrade: $(WASM_FILE) -> $(CANISTER)..."
	@if [ ! -f "$(WASM_FILE)" ]; then \
		echo "Error: $(WASM_FILE) not found. Run 'make build' or 'make release' first."; \
		exit 1; \
	fi
	@if [ -z "$(ORBIT_ASSET_CANISTER)" ]; then \
		echo "Error: ORBIT_ASSET_CANISTER is not set in the Makefile. Mainnet Orbit install needs an asset canister to chunk the wasm (replica max body ~4MB)."; \
		exit 1; \
	fi
	dfx-orbit -s isometric request canister install --mode upgrade --wasm $(WASM_FILE) --asset-canister $(ORBIT_ASSET_CANISTER) $(CANISTER)
endif
	@echo "Orbit request complete."

reinstall-local:
	@echo "Reinstalling canister locally (deletes all state)..."
	dfx deploy $(CANISTER) --mode reinstall
	@echo "Reinstall complete."

verify:
	@./scripts/verify.sh

verify-prod-wasm:
	@chmod +x scripts/verify-prod-wasm.sh
	@./scripts/verify-prod-wasm.sh

info:
	dfx canister --network $(NETWORK) info $(CANISTER) --identity anonymous

status:
	dfx canister --network $(NETWORK) status $(CANISTER)

set-backup-controller:
	@if [ -z "$(BACKUP_CONTROLLER)" ]; then \
		echo "Error: BACKUP_CONTROLLER is required."; \
		echo "Usage: make set-backup-controller TARGET=dev BACKUP_CONTROLLER=<principal>"; \
		exit 1; \
	fi
	dfx canister --network $(NETWORK) update-settings $(CANISTER) --add-controller $(BACKUP_CONTROLLER)
	@echo "Backup controller added: $(BACKUP_CONTROLLER)"

set-freezing-threshold:
	dfx canister --network $(NETWORK) update-settings $(CANISTER) --freezing-threshold $(FREEZING_THRESHOLD_SECONDS)
	@echo "Freezing threshold set to $(FREEZING_THRESHOLD_SECONDS) seconds"

hash:
	@echo "Wasm hash: $$([ -f $(WASM_FILE) ] && sha256sum $(WASM_FILE) | awk '{print $$1}' || echo 'not built')"

start:
	dfx start --background

stop:
	dfx stop

clean:
	rm -rf .dfx target $(WASM_FILE)

test: build
	@echo "Running tests..."
	cd src/volumetric && cargo test --test integration_smoke --features testing -- --test-threads=1

test-integration: build
	@echo "Running all integration tests..."
	cd src/volumetric && cargo test --test '*' --features testing -- --test-threads=1

test-integration-fast: build
	@echo "Running fast integration tests (excluding real ledger tests)..."
	cd src/volumetric && cargo test --test 'integration_*' --features testing -- --test-threads=1

help:
	@echo "Usage: make <target> [TARGET=dev|stage|prod|local]"
	@echo ""
	@echo "Targets:"
	@echo "  build           - Build locally (fast, outputs volumetric.wasm)"
	@echo "  release         - Build with Docker (reproducible, outputs volumetric.wasm)"
	@echo "  generate        - Generate TypeScript declarations inside volumetric_web package"
	@echo "  generate-external-types - Update external .did files and regenerate Rust types"
	@echo "  deploy          - Deploy canister (local: dfx, mainnet: uses volumetric.wasm)"
	@echo "  orbit-deploy    - Request Orbit upgrade using ORBIT_ASSET_CANISTER for wasm chunking"
	@echo "  reinstall-local - Reinstall local canister (wipes state)"
	@echo "  verify          - Verify local build matches on-chain"
	@echo "  verify-prod-wasm - Fail if production wasm exports testing-only Candid methods"
	@echo "  info            - Show canister info"
	@echo "  status          - Show canister status (cycles/controllers/freezing threshold)"
	@echo "  set-backup-controller - Add a backup controller principal"
	@echo "  set-freezing-threshold - Update canister freezing threshold in seconds"
	@echo "  hash            - Show wasm hash"
	@echo "  start           - Start local replica"
	@echo "  stop            - Stop local replica"
	@echo "  clean           - Remove build artifacts"
	@echo "  test            - Run smoke tests"
	@echo "  test-integration - Run all integration tests"
	@echo "  test-integration-fast - Run fast integration tests"
	@echo ""
	@echo "Examples:"
	@echo "  make build                # Build locally"
	@echo "  make release              # Build reproducible wasm"
	@echo "  make deploy TARGET=dev    # Deploy to dev"
	@echo "  make orbit-deploy TARGET=stage # Request Orbit upgrade on stage"
	@echo "  make deploy TARGET=local  # Deploy to local replica"
	@echo "  make status TARGET=dev    # Check cycles/controllers/freeze threshold"
	@echo "  make set-backup-controller TARGET=dev BACKUP_CONTROLLER=aaaaa-aa"
	@echo "  make set-freezing-threshold TARGET=dev FREEZING_THRESHOLD_SECONDS=7776000"
	@echo "  make test                 # Run smoke tests"
