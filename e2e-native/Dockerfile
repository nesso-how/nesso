# syntax=docker/dockerfile:1
# SPDX-License-Identifier: MIT
#
# Pre-baked image for the native e2e lane (WebdriverIO + tauri-driver). It carries
# the full WebKitGTK *runtime* closure + WebKitWebDriver + xvfb + Node + Rust +
# tauri-driver, so both CI and local macOS runs (via Docker) skip the slow,
# mirror-dependent apt install entirely. The image is repo-agnostic — it installs
# only the toolchain; the source, deps and build come from the run, not the image.
#
# tauri-driver wraps WebKitWebDriver, so this only makes sense for linux/amd64
# (CI) and linux/arm64 (Apple Silicon under Docker). Build multi-arch.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# The Tauri `-dev` packages pull the full WebKit runtime closure (libwebkit2gtk,
# gstreamer, EGL, …) as ordinary apt dependencies — the closure the cached-apt
# action got wrong. webkit2gtk-driver provides /usr/bin/WebKitWebDriver; xvfb
# gives the headless X display the WebDriver session needs.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git xz-utils file \
      build-essential pkg-config libssl-dev \
      libwebkit2gtk-4.1-dev \
      libgtk-3-dev \
      librsvg2-dev \
      libayatana-appindicator3-dev \
      webkit2gtk-driver \
      xvfb \
    && rm -rf /var/lib/apt/lists/*

# Node 22 LTS + corepack. pnpm itself is resolved from the repo's packageManager
# field on first use, so the image is not pinned to a pnpm version.
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

# Rust toolchain + tauri-driver, baked so no per-run `cargo install`. The
# registry/git caches are dropped to keep the image lean; the app's own build
# re-fetches its crates at run time (cached by rust-cache in CI).
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH
RUN curl -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable \
    && cargo install tauri-driver --locked \
    && rm -rf "$CARGO_HOME/registry" "$CARGO_HOME/git"

# Sanity: both binaries the lane depends on must be on PATH.
RUN WebKitWebDriver --version >/dev/null 2>&1 || true; \
    command -v WebKitWebDriver && command -v tauri-driver

CMD ["bash"]
