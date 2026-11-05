#!/usr/bin/env bash
# Build all contracts to wasm. Run from contracts/.
set -euo pipefail

rustup target add wasm32-unknown-unknown >/dev/null 2>&1 || true

for crate in mandate task-market checkout; do
  echo "== building $crate =="
  cargo build -p "$crate" --target wasm32-unknown-unknown --release
done

mkdir -p ../out
cp target/wasm32-unknown-unknown/release/mandate.wasm ../out/mandate.wasm
cp target/wasm32-unknown-unknown/release/task_market.wasm ../out/task_market.wasm
cp target/wasm32-unknown-unknown/release/checkout.wasm ../out/checkout.wasm
echo "wasm artifacts in ../out/"
