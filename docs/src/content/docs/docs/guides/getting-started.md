---
title: Getting started
description: How to run Nesso locally or on the web.
---

Nesso is available as a hosted web app, native desktop apps for macOS, x64 Windows, and x86_64 Linux, and as open-source code you can run locally. The web and desktop apps share the same graph model. Desktop apps add project folders and a file-system-backed workspace. See [FAQ](../../faq/#what-changes-between-the-web-app-and-the-desktop-app) for the full comparison.

## Tutorial

The simplest way to get started is the web app at [app.nesso.how](https://app.nesso.how), no install required. The first time you open Nesso, a **Welcome** screen appears and a sample graph (**Understanding**) is preloaded in the sidebar. **Show me how** starts a guided tour that walks you through the essentials, creating your own graph as you go (the tour suggests the name **Tutorial**):

1. **Welcome**: a short overview of typed knowledge graphs and spaced repetition.
2. **Guided tour**: coachmarks on the real UI that walk you through creating a new graph, adding and naming concepts, adding a definition in the inspector, connecting two ideas with a typed relation, opening **Review**, then deleting a node and the tour graph.
3. **Telemetry** (optional): a one-time banner in the top-right asks whether to share anonymous usage events.

You can skip the welcome screen or the tour at any step. To restart it later, open the **About** dialog from the menu bar.

## Desktop apps (macOS, x64 Windows, and x86_64 Linux)

### macOS

A pre-built installer is published on [GitHub Releases](https://github.com/nesso-how/nesso/releases). Download the universal `.dmg` (it runs on both Apple silicon and Intel Macs), drag **Nesso** to **Applications**, and open it.

### Windows (x64)

A pre-built installer is published on [GitHub Releases](https://github.com/nesso-how/nesso/releases). Download `Nesso_<version>_x64-setup.exe`, run it, and follow the installation prompts. This build is for x64 Windows.

### Linux (x86_64)

A self-contained AppImage is published on [GitHub Releases](https://github.com/nesso-how/nesso/releases). This build targets `x86_64` Linux; the supported baseline is Ubuntu 24.04. Download `Nesso_<version>_amd64.AppImage`, make it executable, and run it:

```sh
chmod +x Nesso_<version>_amd64.AppImage
./Nesso_<version>_amd64.AppImage
```

Other Linux distributions may work when they provide a compatible desktop/WebKitGTK environment. `.deb`, RPM, Flatpak, Snap, and ARM64 packages are not currently published.

:::caution[Windows installer warning]
The Windows installer is not Authenticode-signed, so Microsoft Defender SmartScreen may warn when you open it. Continue only if you downloaded it from the [official Nesso GitHub Release](https://github.com/nesso-how/nesso/releases). See [Microsoft Defender SmartScreen](../../troubleshooting/#microsoft-defender-smartscreen) for recovery steps.
:::

Desktop apps **update themselves**: on launch they check GitHub Releases and, when a newer build is available, offer to download and install it, then relaunch. If you update manually, use the universal `.dmg` for macOS, `Nesso_<version>_x64-setup.exe` for x64 Windows, or the x86_64 AppImage for Linux.

## Run from source

Requires [Node.js](https://nodejs.org/) 22+ and [pnpm](https://pnpm.io/) 10+.

```sh
git clone https://github.com/nesso-how/nesso.git
cd nesso
pnpm install
pnpm dev
```

For a desktop build, [Rust](https://rustup.rs/) is required as well:

```sh
pnpm build:desktop
```
