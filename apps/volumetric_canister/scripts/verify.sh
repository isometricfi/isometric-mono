#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CANISTER_DIR="$(dirname "$SCRIPT_DIR")"

cd "$CANISTER_DIR"

if [ ! -f "canister_ids.json" ]; then
    echo "Error: canister_ids.json not found"
    exit 1
fi

CANISTER_ID=$(cat canister_ids.json | grep -o '"ic": "[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CANISTER_ID" ]; then
    echo "Error: Could not read canister ID from canister_ids.json"
    exit 1
fi

echo "Fetching on-chain module hash for canister: $CANISTER_ID"
ONCHAIN_OUTPUT=$(dfx canister --network ic info "$CANISTER_ID" --identity anonymous 2>&1) || {
    echo "Error running dfx canister info:"
    echo "$ONCHAIN_OUTPUT"
    exit 1
}

ONCHAIN_HASH=$(echo "$ONCHAIN_OUTPUT" | grep "Module hash" | awk '{print $3}')

if [ -z "$ONCHAIN_HASH" ]; then
    echo "Error: Could not parse module hash from output:"
    echo "$ONCHAIN_OUTPUT"
    exit 1
fi

echo "On-chain hash: $ONCHAIN_HASH"

WASM_PATH="volumetric.wasm"
if [ ! -f "$WASM_PATH" ]; then
    WASM_PATH=".dfx/ic/canisters/volumetric_dev/volumetric_dev.wasm"
fi

if [ ! -f "$WASM_PATH" ]; then
    echo "Local Wasm not found"
    echo "Run 'make build-docker' or 'make build' first"
    exit 1
fi

LOCAL_HASH="0x$(sha256sum "$WASM_PATH" | awk '{print $1}')"
echo "Local hash:    $LOCAL_HASH ($WASM_PATH)"

if [ "$ONCHAIN_HASH" = "$LOCAL_HASH" ]; then
    echo ""
    echo "MATCH: The on-chain canister matches the local build"
    exit 0
else
    echo ""
    echo "MISMATCH: Hashes do not match"
    exit 1
fi
