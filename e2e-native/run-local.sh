#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
#
# Run the native e2e lane (tauri-driver) locally inside Docker — the only way to
# exercise it on macOS, which has no native Tauri WebDriver. Host-safe: it streams
# a copy of the working tree into the container (no read-write mount), so the
# host's node_modules and build outputs are never touched. Failure diagnostics
# (rendered DOM + screenshots) land in e2e-native/artifacts/ on the host.
#
# Usage:
#   e2e-native/run-local.sh            # build image if missing, then run the lane
#   e2e-native/run-local.sh --rebuild  # force a fresh image build first
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${NESSO_E2E_IMAGE:-nesso-e2e-native:local}"

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Start Docker Desktop (or colima) and retry." >&2
  exit 1
fi

if [[ "${1:-}" == "--rebuild" ]] || ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "==> Building $IMAGE"
  docker build -t "$IMAGE" -f "$ROOT/e2e-native/Dockerfile" "$ROOT/e2e-native"
fi

ARTIFACTS="$ROOT/e2e-native/artifacts"
mkdir -p "$ARTIFACTS"

echo "==> Running native e2e lane in $IMAGE"
# Stream the working tree (minus the heavy, host-specific dirs) into the
# container; HUSKY=0 skips the git-hook install that `prepare` would attempt.
# COPYFILE_DISABLE stops macOS bsdtar from injecting AppleDouble `._*` sidecars,
# which would land in the container as invalid-UTF-8 files (e.g. Tauri reads every
# capabilities/*.json and chokes on `._default.json`).
COPYFILE_DISABLE=1 tar -C "$ROOT" \
    --exclude='./.git' \
    --exclude='*/node_modules' \
    --exclude='./src-tauri/target' \
    --exclude='./e2e-native/artifacts' \
    -cf - . \
  | docker run --rm -i \
      -v "$ARTIFACTS":/work/e2e-native/artifacts \
      -v nesso-e2e-node-modules:/work/node_modules \
      -v nesso-e2e-cargo-target:/work/src-tauri/target \
      -v nesso-e2e-cargo-registry:/usr/local/cargo/registry \
      -e CI=true -e HUSKY=0 \
      "$IMAGE" bash -lc '
        set -euo pipefail
        mkdir -p /work && tar -x -C /work
        cd /work
        corepack enable
        pnpm install --frozen-lockfile
        xvfb-run --auto-servernum pnpm run test:e2e:native
      '
