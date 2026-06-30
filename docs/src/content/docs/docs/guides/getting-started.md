---
title: Getting started
description: How to run Nesso locally or on the web.
---

Nesso is available as a hosted web app, a macOS desktop app, and as open-source code you can run locally. All three share the same graph model. The desktop app adds project folders and a file-system-backed workspace. See [FAQ](../../faq/#what-changes-between-the-web-app-and-the-desktop-app) for the full comparison.

## Tutorial

The simplest way to get started is the web app at [app.nesso.how](https://app.nesso.how), no install required. The first time you open Nesso, it starts with an empty **Tutorial** graph and walks you through the essentials:

1. **Welcome**: a short overview of typed knowledge graphs and spaced repetition.
2. **Guided tour**: coachmarks on the real UI that walk you through adding and naming concepts, adding a definition in the inspector, connecting two ideas with a typed relation, opening **Review**, then deleting a node and a graph.
3. **Telemetry** (optional): a one-time banner in the top-right asks whether to share anonymous usage events.

You can skip the welcome screen or the tour at any step. To restart it later, open the **About** dialog from the menu bar.

## Desktop app (macOS)

A pre-built alpha installer is published on [GitHub Releases](https://github.com/nesso-how/nesso/releases). Download the universal `.dmg` (it runs on both Apple silicon and Intel Macs) and open it.

:::caution
The app is not signed with an Apple developer certificate. macOS will block it on first launch. After installing, run this command in the terminal to remove the quarantine flag:

```sh
xattr -cr /Applications/Nesso.app
```

Then open the app normally.
:::

The desktop app **updates itself**: on launch it checks GitHub Releases and, when a newer build is available, offers to install it and relaunch.

## Run from source

Requires [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/).

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
