#!/usr/bin/env bash
# Download official ICP canister WASM files for testing
# Based on: https://github.com/dfinity/oisy-wallet

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}/.."
ASSETS_DIR="${PROJECT_DIR}/test-assets"
mkdir -p "${ASSETS_DIR}"

echo "Downloading canister WASM files to ${ASSETS_DIR}/..."

IC_COMMIT="03dd6ee6de80c2202f66948692c69c61eb6af54d"

DOWNLOAD_SCRIPT="${SCRIPT_DIR}/download-immutable.sh"

# Function to download WASM using immutable download script
download_wasm() {
  local url="$1"
  local dest="$2"

  if [ ! -f "${DOWNLOAD_SCRIPT}" ]; then
    echo "ERROR: download-immutable.sh not found at ${DOWNLOAD_SCRIPT}"
    echo "This script should be in scripts/ directory"
    exit 1
  fi

  bash "${DOWNLOAD_SCRIPT}" "${url}" "${dest}"
}

# ckBTC Minter
echo "Downloading ckBTC Minter WASM..."
download_wasm \
  "https://download.dfinity.systems/ic/${IC_COMMIT}/canisters/ic-ckbtc-minter.wasm.gz" \
  "${ASSETS_DIR}/ckbtc-minter.wasm.gz"

# ckBTC Ledger (ICRC-1)
echo "Downloading ckBTC Ledger WASM..."
download_wasm \
  "https://download.dfinity.systems/ic/${IC_COMMIT}/canisters/ic-icrc1-ledger.wasm.gz" \
  "${ASSETS_DIR}/ic-icrc1-ledger.wasm.gz"

# ckBTC Index (KYT)
echo "Downloading ckBTC Index (KYT) WASM..."
download_wasm \
  "https://download.dfinity.systems/ic/${IC_COMMIT}/canisters/ic-ckbtc-kyt.wasm.gz" \
  "${ASSETS_DIR}/ic-ckbtc-kyt.wasm.gz"

# ckBTC Index
echo "Downloading ckBTC Index WASM..."
download_wasm \
  "https://download.dfinity.systems/ic/${IC_COMMIT}/canisters/ic-icrc1-index-ng.wasm.gz" \
  "${ASSETS_DIR}/ic-icrc1-index-ng.wasm.gz"

# Download .did files
echo ""
echo "Downloading Candid interface files..."

# ckBTC Minter DID
curl -fsSL "https://raw.githubusercontent.com/dfinity/ic/${IC_COMMIT}/rs/bitcoin/ckbtc/minter/ckbtc_minter.did" \
  -o "${ASSETS_DIR}/ckbtc_minter.did"

# ckBTC Ledger DID
curl -fsSL "https://raw.githubusercontent.com/dfinity/ic/${IC_COMMIT}/rs/ledger_suite/icrc1/ledger/ledger.did" \
  -o "${ASSETS_DIR}/ledger.did"

# ckBTC KYT DID
curl -fsSL "https://raw.githubusercontent.com/dfinity/ic/${IC_COMMIT}/rs/bitcoin/ckbtc/kyt/kyt.did" \
  -o "${ASSETS_DIR}/ckbtc_kyt.did"

# ckBTC Index DID
curl -fsSL "https://raw.githubusercontent.com/dfinity/ic/${IC_COMMIT}/rs/ledger_suite/icrc1/index-ng/index-ng.did" \
  -o "${ASSETS_DIR}/ckbtc_index.did"

echo ""
echo "Downloads complete!"
echo ""
echo "Files downloaded:"
ls -lh "${ASSETS_DIR}"/*.wasm 2>/dev/null || echo "No WASM files (should be decompressed already)"
ls -lh "${ASSETS_DIR}"/*.did 2>/dev/null || echo "No DID files"
echo ""
echo "WASM files will be decompressed on-the-fly by the test runner."
