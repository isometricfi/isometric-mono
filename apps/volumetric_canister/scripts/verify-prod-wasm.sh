#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CANISTER_DIR="$(dirname "$SCRIPT_DIR")"
cd "$CANISTER_DIR"

echo "Building production wasm (no --features testing)..."
cargo build --locked -p volumetric --target wasm32-unknown-unknown --release

WASM_PATH="$CANISTER_DIR/target/wasm32-unknown-unknown/release/volumetric.wasm"
if ! command -v candid-extractor >/dev/null 2>&1; then
  echo "Error: candid-extractor not found (install from dfinity/candid or ic-repl tooling)"
  exit 1
fi

OUT="$(mktemp)"
candid-extractor "$WASM_PATH" >"$OUT"

if grep -E '^\s+testing_' "$OUT"; then
  echo ""
  echo "Error: production wasm must not export methods named with the testing_ prefix."
  rm -f "$OUT"
  exit 1
fi

rm -f "$OUT"
echo "OK: production candid has no testing-only service methods."
