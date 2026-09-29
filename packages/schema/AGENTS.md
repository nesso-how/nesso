# @nesso/schema

- Keep this package independent of the app and its UI. Do not import app code, canvas or rendering libraries, or state-management libraries.
- Define only the graph data model, its JSON-LD profile, and framework-independent utilities. Do not put canvas-specific behavior or default relation vocabulary here.
- Keep package tests self-contained; do not load app data or fixtures.
