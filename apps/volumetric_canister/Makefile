.PHONY: build release deploy generate generate-external-types reinstall-local verify info clean start stop help

export CC := /opt/homebrew/opt/llvm/bin/clang

TARGET ?= local

ifeq ($(TARGET),prod)
    CANISTER = volumetric_prod
    NETWORK = ic
else ifeq ($(TARGET),dev)
    CANISTER = volumetric_dev
    NETWORK = ic
else ifeq ($(TARGET),local)
    CANISTER = volumetric_dev
    NETWORK = local
else
    $(error Unknown TARGET "$(TARGET)". Use: dev, prod, or local)
endif

DOCKER_IMAGE := volumetric-canister
WASM_FILE := volumetric.wasm
DID_FILE := src/volumetric/volumetric.did

build:
	@echo "Building locally..."
	cargo build --locked --target wasm32-unknown-unknown --release
	candid-extractor target/wasm32-unknown-unknown/release/volumetric.wasm > $(DID_FILE)
	ic-wasm target/wasm32-unknown-unknown/release/volumetric.wasm -o $(WASM_FILE) shrink
	@echo "Build complete: $(WASM_FILE)"
	@sha256sum $(WASM_FILE)

release:
	@echo "Building reproducible wasm with Docker..."
	docker build -t $(DOCKER_IMAGE) -f docker/Dockerfile .
	docker run --rm -v "$(PWD)":/canister $(DOCKER_IMAGE)
	candid-extractor $(WASM_FILE) > $(DID_FILE)
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
	@echo "Generating Rust types..."
	didc bind did/ckbtc_minter.did --target rs > src/volumetric/src/generated/ckbtc.rs
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

reinstall-local:
	@echo "Reinstalling canister locally (deletes all state)..."
	dfx deploy $(CANISTER) --mode reinstall
	@echo "Reinstall complete."

verify:
	@./scripts/verify.sh

info:
	dfx canister --network $(NETWORK) info $(CANISTER) --identity anonymous

hash:
	@echo "Wasm hash: $$([ -f $(WASM_FILE) ] && sha256sum $(WASM_FILE) | awk '{print $$1}' || echo 'not built')"

start:
	dfx start --background

stop:
	dfx stop

clean:
	rm -rf .dfx target $(WASM_FILE)

help:
	@echo "Usage: make <target> [TARGET=dev|prod|local]"
	@echo ""
	@echo "Targets:"
	@echo "  build           - Build locally (fast, outputs volumetric.wasm)"
	@echo "  release         - Build with Docker (reproducible, outputs volumetric.wasm)"
	@echo "  generate        - Generate TypeScript declarations inside volumetric_web package"
	@echo "  generate-external-types - Update external .did files and regenerate Rust types"
	@echo "  deploy          - Deploy canister (local: dfx, mainnet: uses volumetric.wasm)"
	@echo "  reinstall-local - Reinstall local canister (wipes state)"
	@echo "  verify          - Verify local build matches on-chain"
	@echo "  info            - Show canister info"
	@echo "  hash            - Show wasm hash"
	@echo "  start           - Start local replica"
	@echo "  stop            - Stop local replica"
	@echo "  clean           - Remove build artifacts"
	@echo ""
	@echo "Examples:"
	@echo "  make build                # Build locally"
	@echo "  make release              # Build reproducible wasm"
	@echo "  make deploy TARGET=dev    # Deploy to dev"
	@echo "  make deploy TARGET=local  # Deploy to local replica"
