.PHONY: build release deploy reinstall-local verify info clean start stop help

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
WASM_RELEASE := volumetric.wasm
WASM_LOCAL := volumetric.local.wasm

build:
	@echo "Building locally..."
	cargo build --locked --target wasm32-unknown-unknown --release
	ic-wasm target/wasm32-unknown-unknown/release/volumetric.wasm -o $(WASM_LOCAL) shrink
	@echo "Build complete: $(WASM_LOCAL)"
	@sha256sum $(WASM_LOCAL)

release:
	@echo "Building reproducible wasm with Docker..."
	docker build -t $(DOCKER_IMAGE) -f docker/Dockerfile .
	docker run --rm -v "$(PWD)":/canister $(DOCKER_IMAGE)

deploy:
ifeq ($(TARGET),local)
	@echo "Deploying to local..."
	dfx deploy $(CANISTER)
else
	@echo "Deploying $(WASM_RELEASE) to $(CANISTER) on $(NETWORK)..."
	@if [ ! -f "$(WASM_RELEASE)" ]; then \
		echo "Error: $(WASM_RELEASE) not found. Run 'make release' first."; \
		exit 1; \
	fi
	dfx canister install $(CANISTER) --network $(NETWORK) --mode upgrade --wasm $(WASM_RELEASE) --yes
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
	@echo "Release (Docker):  $$([ -f $(WASM_RELEASE) ] && sha256sum $(WASM_RELEASE) | awk '{print $$1}' || echo 'not built')"
	@echo "Local:             $$([ -f $(WASM_LOCAL) ] && sha256sum $(WASM_LOCAL) | awk '{print $$1}' || echo 'not built')"

start:
	dfx start --background

stop:
	dfx stop

clean:
	rm -rf .dfx target $(WASM_RELEASE) $(WASM_LOCAL)

help:
	@echo "Usage: make <target> [TARGET=dev|prod|local]"
	@echo ""
	@echo "Targets:"
	@echo "  build           - Build locally (fast, outputs volumetric.local.wasm)"
	@echo "  release         - Build with Docker (reproducible, outputs volumetric.wasm)"
	@echo "  deploy          - Deploy canister (local: dfx, mainnet: uses volumetric.wasm)"
	@echo "  reinstall-local - Reinstall local canister (wipes state)"
	@echo "  verify          - Verify local build matches on-chain"
	@echo "  info            - Show canister info"
	@echo "  hash            - Show wasm hashes"
	@echo "  start           - Start local replica"
	@echo "  stop            - Stop local replica"
	@echo "  clean           - Remove build artifacts"
	@echo ""
	@echo "Examples:"
	@echo "  make release              # Build reproducible wasm"
	@echo "  make deploy TARGET=dev    # Deploy to dev (uses volumetric.wasm)"
	@echo "  make deploy TARGET=local  # Deploy to local replica (dfx builds)"
