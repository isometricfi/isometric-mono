#!/bin/bash
set -e

export RUSTFLAGS="--remap-path-prefix $(readlink -f /canister)=/build --remap-path-prefix ${CARGO_HOME}=/cargo"

cargo build --locked --target wasm32-unknown-unknown --release

ic-wasm target/wasm32-unknown-unknown/release/volumetric.wasm -o volumetric.wasm shrink

echo ""
echo "Build complete!"
sha256sum volumetric.wasm

