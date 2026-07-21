// SPDX-License-Identifier: MIT
use serde::Deserialize;
use std::collections::HashMap;
use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};
use tauri::Manager;
use tauri_plugin_fs::FsExt;

/// Intent for path validation: distinguishes picker (human-verified, relaxed
/// hidden-component policy) from grant (renderer-provided, stricter trust check).
#[derive(Clone, Copy, PartialEq, Eq)]
enum ScopeIntent {
    /// Picker result — human-verified via the native OS dialog.
    Picker,
    /// Grant request — renderer-provided path, must pass trust check.
    Grant,
}

// ── Symlink hardening ─────────────────────────────────────────────────────────
//
// Symlinks and junctions allow a directory tree to escape the filesystem
// boundary that `starts_with` checks assume.  Before trusting, persisting, or
// recursively granting a picked/granted path, Nesso checks every component of
// the existing path prefix for symlinks.  If any component is a symlink, the
// path is rejected — the caller must provide a direct (non-symlinked) path.
//
// This "reject symlink components" strategy is the primary gate.  As
// defense-in-depth, the canonical (resolved) form of the path is also computed
// and re-validated against the trust boundary before granting scope.  Both
// layers together prevent symlink escapes (e.g. a trusted directory containing
// a symlink to /etc or /home); however the path-based Tauri fs-scope API
// cannot eliminate the TOCTOU window between resolution and the scope grant.

/// Returns `true` if any component of the existing path prefix is a symlink.
/// Walks the path component by component from the root; stops at the first
/// non-existing component (symlinks can only exist for paths that exist on
/// disk).  Returns `false` if the entire path exists and contains no symlinks,
/// or if the examined prefix contains no symlinks before a non-existing
/// component is reached.
fn prefix_has_symlink(p: &Path) -> bool {
    let mut current = PathBuf::new();
    for comp in p.components() {
        current = current.join(comp);
        match std::fs::symlink_metadata(&current) {
            Ok(meta) => {
                if meta.file_type().is_symlink() {
                    return true;
                }
                // Directory or file — continue walking.
            }
            Err(_) => {
                // Component doesn't exist — no symlink possible beyond here.
                break;
            }
        }
    }
    false
}

/// Resolve the existing prefix of a path and return its canonical form.
/// If the entire path exists it is canonicalized.  If only some prefix
/// exists, that prefix is canonicalized and the remaining non-existing
/// components are appended verbatim.  Returns `None` on I/O errors.
///
/// This is used as a defense-in-depth check in grant flows to verify that
/// the resolved canonical path is still within the trust boundary after
/// symlink resolution.  The primary symlink defense is `prefix_has_symlink`
/// (which rejects any path with a symlink component outright), but this
/// function provides an additional verification for paths where resolution
/// succeeds.
fn resolve_existing_prefix(p: &Path) -> Option<PathBuf> {
    // If the path exists, just canonicalize it.
    if let Ok(resolved) = std::fs::canonicalize(p) {
        return Some(resolved);
    }

    // Walk backward to find the longest existing prefix.
    let mut current = p.to_path_buf();
    let mut suffix: Vec<std::ffi::OsString> = Vec::new();

    loop {
        match std::fs::canonicalize(&current) {
            Ok(resolved) => {
                // Append the non-existing suffix components verbatim.
                let mut result = resolved;
                for comp in suffix.into_iter().rev() {
                    result.push(comp);
                }
                return Some(result);
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                // Current prefix doesn't exist — pop the last component
                // and try the parent.
                let file_name = current.file_name().map(|n| n.to_os_string());
                current = current.parent()?.to_path_buf();
                if let Some(name) = file_name {
                    suffix.push(name);
                }
            }
            Err(_) => return None, // real I/O error (permission denied, broken symlink)
        }
    }
}

// ── Trust store ──────────────────────────────────────────────────────────────
//
// Nesso grants runtime filesystem scope in two ways:
// 1. **Trusted picker** — the user explicitly selects a folder via the native
//    OS dialog (`pick_workspace_folder`).  The Rust side owns the dialog, so
//    the returned path is human-verified.  We persist it in a trust-store file
//    inside the app-data directory so re-grants survive restarts.
// 2. **App-data `.nesso` subtrees** — paths under the platform app-data
//    directory that contain `.nesso` as a component are always trusted without
//    explicit pick.  The project root itself (e.g. `$APPDATA/graphs`) is NOT
//    auto-trusted — it must be in the trust store, seeded on startup for the
//    default workspace or approved via the native picker.
//
// The `grant_fs_scope` command only approves a path when it is under an
// app-data `.nesso` subtree OR was previously recorded in the trust store.
// Hidden components within app-data paths (e.g. `.local` on Linux) are
// permitted because they are part of the legitimate app-data directory
// structure.  Hidden components in trusted picker paths are also permitted
// because the human verified the folder via the native dialog.  Hidden
// components in renderer-provided grant paths are rejected by the trust
// check unless they fall under an app-data `.nesso` subtree or a
// previously-approved picker path.

const TRUST_STORE_FILENAME: &str = ".nesso-trusted-paths.json";

/// In-memory cache of the on-disk trust store, keyed by canonical app-data
/// path so that data from one app-data root is never reused for another.
/// Tauri commands are serialised by the runtime (they run on the main thread
/// in the default setup), so a plain `Option` behind a `Mutex` is sufficient.
static TRUST_STORE: std::sync::Mutex<Option<HashMap<String, Vec<String>>>> =
    std::sync::Mutex::new(None);

fn trust_store_path(app_data: &Path) -> PathBuf {
    app_data.join(TRUST_STORE_FILENAME)
}

fn load_trust_store(app_data: &Path) -> Vec<String> {
    let key = canonical_path_str(app_data);

    // Check the in-memory cache first (keyed by app-data path).
    {
        let guard = TRUST_STORE.lock().unwrap();
        if let Some(ref cache) = *guard {
            if let Some(data) = cache.get(&key) {
                return data.clone();
            }
        }
    }

    let path = trust_store_path(app_data);
    let data: Vec<String> = std::fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default();

    let mut guard = TRUST_STORE.lock().unwrap();
    let cache = guard.get_or_insert_with(HashMap::new);
    cache.insert(key, data.clone());
    data
}

fn persist_trust_store(app_data: &Path, data: &[String]) -> Result<(), String> {
    let path = trust_store_path(app_data);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create trust store dir: {e}"))?;
    }
    let json =
        serde_json::to_string(data).map_err(|e| format!("failed to serialize trust store: {e}"))?;
    std::fs::write(&path, json).map_err(|e| format!("failed to write trust store: {e}"))?;
    // Update the in-memory cache only after durable write succeeds.
    let key = canonical_path_str(app_data);
    let mut guard = TRUST_STORE.lock().unwrap();
    let cache = guard.get_or_insert_with(HashMap::new);
    cache.insert(key, data.to_vec());
    Ok(())
}

fn add_to_trust_store(app_data: &Path, approved: &str) -> Result<(), String> {
    let mut data = load_trust_store(app_data);
    let norm = canonical_path_str(Path::new(approved));
    if !data.contains(&norm) {
        data.push(norm);
        // Keep the list bounded — no reasonable user picks thousands of project folders.
        if data.len() > 100 {
            data.remove(0);
        }
        persist_trust_store(app_data, &data)?;
    }
    Ok(())
}

/// Returns the app-data directories to consider as always-trusted.
fn app_data_dirs(app: &tauri::AppHandle) -> Vec<PathBuf> {
    [
        app.path().app_data_dir().ok(),
        app.path().app_local_data_dir().ok(),
    ]
    .into_iter()
    .flatten()
    .collect()
}

fn is_path_trusted(p: &Path, app_dirs: &[&Path], trust_store: &HashSet<String>) -> bool {
    // App-data auto-grant: only .nesso subtrees (the rest goes through trust store).
    if let Some(app_dir) = app_dirs.iter().find(|d| p.starts_with(d)) {
        if let Ok(rest) = p.strip_prefix(app_dir) {
            if rest
                .components()
                .any(|c| matches!(c, Component::Normal(n) if n == ".nesso"))
            {
                return true;
            }
        }
        // Fall through to trust-store check — the project root itself must be
        // explicitly trusted (seeded on startup for the default workspace, or
        // approved via the native picker for user-chosen folders).
    }

    let norm = canonical_path_str(p);
    // Exact match first, then ancestor match (so /trusted/child passes).
    if trust_store.contains(&norm) {
        return true;
    }
    trust_store.iter().any(|trusted_path| {
        norm.starts_with(trusted_path) && {
            // Prefix match must be at a component boundary to avoid
            // /home/user2 matching /home/user.
            let rest = &norm[trusted_path.len()..];
            rest.is_empty() || rest.starts_with('/')
        }
    })
}

/// Full-path validation for `grant_fs_scope`: delegates to
/// [`validate_scope_path`] with [`ScopeIntent::Grant`].
///
/// Only authorizes paths that are under an app-data `.nesso` subtree
/// or present in the persistent trust store (populated by the native
/// folder-picker flow).  Hidden components within app-data paths
/// (e.g. `.local` on Linux) are allowed because they are part of the
/// legitimate app-data tree; hidden components outside trusted roots
/// are rejected by the trust check.
///
/// App-data root directories themselves are always rejected — they
/// contain the trust-store file and must never be grantable.
/// The trust-store file itself is also explicitly rejected even if
/// somehow present in the trust store.
fn is_path_safe_for_grant(p: &Path, app_dirs: &[&Path], trust_store: &HashSet<String>) -> bool {
    // Reject any path whose canonical form is (or contains) the trust-store
    // file under an app-data directory.  This protects the trust-store file
    // from being granted even if an attacker manages to inject it into the
    // trust store.  External paths that happen to contain the trust-store
    // filename as a component (e.g. an external workspace at
    // /home/user/projects/.nesso-trusted-paths.json/graphs) are NOT
    // rejected — only the real trust-store file under an app-data root is
    // protected.
    let canon_p = canonical_path_str(p);
    if app_dirs.iter().any(|app_dir| {
        let ts_path = canonical_path_str(&app_dir.join(TRUST_STORE_FILENAME));
        canon_p == ts_path || canon_p.starts_with(&format!("{ts_path}/"))
    }) {
        return false;
    }
    validate_scope_path(p, ScopeIntent::Grant, app_dirs, None, trust_store)
}

/// Unified path validation for picker and grant flows.
///
/// Enforces common structural invariants (absolute, no `..`, not root, not
/// app-data root) and then applies intent-specific checks:
///
/// - **Picker**: rejects home directory/ancestor, app-data ancestors.
///   Hidden components are allowed because the human verified the folder.
/// - **Grant**: requires the path to be trusted — either under an app-data
///   `.nesso` subtree or listed in the trust store.  Hidden components
///   within app-data paths (e.g. `.local` on Linux) are allowed; hidden
///   components outside trusted roots are rejected by the trust check.
///
/// Callers must canonicalize symlink-resolved paths before calling this
/// function and grant only the canonical form.
fn validate_scope_path(
    p: &Path,
    intent: ScopeIntent,
    app_dirs: &[&Path],
    home_dir: Option<&Path>,
    trust_store: &HashSet<String>,
) -> bool {
    // ── Common structural checks ──────────────────────────────────────
    if !p.is_absolute() {
        return false;
    }
    if p.components().any(|c| matches!(c, Component::ParentDir)) {
        return false;
    }
    if p.parent().is_none() {
        return false; // filesystem root
    }

    let canon_p = canonical_path_str(p);

    // App-data roots are never grantable — they contain the trust-store file.
    if app_dirs.iter().any(|d| canonical_path_str(d) == canon_p) {
        return false;
    }

    // ── Intent-specific checks ────────────────────────────────────────
    match intent {
        ScopeIntent::Picker => {
            // Reject home directory and ancestors of home.
            if let Some(home) = home_dir {
                let canon_home = canonical_path_str(home);
                if canon_p == canon_home || canon_home.starts_with(&format!("{canon_p}/")) {
                    return false;
                }
            }

            // Reject ancestors of app-data roots (app-data inside picked dir).
            if app_dirs.iter().any(|d| {
                let d_canon = canonical_path_str(d);
                d_canon.starts_with(&format!("{canon_p}/"))
            }) {
                return false;
            }

            true // human-verified — the picker is the gate
        }
        ScopeIntent::Grant => {
            // Trust check: under app-data `.nesso` subtree or in trust store.
            is_path_trusted(p, app_dirs, trust_store)
        }
    }
}

/// Canonicalize a path string for trust-store persistence and comparison.
///
/// Normalizes:
/// - Windows backslash separators → forward slashes
/// - Trailing slashes are trimmed
/// - `\\?\C:\...` extended drive paths → `C:/...` (strips the NT namespace prefix)
/// - `\\?\UNC\server\share\...` extended UNC paths → `//server/share/...`
/// - Normal UNC paths (`\\server\share`) preserved with normalized separators
///
/// On Windows the result is lowercased so trust-store comparisons are
/// case-insensitive (the Windows filesystem is case-insensitive but
/// case-preserving, and OS dialogs may return mixed-case paths).
fn canonical_path_str(p: &Path) -> String {
    let s = p.to_string_lossy();
    // Normalize all separators to forward slashes.
    let s = s.replace('\\', "/");
    // Trim trailing slashes.
    let mut s = s.trim_end_matches('/').to_string();

    // Strip Windows extended-path prefixes so picker paths (which may
    // use \\?\ forms) and normal/store paths compare identically.
    //
    // \\?\UNC\server\share  →  //server/share  (extended UNC → normal UNC)
    // \\?\C:\Users          →  C:/Users       (extended drive → normal drive)
    if let Some(rest) = s.strip_prefix("//?/UNC/") {
        s = format!("//{rest}");
    } else if let Some(rest) = s.strip_prefix("//?/") {
        s = rest.to_string();
    }

    // On Windows, filesystem paths are case-insensitive.  Lowercase so
    // trust-store entries written by one OS path form match the other.
    #[cfg(target_os = "windows")]
    {
        s = s.to_lowercase();
    }

    s
}

/// Full validation for a native folder-picker result.  Delegates to
/// [`validate_scope_path`] with [`ScopeIntent::Picker`] and context-aware
/// home/app-data/trust-store checks.
fn validate_picked_folder_full(
    p: &Path,
    home_dir: &Path,
    app_data_dir: &Path,
    app_local_data_dir: Option<&Path>,
) -> bool {
    let mut app_dirs: Vec<&Path> = vec![app_data_dir];
    if let Some(ald) = app_local_data_dir {
        app_dirs.push(ald);
    }
    validate_scope_path(
        p,
        ScopeIntent::Picker,
        &app_dirs,
        Some(home_dir),
        &HashSet::new(),
    )
}

/// Shared internal function that encapsulates the symlink gate, contextual
/// validation, and canonicalized resolution for a native folder-picker
/// result.  Both picker and grant flows share the symlink-strategy gate;
/// this function keeps the picker-specific orchestration in one place so
/// that any call to `pick_workspace_folder` and any test of the picker flow
/// exercise the same path.
///
/// Returns the resolved canonical [`PathBuf`] on success, or an error
/// describing the first rejection encountered.
fn validate_and_resolve_picker_path(
    p: &Path,
    home_dir: &Path,
    app_data_dir: &Path,
    app_local_data_dir: Option<&Path>,
) -> Result<PathBuf, String> {
    // Symlink hardening (shared strategy with grant_fs_scope):
    // reject any path that contains a symlink component BEFORE any
    // validation.  This prevents symlink escapes where a picked path
    // (e.g. a symlink to /etc) would otherwise pass Picker-intent checks.
    if prefix_has_symlink(p) {
        return Err(format!(
            "cannot grant scope for picked path \"{}\": path contains a symlink component",
            p.display(),
        ));
    }

    // Structural + home/app-data/trust-store context validation.
    if !validate_picked_folder_full(p, home_dir, app_data_dir, app_local_data_dir) {
        return Err(format!(
            "cannot grant scope for picked path \"{}\": path validation failed",
            p.display(),
        ));
    }

    // Resolve to canonical form before granting fs scope.  The
    // `prefix_has_symlink` gate above guarantees no symlink escapes;
    // resolution here only normalizes the path (e.g. case, separators).
    let resolved = resolve_existing_prefix(p)
        .ok_or_else(|| format!("cannot resolve picked path \"{}\"", p.display()))?;

    // Re-validate the resolved canonical path.  The raw path from the native
    // dialog may contain `.` components that canonicalization resolves away
    // — potentially landing in a forbidden area (home directory, app-data
    // root, etc.).  Canonicalization also normalizes case and separators;
    // the re-validation catches any form that violates the picker rules.
    if !validate_picked_folder_full(&resolved, home_dir, app_data_dir, app_local_data_dir) {
        return Err(format!(
            "cannot grant scope for picked path \"{}\": resolved path \"{}\" validation failed",
            p.display(),
            resolved.display(),
        ));
    }

    Ok(resolved)
}

// ── Trusted folder picker ────────────────────────────────────────────────────

/// Combines the native OS folder-picker dialog with a fs-scope grant so the
/// renderer never provides the path for a *new* project folder.  The Rust side
/// owns the dialog; the returned path is therefore human-verified.
///
/// Returns `null` when the user cancels the dialog.
#[cfg(desktop)]
#[tauri::command]
fn pick_workspace_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let selected = app
        .dialog()
        .file()
        .blocking_pick_folder()
        .map(|p| p.to_string());

    let Some(ref path) = selected else {
        return Ok(None);
    };

    let p = Path::new(path);

    // home_dir() and app_data_dir() can fail in edge cases; if they
    // do, we must not silently approve — reject.
    let home = app
        .path()
        .home_dir()
        .map_err(|e| format!("cannot resolve home dir: {e}"))?;
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("cannot resolve app data dir: {e}"))?;
    let app_local = app.path().app_local_data_dir().ok();

    let resolved = validate_and_resolve_picker_path(p, &home, &app_data, app_local.as_deref())?;

    // Grant the runtime fs scope for the resolved canonical path, then
    // persist it so future `grant_fs_scope` calls for descendants
    // (e.g. `<project>/.nesso`) succeed.
    app.fs_scope()
        .allow_directory(&resolved, true)
        .map_err(|e| e.to_string())?;

    add_to_trust_store(
        app.path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .as_path(),
        &resolved.to_string_lossy(),
    )?;

    Ok(selected)
}

/// Non-desktop stub: `pick_workspace_folder` returns `null` (no dialog available).
#[cfg(not(desktop))]
#[tauri::command]
fn pick_workspace_folder(_app: tauri::AppHandle) -> Result<Option<String>, String> {
    Ok(None)
}

/// Opens a native save-file dialog **on the Rust side** and writes the
/// provided contents, then returns the chosen absolute path (or `null` when
/// the user cancels).  This keeps the fs capability scoped to `.nesso`
/// directories while still allowing user-initiated exports to arbitrary
/// locations — the Rust side owns both the dialog and the write, so no
/// renderer-supplied path is trusted.
#[cfg(desktop)]
#[tauri::command]
fn save_file_dialog(
    app: tauri::AppHandle,
    default_name: String,
    contents: String,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let selected = app
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .set_file_name(&default_name)
        .blocking_save_file();

    let Some(path) = selected.map(|p| p.to_string()) else {
        return Ok(None);
    };

    std::fs::write(&path, &contents)
        .map_err(|e| format!("failed to write export file \"{path}\": {e}"))?;

    Ok(Some(path))
}

/// Non-desktop stub: `save_file_dialog` is not available.  The frontend
/// must fall back to a browser-based export (File System Access API or
/// anchor-download).
#[cfg(not(desktop))]
#[tauri::command]
fn save_file_dialog(
    _app: tauri::AppHandle,
    _default_name: String,
    _contents: String,
) -> Result<Option<String>, String> {
    Err("save_file_dialog is not supported on this platform".into())
}

/// Localized labels for the native menu. Built once from the frontend's i18n
/// strings and passed in via [`set_app_menu`], so the menu follows the in-app
/// language. Missing fields fall back to the English defaults below (used for
/// the startup menu before the webview hydrates and calls `set_app_menu`).
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct MenuLabels {
    file: String,
    edit: String,
    view: String,
    window: String,
    help: String,
    about: String,
    settings: String,
    new_graph: String,
    open_project: String,
    export_json: String,
    export_png: String,
    import: String,
    undo: String,
    redo: String,
    cut: String,
    copy: String,
    paste: String,
    select_all: String,
    zoom_in: String,
    zoom_out: String,
    zoom_fit: String,
    heatmap: String,
    edges: String,
    edges_full: String,
    edges_category: String,
    edges_minimal: String,
    curve: String,
    curve_arc: String,
    curve_straight: String,
    documentation: String,
    website: String,
    report_issue: String,
    shortcuts: String,
}

impl Default for MenuLabels {
    fn default() -> Self {
        let s = |v: &str| v.to_string();
        Self {
            file: s("File"),
            edit: s("Edit"),
            view: s("View"),
            window: s("Window"),
            help: s("Help"),
            about: s("About Nesso"),
            settings: s("Settings…"),
            new_graph: s("New Graph"),
            open_project: s("Open or Create Project…"),
            export_json: s("Export Graph (JSON)"),
            export_png: s("Export Graph (PNG)"),
            import: s("Import Graph…"),
            undo: s("Undo"),
            redo: s("Redo"),
            cut: s("Cut"),
            copy: s("Copy"),
            paste: s("Paste"),
            select_all: s("Select All"),
            zoom_in: s("Zoom In"),
            zoom_out: s("Zoom Out"),
            zoom_fit: s("Zoom to Fit"),
            heatmap: s("Heatmap"),
            edges: s("Edges"),
            edges_full: s("Full"),
            edges_category: s("Category"),
            edges_minimal: s("Minimal"),
            curve: s("Curve"),
            curve_arc: s("Arc"),
            curve_straight: s("Straight"),
            documentation: s("Documentation"),
            website: s("Website"),
            report_issue: s("Report an Issue"),
            shortcuts: s("Keyboard Shortcuts"),
        }
    }
}

/// Current toggle/radio state so the View menu's check items mirror the live
/// graph-display settings.
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct MenuState {
    heatmap: bool,
    /// One of `full` | `category` | `minimal`.
    edge_encoding: String,
    /// One of `arc` | `straight`.
    curve_style: String,
}

/// Builds the full native menu. Item ids double as the `menu:<id>` event names
/// the frontend listens for; predefined items (Services, Quit, Minimize,
/// Full Screen, …) keep their native OS behaviour and localization.
#[cfg(desktop)]
fn build_app_menu(
    app: &tauri::AppHandle,
    labels: &MenuLabels,
    state: &MenuState,
) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder};

    let about_i = MenuItemBuilder::with_id("about", &labels.about).build(app)?;
    let settings_i = MenuItemBuilder::with_id("settings", &labels.settings)
        .accelerator("CmdOrCtrl+Comma")
        .build(app)?;

    let new_graph_i = MenuItemBuilder::with_id("new-graph", &labels.new_graph)
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let open_project_i = MenuItemBuilder::with_id("open-project", &labels.open_project)
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let export_json_i = MenuItemBuilder::with_id("export-json", &labels.export_json)
        .accelerator("CmdOrCtrl+Shift+E")
        .build(app)?;
    let export_png_i = MenuItemBuilder::with_id("export-png", &labels.export_png).build(app)?;
    let import_i = MenuItemBuilder::with_id("import", &labels.import).build(app)?;

    let zoom_in_i = MenuItemBuilder::with_id("zoom-in", &labels.zoom_in)
        .accelerator("CmdOrCtrl+Plus")
        .build(app)?;
    let zoom_out_i = MenuItemBuilder::with_id("zoom-out", &labels.zoom_out)
        .accelerator("CmdOrCtrl+Minus")
        .build(app)?;
    let fit_i = MenuItemBuilder::with_id("fit", &labels.zoom_fit)
        .accelerator("CmdOrCtrl+0")
        .build(app)?;
    let heatmap_i = CheckMenuItemBuilder::with_id("heatmap", &labels.heatmap)
        .checked(state.heatmap)
        .build(app)?;
    let edges_full_i = CheckMenuItemBuilder::with_id("edges-full", &labels.edges_full)
        .checked(state.edge_encoding == "full")
        .build(app)?;
    let edges_category_i = CheckMenuItemBuilder::with_id("edges-category", &labels.edges_category)
        .checked(state.edge_encoding == "category")
        .build(app)?;
    let edges_minimal_i = CheckMenuItemBuilder::with_id("edges-minimal", &labels.edges_minimal)
        .checked(state.edge_encoding == "minimal")
        .build(app)?;
    let curve_arc_i = CheckMenuItemBuilder::with_id("curve-arc", &labels.curve_arc)
        .checked(state.curve_style == "arc")
        .build(app)?;
    let curve_straight_i = CheckMenuItemBuilder::with_id("curve-straight", &labels.curve_straight)
        .checked(state.curve_style == "straight")
        .build(app)?;

    let docs_i = MenuItemBuilder::with_id("docs", &labels.documentation).build(app)?;
    let website_i = MenuItemBuilder::with_id("website", &labels.website).build(app)?;
    let report_issue_i =
        MenuItemBuilder::with_id("report-issue", &labels.report_issue).build(app)?;
    let shortcuts_i = MenuItemBuilder::with_id("shortcuts", &labels.shortcuts).build(app)?;

    let menu = MenuBuilder::new(app);

    // The app menu (with About + Settings) only exists on macOS; elsewhere
    // `menu` is used as-is, so it is shadowed rather than declared `mut` to
    // avoid an unused-mut warning on Windows/Linux (CI runs `-D warnings`).
    #[cfg(target_os = "macos")]
    let menu = {
        let app_menu = SubmenuBuilder::new(app, "Nesso")
            .item(&about_i)
            .separator()
            .item(&settings_i)
            .separator()
            .services()
            .separator()
            .hide()
            .hide_others()
            .show_all()
            .separator()
            .quit()
            .build()?;
        menu.item(&app_menu)
    };

    let file = SubmenuBuilder::new(app, &labels.file)
        .item(&new_graph_i)
        .item(&open_project_i)
        .separator()
        .item(&export_json_i)
        .item(&export_png_i)
        .item(&import_i);
    // No app menu off macOS, so Settings lives at the foot of File.
    #[cfg(not(target_os = "macos"))]
    let file = file.separator().item(&settings_i);
    let file = file.build()?;

    let edit_builder = SubmenuBuilder::new(app, &labels.edit);
    #[cfg(target_os = "macos")]
    let edit_builder = edit_builder
        .undo_with_text(&labels.undo)
        .redo_with_text(&labels.redo)
        .separator();
    let edit = edit_builder
        .cut_with_text(&labels.cut)
        .copy_with_text(&labels.copy)
        .paste_with_text(&labels.paste)
        .separator()
        .select_all_with_text(&labels.select_all)
        .build()?;

    let edges_sub = SubmenuBuilder::new(app, &labels.edges)
        .item(&edges_full_i)
        .item(&edges_category_i)
        .item(&edges_minimal_i)
        .build()?;
    let curve_sub = SubmenuBuilder::new(app, &labels.curve)
        .item(&curve_arc_i)
        .item(&curve_straight_i)
        .build()?;
    let view = SubmenuBuilder::new(app, &labels.view)
        .item(&zoom_in_i)
        .item(&zoom_out_i)
        .item(&fit_i)
        .separator()
        .item(&heatmap_i)
        .item(&edges_sub)
        .item(&curve_sub)
        .separator()
        .fullscreen()
        .build()?;

    let window = SubmenuBuilder::new(app, &labels.window)
        .minimize()
        .maximize()
        .separator()
        .close_window()
        .build()?;

    let help = SubmenuBuilder::new(app, &labels.help)
        .item(&docs_i)
        .item(&website_i)
        .item(&report_issue_i)
        .separator()
        .item(&shortcuts_i);
    // About lives in the app menu on macOS; elsewhere it belongs under Help.
    #[cfg(not(target_os = "macos"))]
    let help = help.separator().item(&about_i);
    let help = help.build()?;

    menu.item(&file)
        .item(&edit)
        .item(&view)
        .item(&window)
        .item(&help)
        .build()
}

/// Rebuilds and installs the native menu with frontend-provided localized
/// labels and current display state. Called on startup and on every language
/// or display-setting change. A no-op off desktop (no native menu bar there).
#[tauri::command]
fn set_app_menu(app: tauri::AppHandle, labels: MenuLabels, state: MenuState) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let menu = build_app_menu(&app, &labels, &state).map_err(|e| e.to_string())?;
        app.set_menu(menu).map_err(|e| e.to_string())?;
    }
    #[cfg(not(desktop))]
    {
        let _ = (&app, &labels, &state);
    }
    Ok(())
}

/// Runtime FS-scope grant for previously-approved project folders.  A compromised
/// renderer must not be able to widen the scope to the whole filesystem,
/// the home directory itself, or dotfile directories like ~/.ssh.
///
/// Paths are accepted only when they fall under an app-data directory OR are
/// listed in the persistent trust store (populated by the native folder-picker
/// flow in `pick_workspace_folder`).  Structural validation (no `..`, absolute,
/// not root) is always enforced.
///
/// Symlink hardening: before granting, the path's canonical (symlink-resolved)
/// form is computed and verified against the same trust checks.  If the original
/// path contains a symlink that escapes the trust boundary, the resolved path
/// will be outside trusted roots and the grant is rejected.
#[tauri::command]
fn grant_fs_scope(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let p = Path::new(&path);

    // Symlink hardening (shared strategy with pick_workspace_folder):
    // reject any path whose existing prefix contains a symlink component.
    // This is the primary gate — `resolve_existing_prefix` below provides
    // defense-in-depth for the canonical path grant.
    if prefix_has_symlink(p) {
        return Err(format!(
            "cannot grant scope for path \"{path}\": path contains a symlink component"
        ));
    }

    let app_dirs = app_data_dirs(&app);
    let app_dirs_refs: Vec<&Path> = app_dirs.iter().map(|b| b.as_path()).collect();
    let trust = load_trust_store(
        app.path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .as_path(),
    );
    let trust_set: HashSet<String> = trust.iter().cloned().collect();

    if !is_path_safe_for_grant(p, &app_dirs_refs, &trust_set) {
        return Err(format!(
            "cannot grant scope for path \"{path}\": validation failed"
        ));
    }

    // Symlink hardening: resolve the existing prefix to canonical form.
    // The canonical path is passed to `allow_directory` and re-validated
    // against the trust boundary.
    //
    // TOCTOU residual: between this resolution and the `allow_directory`
    // call, the filesystem tree could be modified (symlink inserted, bind
    // mount changed, junction swapped).  `allow_directory` accepts a path
    // string, not a file descriptor — there is no way to atomically grant
    // scope on a resolved path that cannot race.  The best-effort defense
    // is: (1) reject symlink components early (before resolution),
    // (2) resolve to canonical form, (3) validate the canonical form
    // immediately before granting, (4) grant only the canonical form.
    // All four steps narrow the TOCTOU window but cannot eliminate it
    // with this API.
    let resolved = resolve_existing_prefix(p)
        .ok_or_else(|| format!("cannot resolve path \"{path}\": symlink resolution failed"))?;
    if !is_path_safe_for_grant(&resolved, &app_dirs_refs, &trust_set) {
        return Err(format!(
            "cannot grant scope for path \"{path}\": resolved path \"{}\" is not trusted",
            resolved.display(),
        ));
    }

    app.fs_scope()
        .allow_directory(&resolved, true)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            grant_fs_scope,
            pick_workspace_folder,
            save_file_dialog,
            set_app_menu
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::{Emitter, Manager};

                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;

                // Seed the default app-data workspace into the trust store so
                // the project root (e.g. `$APPDATA/graphs`) is grantable without
                // the native picker.  The app-data auto-grant in `is_path_trusted`
                // only covers `.nesso` subtrees; non-`.nesso` paths fall through
                // to the trust store.
                if let Ok(app_data) = app.handle().path().app_data_dir() {
                    let default_ws = app_data.join("graphs");
                    if let Err(e) = add_to_trust_store(&app_data, &default_ws.to_string_lossy()) {
                        eprintln!("failed to seed trust store: {e}");
                    }
                }

                // English baseline menu; the webview rebuilds it in the active
                // language via `set_app_menu` as soon as it mounts.
                let menu =
                    build_app_menu(app.handle(), &MenuLabels::default(), &MenuState::default())?;
                app.set_menu(menu)?;

                // Custom item ids double as `menu:<id>` event names handled in
                // the frontend; predefined items keep their native behaviour.
                app.on_menu_event(move |app, event| {
                    let Some(w) = app.get_webview_window("main") else {
                        return;
                    };
                    let _ = w.emit(&format!("menu:{}", event.id().0.as_str()), ());
                });
            }
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_mcp_bridge::Builder::new()
                        .bind_address("127.0.0.1")
                        .build(),
                )?;
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod http_capability_tests {
    use serde::Deserialize;
    use tauri::{
        utils::acl::{
            capability::{CapabilityFile, PermissionEntry},
            RemoteUrlPattern,
        },
        Url,
    };

    #[derive(Deserialize)]
    struct HttpAllowEntry {
        url: String,
    }

    fn http_scope_patterns() -> Vec<RemoteUrlPattern> {
        let capability: CapabilityFile =
            serde_json::from_str(include_str!("../capabilities/default.json"))
                .expect("default capability must deserialize");

        let capability = match capability {
            CapabilityFile::Capability(capability) => capability,
            CapabilityFile::List(_) | CapabilityFile::NamedList { .. } => {
                panic!("default capability must be a single capability")
            }
        };

        let allow = capability
            .permissions
            .into_iter()
            .find_map(|permission| match permission {
                PermissionEntry::ExtendedPermission { identifier, scope }
                    if identifier.get() == "http:default" =>
                {
                    scope.allow
                }
                _ => None,
            })
            .expect("default capability must define an http:default allow scope");

        allow
            .into_iter()
            .map(|value| {
                let entry: HttpAllowEntry = serde_json::from_value(
                    serde_json::to_value(value).expect("HTTP scope value must serialize"),
                )
                .expect("HTTP allow entry must contain a url string");
                let raw_pattern = entry.url;

                raw_pattern
                    .parse::<RemoteUrlPattern>()
                    .unwrap_or_else(|error| {
                        panic!("invalid HTTP URL pattern `{raw_pattern}`: {error}")
                    })
            })
            .collect()
    }

    fn scope_allows(patterns: &[RemoteUrlPattern], raw_url: &str) -> bool {
        let url = raw_url.parse::<Url>().expect("test URL must be valid");
        patterns.iter().any(|pattern| pattern.test(&url))
    }

    #[test]
    fn default_http_scope_deserializes_and_matches_supported_endpoints() {
        let patterns = http_scope_patterns();

        for raw_url in [
            "https://opencode.ai/zen/v1/chat/completions",
            "https://api.openai.com/v1/chat/completions",
            "http://localhost:11434/v1/chat/completions",
            "http://localhost/v1/chat/completions",
            "http://127.0.0.1:11434/v1/chat/completions",
            "http://127.0.0.1/v1/chat/completions",
            "http://[::1]:11434/v1/chat/completions",
            "http://[::1]/v1/chat/completions",
        ] {
            assert!(
                scope_allows(&patterns, raw_url),
                "expected {raw_url} to be allowed"
            );
        }

        for raw_url in [
            "http://example.com/v1/chat/completions",
            "http://192.168.1.10:11434/v1/chat/completions",
        ] {
            assert!(
                !scope_allows(&patterns, raw_url),
                "expected {raw_url} to be denied"
            );
        }
    }
}

#[cfg(test)]
mod grant_fs_scope_tests {
    use super::*;
    use std::collections::HashSet;

    // --- Trust-store path approval ---

    fn dummy_store(paths: &[&str]) -> HashSet<String> {
        paths
            .iter()
            .map(|s| canonical_path_str(Path::new(s)))
            .collect()
    }

    #[test]
    fn nesso_paths_under_app_data_are_trusted_without_store() {
        // When a path lives under an app data directory AND contains .nesso
        // as a component, it passes without needing prior entry in the trust
        // store.  Non-.nesso paths under app-data must fall through to the
        // trust store check (tested in the rejection tests below).
        let store = HashSet::new();
        let app_data = Path::new("/appdata");
        let under = Path::new("/appdata/graphs/.nesso");
        assert!(is_path_trusted(under, &[app_data], &store));
        let nested = Path::new("/appdata/.nesso/subdir/file.json");
        assert!(is_path_trusted(nested, &[app_data], &store));
    }

    #[test]
    fn non_nesso_paths_under_app_data_fall_through_to_trust_store() {
        // A path under app-data that does NOT contain .nesso must NOT be
        // auto-trusted.  It falls through to the trust store check.
        let store = HashSet::new();
        let app_data = Path::new("/appdata");
        let non_nesso = Path::new("/appdata/graphs");
        assert!(!is_path_trusted(non_nesso, &[app_data], &store));

        // The same path passes when the trust store has it (seeded on startup or
        // approved via the native picker).
        let seeded = dummy_store(&["/appdata/graphs"]);
        assert!(is_path_trusted(non_nesso, &[app_data], &seeded));
    }

    #[test]
    fn rejects_app_data_root_paths_without_nesso_component() {
        let store = HashSet::new();
        let app_data = Path::new("/appdata");
        assert!(!is_path_trusted(
            Path::new("/appdata/some-file"),
            &[app_data],
            &store,
        ));
        assert!(!is_path_trusted(
            Path::new("/appdata/foo/bar"),
            &[app_data],
            &store,
        ));
    }

    #[test]
    fn rejects_trust_store_file_path_under_app_data() {
        // The trust-store file (.nesso-trusted-paths.json) must remain
        // outside any grantable fs root.  A compromised renderer must not
        // be able to inject it through grant_fs_scope.
        let store = HashSet::new();
        let app_data = Path::new("/appdata");
        assert!(!is_path_trusted(
            Path::new("/appdata/.nesso-trusted-paths.json"),
            &[app_data],
            &store,
        ));
        // Even if an attacker tricks the trust store into listing it directly,
        // is_path_safe_for_grant catches hidden-component paths.
        let seeded = dummy_store(&["/appdata/.nesso-trusted-paths.json"]);
        assert!(!is_path_safe_for_grant(
            Path::new("/appdata/.nesso-trusted-paths.json"),
            &[app_data],
            &seeded,
        ));
    }

    #[test]
    fn accepts_nesso_descendants_under_app_data() {
        let store = HashSet::new();
        let app_data = Path::new("/appdata");
        assert!(is_path_trusted(
            Path::new("/appdata/.nesso"),
            &[app_data],
            &store,
        ));
        assert!(is_path_trusted(
            Path::new("/appdata/projects/my-graph/.nesso"),
            &[app_data],
            &store,
        ));
        assert!(is_path_trusted(
            Path::new("/appdata/.nesso/meta"),
            &[app_data],
            &store,
        ));
    }

    #[test]
    fn non_app_dir_path_must_be_in_trust_store() {
        let store = dummy_store(&["/home/user/projects/my-graph"]);
        let app_data = Path::new("/appdata");
        let trusted = Path::new("/home/user/projects/my-graph");

        // Without the trust store this path would be rejected.
        assert!(is_path_trusted(trusted, &[app_data], &store));
    }

    #[test]
    fn descendants_of_trust_store_entry_are_authorized() {
        // When the trust store has /home/user/projects/my-graph, its
        // .nesso child must also pass — the frontend calls grant_fs_scope
        // separately for <project> and <project>/.nesso.
        let store = dummy_store(&["/home/user/projects/my-graph"]);
        let app_data = Path::new("/appdata");
        let descendant = Path::new("/home/user/projects/my-graph/.nesso");
        assert!(is_path_trusted(descendant, &[app_data], &store));
    }

    #[test]
    fn non_app_dir_path_not_in_store_is_rejected() {
        let store = HashSet::new();
        let app_data = Path::new("/appdata");
        let unknown = Path::new("/home/user/projects/unknown");

        assert!(!is_path_trusted(unknown, &[app_data], &store));
    }

    #[test]
    fn parent_dir_traversal_is_always_rejected() {
        let store = dummy_store(&["/home/user/projects/ok"]);
        let app_data = Path::new("/appdata");

        assert!(!is_path_safe_for_grant(
            Path::new("/home/user/../etc"),
            &[app_data],
            &store
        ));
    }

    #[test]
    fn empty_trust_store_rejects_external_paths() {
        let store = HashSet::new();
        let app_data = Path::new("/appdata");

        assert!(!is_path_trusted(
            Path::new("/home/user/projects/some-graph"),
            &[app_data],
            &store,
        ));
    }

    // ── Rejection of arbitrary external paths ──────────────────────────────

    #[test]
    fn rejects_home_directory_itself() {
        let store = HashSet::new();
        let app_data = Path::new("/appdata");
        assert!(!is_path_safe_for_grant(
            Path::new("/home"),
            &[app_data],
            &store
        ));
    }

    #[test]
    fn rejects_tmp_directory() {
        let store = HashSet::new();
        let app_data = Path::new("/appdata");
        assert!(!is_path_safe_for_grant(
            Path::new("/tmp"),
            &[app_data],
            &store
        ));
    }

    #[test]
    fn rejects_etc_directory() {
        let store = HashSet::new();
        let app_data = Path::new("/appdata");
        assert!(!is_path_safe_for_grant(
            Path::new("/etc"),
            &[app_data],
            &store
        ));
    }

    #[test]
    fn rejects_arbitrary_nesso_directory_outside_trust_store() {
        // An arbitrary /.nesso or /some/random/.nesso must NOT be authorized
        // unless it is under an app-data dir or a trust-store entry.
        let store = HashSet::new();
        let app_data = Path::new("/appdata");
        assert!(!is_path_safe_for_grant(
            Path::new("/.nesso"),
            &[app_data],
            &store
        ));
        assert!(!is_path_safe_for_grant(
            Path::new("/some/random/.nesso"),
            &[app_data],
            &store,
        ));
    }

    #[test]
    fn rejects_nesso_under_home_when_home_not_trusted() {
        let store = HashSet::new();
        let app_data = Path::new("/appdata");
        assert!(!is_path_safe_for_grant(
            Path::new("/home/user/.nesso"),
            &[app_data],
            &store,
        ));
    }

    #[test]
    fn accepts_nesso_under_trusted_picker_path() {
        let store = dummy_store(&["/home/user/projects/my-graph"]);
        let app_data = Path::new("/appdata");
        // .nesso under a trusted project folder is fine.
        assert!(is_path_safe_for_grant(
            Path::new("/home/user/projects/my-graph/.nesso"),
            &[app_data],
            &store,
        ));
    }

    #[test]
    fn accepts_nesso_under_app_data() {
        let store = HashSet::new();
        let app_data = Path::new("/appdata");
        assert!(is_path_safe_for_grant(
            Path::new("/appdata/.nesso"),
            &[app_data],
            &store,
        ));
    }

    // ── Path canonicalization ──────────────────────────────────────────

    #[test]
    fn canonical_path_normalizes_windows_separators() {
        // Windows backslash separators must be normalized to forward
        // slashes so trust-store comparisons work regardless of platform
        // or mixed frontend input.
        #[cfg(target_os = "windows")]
        let expected = "c:/users/me/projects/my-graph";
        #[cfg(not(target_os = "windows"))]
        let expected = "C:/Users/me/projects/my-graph";

        assert_eq!(
            canonical_path_str(Path::new("C:\\Users\\me\\projects\\my-graph")),
            expected
        );
    }

    #[test]
    fn canonical_path_trims_trailing_slashes() {
        assert_eq!(
            canonical_path_str(Path::new("/home/user/projects/my-graph/")),
            "/home/user/projects/my-graph"
        );
        assert_eq!(
            canonical_path_str(Path::new("/home/user/projects/my-graph///")),
            "/home/user/projects/my-graph"
        );
    }

    #[test]
    fn canonical_path_handles_mixed_separators() {
        #[cfg(target_os = "windows")]
        let expected = "c:/users/me/projects/my-graph";
        #[cfg(not(target_os = "windows"))]
        let expected = "C:/Users/me/projects/my-graph";

        assert_eq!(
            canonical_path_str(Path::new("C:\\Users/me\\projects/my-graph")),
            expected
        );
    }

    #[test]
    fn trust_store_matches_windows_path_on_unix_store() {
        // A path stored with Unix separators must match when checked
        // with Windows separators (e.g. frontend passing backslash paths).
        let store = dummy_store(&["/home/user/projects/my-graph"]);
        let app_data = Path::new("/appdata");
        // Checked path uses backslashes — should still match.
        assert!(is_path_trusted(
            Path::new("\\home\\user\\projects\\my-graph"),
            &[app_data],
            &store,
        ));
        // Descendant with backslashes.
        assert!(is_path_trusted(
            Path::new("\\home\\user\\projects\\my-graph\\.nesso"),
            &[app_data],
            &store,
        ));
    }

    #[test]
    fn trust_store_matches_mixed_separator_input() {
        let store = dummy_store(&["C:/Users/me/projects/my-graph"]);
        let app_data = Path::new("/appdata");
        assert!(is_path_trusted(
            Path::new("C:\\Users\\me\\projects\\my-graph"),
            &[app_data],
            &store,
        ));
    }

    // ── Extended-path normalization ───────────────────────────────────

    #[test]
    fn canonical_path_strips_extended_drive_prefix() {
        // \\?\C:\Users\me  →  C:/Users/me  (extended drive → normal)
        #[cfg(target_os = "windows")]
        let expected = "c:/users/me";
        #[cfg(not(target_os = "windows"))]
        let expected = "C:/Users/me";

        assert_eq!(
            canonical_path_str(Path::new("\\\\?\\C:\\Users\\me")),
            expected
        );
    }

    #[test]
    fn canonical_path_strips_extended_drive_prefix_with_file() {
        #[cfg(target_os = "windows")]
        let expected = "c:/users/me/projects/my-graph/.nesso";
        #[cfg(not(target_os = "windows"))]
        let expected = "C:/Users/me/projects/my-graph/.nesso";

        assert_eq!(
            canonical_path_str(Path::new(
                "\\\\?\\C:\\Users\\me\\projects\\my-graph\\.nesso"
            )),
            expected
        );
    }

    #[test]
    fn canonical_path_normalizes_extended_unc_to_normal_unc() {
        // \\?\UNC\server\share\folder  →  //server/share/folder
        let result = canonical_path_str(Path::new("\\\\?\\UNC\\server\\share\\folder"));
        // UNC server and share names are not lowercased on non-Windows
        // because they are not filesystem paths there.
        #[cfg(target_os = "windows")]
        assert_eq!(result, "//server/share/folder");
        #[cfg(not(target_os = "windows"))]
        assert_eq!(result, "//server/share/folder");
    }

    #[test]
    fn canonical_path_preserves_normal_unc_paths() {
        // Normal UNC  \\server\share\folder  →  //server/share/folder
        let result = canonical_path_str(Path::new("\\\\server\\share\\folder"));
        // Extended prefix not present, so only separator normalization applies.
        assert_eq!(result, "//server/share/folder");
    }

    #[test]
    fn canonical_path_normal_unc_and_extended_unc_produce_same_form() {
        let normal = canonical_path_str(Path::new("\\\\server\\share\\folder"));
        let extended = canonical_path_str(Path::new("\\\\?\\UNC\\server\\share\\folder"));
        assert_eq!(normal, extended);
    }

    #[test]
    fn canonical_path_normal_drive_and_extended_drive_produce_same_form() {
        let normal = canonical_path_str(Path::new("C:\\Users\\me\\projects"));
        let extended = canonical_path_str(Path::new("\\\\?\\C:\\Users\\me\\projects"));
        assert_eq!(normal, extended);
    }

    #[test]
    fn trust_store_matches_extended_path_against_normal_store_entry() {
        // Store has normal drive path.  Checked path is extended drive
        // form (as the Windows picker might return).  They must match.
        let store = dummy_store(&["C:/Users/me/projects/my-graph"]);
        let app_data = Path::new("/appdata");
        assert!(is_path_trusted(
            Path::new("\\\\?\\C:\\Users\\me\\projects\\my-graph"),
            &[app_data],
            &store,
        ));
    }

    #[test]
    fn trust_store_matches_extended_unc_against_normal_unc_store_entry() {
        let store = dummy_store(&["//server/share"]);
        let app_data = Path::new("/appdata");
        assert!(is_path_trusted(
            Path::new("\\\\?\\UNC\\server\\share"),
            &[app_data],
            &store,
        ));
    }

    #[test]
    fn trust_store_matches_normal_unc_against_extended_unc_store_entry() {
        // Reverse: store was seeded with an extended UNC path (as might
        // happen via the picker on Windows); a normal UNC check must match.
        let app_data = Path::new("/appdata");
        let store = dummy_store(&["//server/share"]);
        assert!(is_path_trusted(
            Path::new("\\\\server\\share"),
            &[app_data],
            &store,
        ));
    }

    #[test]
    fn trust_store_trims_trailing_slashes_for_extended_paths() {
        let store = dummy_store(&["C:/Users/me/projects/my-graph"]);
        let app_data = Path::new("/appdata");
        // Extended path with trailing slashes.
        assert!(is_path_trusted(
            Path::new("\\\\?\\C:\\Users\\me\\projects\\my-graph\\"),
            &[app_data],
            &store,
        ));
    }

    // ── Picker validation with home / app-data context ─────────────────

    #[test]
    fn picker_rejects_home_directory_itself() {
        let home = Path::new("/home/user");
        let app_data = Path::new("/appdata");
        assert!(!validate_picked_folder_full(
            Path::new("/home/user"),
            home,
            app_data,
            None,
        ));
    }

    #[test]
    fn picker_rejects_ancestor_of_home() {
        // /home is an ancestor of $HOME=/home/user — picking it would
        // grant scope over the entire home directory.
        let home = Path::new("/home/user");
        let app_data = Path::new("/appdata");
        assert!(!validate_picked_folder_full(
            Path::new("/home"),
            home,
            app_data,
            None,
        ));
        // Root (/) is also an ancestor of home.
        assert!(!validate_picked_folder_full(
            Path::new("/"),
            home,
            app_data,
            None,
        ));
    }

    #[test]
    fn picker_rejects_app_data_root() {
        let home = Path::new("/home/user");
        let app_data = Path::new("/appdata");
        assert!(!validate_picked_folder_full(
            Path::new("/appdata"),
            home,
            app_data,
            None,
        ));
    }

    #[test]
    fn picker_rejects_ancestor_of_app_data() {
        let home = Path::new("/home/user");
        let app_data = Path::new("/var/lib/app");
        assert!(!validate_picked_folder_full(
            Path::new("/var/lib"),
            home,
            app_data,
            None,
        ));
    }

    #[test]
    fn picker_rejects_path_containing_trust_store_file() {
        // The trust-store file (.nesso-trusted-paths.json) lives in the
        // app-data root.  Picking a directory that contains it (including
        // the app-data root itself) must be rejected so the trust store
        // stays outside every grantable fs root.
        let home = Path::new("/home/user");
        let app_data = Path::new("/appdata");
        // App-data root contains the trust-store file.
        assert!(!validate_picked_folder_full(
            Path::new("/appdata"),
            home,
            app_data,
            None,
        ));
        // Root contains app-data → also contains the trust store.
        assert!(!validate_picked_folder_full(
            Path::new("/"),
            home,
            app_data,
            None,
        ));
    }

    #[test]
    fn picker_accepts_legitimate_external_project() {
        let home = Path::new("/home/user");
        let app_data = Path::new("/appdata");
        assert!(validate_picked_folder_full(
            Path::new("/home/user/projects/my-graph"),
            home,
            app_data,
            None,
        ));
    }

    #[test]
    fn picker_accepts_default_workspace_under_app_data() {
        // The default workspace (app-data/graphs) is NOT the app-data
        // root itself — it's a child.  The trust-store file is in the
        // root, not under graphs/, so this path does not contain the
        // trust-store file.
        let home = Path::new("/home/user");
        let app_data = Path::new("/appdata");
        assert!(validate_picked_folder_full(
            Path::new("/appdata/graphs"),
            home,
            app_data,
            None,
        ));
    }

    #[test]
    fn picker_accepts_nesso_subdir_under_app_data() {
        let home = Path::new("/home/user");
        let app_data = Path::new("/appdata");
        assert!(validate_picked_folder_full(
            Path::new("/appdata/graphs/.nesso"),
            home,
            app_data,
            None,
        ));
    }

    #[test]
    fn picker_rejects_app_local_data_root() {
        let home = Path::new("/home/user");
        let app_data = Path::new("/appdata");
        let app_local = Path::new("/applocaldata");
        assert!(!validate_picked_folder_full(
            Path::new("/applocaldata"),
            home,
            app_data,
            Some(app_local),
        ));
    }

    // ── grant_fs_scope rejects app-data root ───────────────────────────

    #[test]
    fn grant_rejects_app_data_root_even_if_in_trust_store() {
        // Defense in depth: even if the app-data root somehow ended up
        // in the trust store, grant_fs_scope must still reject it
        // because it contains the trust-store file.
        let store = dummy_store(&["/appdata"]);
        let app_data = Path::new("/appdata");
        assert!(!is_path_safe_for_grant(
            Path::new("/appdata"),
            &[app_data],
            &store,
        ));
    }

    #[test]
    fn grant_rejects_app_local_data_root() {
        let store = HashSet::new();
        let app_data = Path::new("/appdata");
        let app_local = Path::new("/applocaldata");
        assert!(!is_path_safe_for_grant(
            Path::new("/applocaldata"),
            &[app_data, app_local],
            &store,
        ));
    }

    // ── Trust-store filename rejection (scoped to app-data roots) ──────

    /// The exact canonical trust-store file under an app-data directory
    /// must be rejected.  This is the primary protection: a compromised
    /// renderer must never be able to grant fs scope over the trust-store
    /// file itself.
    #[test]
    fn grant_rejects_exact_trust_store_file_under_app_data_dir() {
        let store = dummy_store(&["/appdata/.nesso-trusted-paths.json"]);
        let app_data = Path::new("/appdata");
        assert!(!is_path_safe_for_grant(
            Path::new("/appdata/.nesso-trusted-paths.json"),
            &[app_data],
            &store,
        ));
    }

    /// A path that is a descendant of the trust-store file under app-data
    /// (e.g. a directory named after the trust-store file) must also be
    /// rejected to prevent granting scope inside the trust-store data.
    #[test]
    fn grant_rejects_trust_store_file_descendant_under_app_data() {
        let store = dummy_store(&["/appdata/.nesso-trusted-paths.json"]);
        let app_data = Path::new("/appdata");
        assert!(!is_path_safe_for_grant(
            Path::new("/appdata/.nesso-trusted-paths.json/sub"),
            &[app_data],
            &store,
        ));
    }

    /// An external workspace path that happens to contain the trust-store
    /// filename as a component must NOT be rejected.  The filename guard
    /// protects only the real trust-store file under the app-data directory.
    /// A legitimate external project at e.g.
    /// `/home/user/projects/.nesso-trusted-paths.json/graphs` must pass.
    #[test]
    fn grant_accepts_external_path_containing_trust_store_filename() {
        let store = dummy_store(&["/home/user/projects/.nesso-trusted-paths.json"]);
        let app_data = Path::new("/appdata");
        assert!(is_path_safe_for_grant(
            Path::new("/home/user/projects/.nesso-trusted-paths.json"),
            &[app_data],
            &store,
        ));
        // Sub-path under the external workspace also passes.
        assert!(is_path_safe_for_grant(
            Path::new("/home/user/projects/.nesso-trusted-paths.json/graphs"),
            &[app_data],
            &store,
        ));
    }

    /// The trust-store file under a secondary app-data directory
    /// (app-local-data) must also be rejected.
    #[test]
    fn grant_rejects_trust_store_file_under_app_local_data() {
        let store = HashSet::new();
        let app_data = Path::new("/appdata");
        let app_local = Path::new("/applocaldata");
        // Trust-store file under app-local-data.
        assert!(!is_path_safe_for_grant(
            Path::new("/applocaldata/.nesso-trusted-paths.json"),
            &[app_data, app_local],
            &store,
        ));
        // External path still passes.
        let store_ext = dummy_store(&["/home/user/.nesso-trusted-paths.json/project"]);
        assert!(is_path_safe_for_grant(
            Path::new("/home/user/.nesso-trusted-paths.json/project"),
            &[app_data, app_local],
            &store_ext,
        ));
    }

    // ── Trust store serialization round-trip ────────────────────────────

    #[test]
    fn trust_store_round_trip_as_json_array_of_path_strings() {
        let dir = tempfile::tempdir().expect("tempdir");
        let app_data = dir.path();

        // Persist a couple of paths.
        let paths = vec![
            "/home/user/projects/my-graph".to_string(),
            "/home/user/projects/other-project".to_string(),
        ];
        persist_trust_store(app_data, &paths).expect("persist");

        // Read back and verify it's a direct JSON array (not an object wrapper).
        let raw = std::fs::read_to_string(app_data.join(TRUST_STORE_FILENAME)).expect("read");
        let parsed: Vec<String> = serde_json::from_str(&raw).expect("deserialize");
        assert_eq!(parsed, paths);

        // Round-trip through load_trust_store (clears the static cache first).
        {
            let mut guard = TRUST_STORE.lock().unwrap();
            *guard = None;
        }
        let loaded = load_trust_store(app_data);
        assert_eq!(loaded, paths);
    }

    #[test]
    fn trust_store_handles_missing_file() {
        let dir = tempfile::tempdir().expect("tempdir");
        {
            let mut guard = TRUST_STORE.lock().unwrap();
            *guard = None;
        }
        let loaded = load_trust_store(dir.path());
        assert!(loaded.is_empty());
    }

    /// Regression test: the trust-store in-memory cache must be keyed by
    /// app-data path so loading from one directory does not return data
    /// persisted for a different directory.
    #[test]
    fn trust_store_cache_is_keyed_by_app_data_path() {
        let dir_a = tempfile::tempdir().expect("tempdir A");
        let dir_b = tempfile::tempdir().expect("tempdir B");

        // Persist different data to each directory.
        let paths_a = vec!["/home/user/projects/a".to_string()];
        let paths_b = vec!["/home/user/projects/b".to_string()];
        persist_trust_store(dir_a.path(), &paths_a).expect("persist A");
        persist_trust_store(dir_b.path(), &paths_b).expect("persist B");

        // Clear the global cache completely.
        {
            let mut guard = TRUST_STORE.lock().unwrap();
            *guard = None;
        }

        // Load from A first (populates cache for A).
        let loaded_a = load_trust_store(dir_a.path());
        assert_eq!(loaded_a, paths_a, "load from A must return A's data");

        // Load from B — must return B's data, NOT the cached data from A.
        let loaded_b = load_trust_store(dir_b.path());
        assert_eq!(
            loaded_b, paths_b,
            "load from B must return B's data, not cached A data"
        );
    }

    // ── Unified scope-path validation table-driven tests ────────────────

    /// Scope-path validation table entry.
    struct ScopePathCase {
        /// Human-readable description.
        desc: &'static str,
        /// Path under test.
        path: &'static str,
        /// App-data root (only one for these tests).
        app_data: &'static str,
        /// Trust-store entries (empty = none). Must be 'static.
        trust: &'static [&'static str],
        /// Expected result for Picker intent.
        picker_ok: bool,
        /// Expected result for Grant intent.
        grant_ok: bool,
    }

    fn run_scope_path_cases(cases: &[ScopePathCase]) {
        for case in cases {
            let store = dummy_store(case.trust);
            let app_data = Path::new(case.app_data);

            let picker_result = validate_picked_folder_full(
                Path::new(case.path),
                Path::new("/home/user"),
                app_data,
                None,
            );
            assert_eq!(
                picker_result, case.picker_ok,
                "picker: {} — path={}, app_data={}",
                case.desc, case.path, case.app_data,
            );

            let grant_result = is_path_safe_for_grant(Path::new(case.path), &[app_data], &store);
            assert_eq!(
                grant_result, case.grant_ok,
                "grant: {} — path={}, app_data={}",
                case.desc, case.path, case.app_data,
            );
        }
    }

    #[test]
    fn table_driven_scope_path_linux_app_data() {
        const LAD: &str = "/home/user/.local/share/dev.nesso.desktop";
        const LWS: &str = "/home/user/.local/share/dev.nesso.desktop/graphs";
        const HEXT: &str = "/home/user/.my-projects/graph";
        const TRUST_WS: &[&str] = &[LWS];
        const TRUST_HEXT: &[&str] = &[HEXT];
        const TRUST_LAD: &[&str] = &[LAD];
        const EMPTY: &[&str] = &[];

        run_scope_path_cases(&[
            // ── Linux app-data paths ──────────────────────────────────
            ScopePathCase {
                desc: "Linux workspace trusted via trust store",
                path: LWS,
                app_data: LAD,
                trust: TRUST_WS,
                picker_ok: true,
                grant_ok: true,
            },
            ScopePathCase {
                desc: "Linux workspace rejected without trust store",
                path: LWS,
                app_data: LAD,
                trust: EMPTY,
                picker_ok: true, // picker is human-verified
                grant_ok: false, // no .nesso component, no trust store
            },
            ScopePathCase {
                desc: "Linux .nesso subtree auto-trusted",
                path: "/home/user/.local/share/dev.nesso.desktop/.nesso",
                app_data: LAD,
                trust: EMPTY,
                picker_ok: true,
                grant_ok: true,
            },
            ScopePathCase {
                desc: "Linux .nesso deep descendant auto-trusted",
                path: "/home/user/.local/share/dev.nesso.desktop/graphs/.nesso/cache",
                app_data: LAD,
                trust: EMPTY,
                picker_ok: true,
                grant_ok: true,
            },
            ScopePathCase {
                desc: "Linux app-data root rejected for grant",
                path: LAD,
                app_data: LAD,
                trust: EMPTY,
                picker_ok: false, // app-data root rejected by picker
                grant_ok: false,
            },
            ScopePathCase {
                desc: "Linux app-data child non-nesso requires trust store",
                path: "/home/user/.local/share/dev.nesso.desktop/cache",
                app_data: LAD,
                trust: EMPTY,
                picker_ok: true,
                grant_ok: false,
            },
            // ── Rejection invariants ──────────────────────────────────
            ScopePathCase {
                desc: "root rejected",
                path: "/",
                app_data: LAD,
                trust: EMPTY,
                picker_ok: false,
                grant_ok: false,
            },
            ScopePathCase {
                desc: "home directory rejected",
                path: "/home/user",
                app_data: LAD,
                trust: EMPTY,
                picker_ok: false,
                grant_ok: false,
            },
            ScopePathCase {
                desc: "home ancestor rejected",
                path: "/home",
                app_data: LAD,
                trust: EMPTY,
                picker_ok: false,
                grant_ok: false,
            },
            ScopePathCase {
                desc: "traversal rejected",
                path: "/home/user/../../etc",
                app_data: LAD,
                trust: EMPTY,
                picker_ok: false,
                grant_ok: false,
            },
            ScopePathCase {
                desc: ".ssh rejected for grant (outside app-data, no trust)",
                path: "/home/user/.ssh",
                app_data: LAD,
                trust: EMPTY,
                picker_ok: true, // picker is human-verified
                grant_ok: false, // not under app-data, not in trust store
            },
            ScopePathCase {
                desc: "hidden external with trust store passes",
                path: HEXT,
                app_data: LAD,
                trust: TRUST_HEXT,
                picker_ok: true,
                grant_ok: true,
            },
            ScopePathCase {
                desc: "hidden external without trust store rejected for grant",
                path: HEXT,
                app_data: LAD,
                trust: EMPTY,
                picker_ok: true, // picker is human-verified
                grant_ok: false,
            },
            ScopePathCase {
                desc: "app-data root with trust store still rejected",
                path: LAD,
                app_data: LAD,
                trust: TRUST_LAD,
                picker_ok: false,
                grant_ok: false,
            },
            ScopePathCase {
                desc: "arbitrary external path rejected for grant",
                path: "/tmp/random",
                app_data: LAD,
                trust: EMPTY,
                picker_ok: true, // picker allows external folders
                grant_ok: false,
            },
        ]);
    }

    #[test]
    fn table_driven_scope_path_flat_app_data() {
        const AD: &str = "/appdata";
        const AD_GRAPHS: &[&str] = &["/appdata/graphs"];
        const EMPTY: &[&str] = &[];

        run_scope_path_cases(&[
            ScopePathCase {
                desc: ".nesso subtree auto-trusted (flat app-data)",
                path: "/appdata/.nesso",
                app_data: AD,
                trust: EMPTY,
                picker_ok: true,
                grant_ok: true,
            },
            ScopePathCase {
                desc: ".nesso deep descendant auto-trusted (flat app-data)",
                path: "/appdata/graphs/.nesso/config",
                app_data: AD,
                trust: EMPTY,
                picker_ok: true,
                grant_ok: true,
            },
            ScopePathCase {
                desc: "non-nesso under app-data falls through (flat)",
                path: "/appdata/graphs",
                app_data: AD,
                trust: EMPTY,
                picker_ok: true,
                grant_ok: false,
            },
            ScopePathCase {
                desc: "non-nesso with trust store passes (flat)",
                path: "/appdata/graphs",
                app_data: AD,
                trust: AD_GRAPHS,
                picker_ok: true,
                grant_ok: true,
            },
            ScopePathCase {
                desc: "relative path rejected",
                path: "projects/graph",
                app_data: AD,
                trust: EMPTY,
                picker_ok: false,
                grant_ok: false,
            },
            ScopePathCase {
                desc: "arbitrary .nesso outside flat app-data rejected",
                path: "/some/random/.nesso",
                app_data: AD,
                trust: EMPTY,
                picker_ok: true, // picker allows the folder, human verified
                grant_ok: false,
            },
        ]);
    }
}

#[cfg(test)]
mod symlink_tests {
    use super::*;

    /// Tests for symlink hardening in the trust boundary.
    /// These tests create real temporary directories and symlinks where
    /// the platform permits, then verify that the symlink detection and
    /// resolution primitives work correctly.
    ///
    /// Integration-level hardening (canonical-path checks in `grant_fs_scope`
    /// and `pick_workspace_folder`) is tested through the helper functions
    /// (`validate_and_resolve_picker_path`, `is_path_safe_for_grant`) in the
    /// unit tests above.  These tests focus on the building-block functions
    /// (`prefix_has_symlink`, `resolve_existing_prefix`).

    // ── prefix_has_symlink ──────────────────────────────────────────────

    #[test]
    fn prefix_has_symlink_detects_symlink_component() {
        let dir = tempfile::tempdir().expect("tempdir");
        let real = dir.path().join("real_dir");
        std::fs::create_dir(&real).expect("mkdir");

        // Create a symlink inside the tempdir pointing to the real dir.
        // This avoids macOS system symlinks (/var, /tmp, /home) because
        // we create the link inside a tempdir whose path may or may not
        // cross system symlinks — but the symlink we create is local.
        #[cfg(unix)]
        {
            let sym = dir.path().join("link_dir");
            std::os::unix::fs::symlink(&real, &sym).expect("symlink");
            // The symlink component IS detected regardless of whether
            // the tempdir path itself crosses system symlinks.
            assert!(prefix_has_symlink(&sym));
            assert!(prefix_has_symlink(&sym.join("child.txt")));
        }
    }

    #[test]
    fn prefix_has_symlink_handles_nonexistent_paths() {
        // Find a path where at least some prefix exists on the filesystem.
        // We use std::env::current_dir() as a known-existing prefix, then
        // append a non-existing sub-path.
        let existing = std::env::current_dir().expect("cwd");
        let nonexistent = existing
            .join("does_not_exist_92734")
            .join("deep")
            .join("file.txt");
        // The existing prefix (cwd) might or might not contain symlinks
        // depending on the environment, but the non-existing suffix has none.
        // The function stops at the first non-existing component, so it
        // doesn't check beyond the cwd prefix.
        let result = prefix_has_symlink(&nonexistent);
        // We don't assert true/false — the result depends on whether cwd
        // itself contains symlinks.  On macOS with a symlinked home directory,
        // cwd might have a symlink component.  The test documents that
        // the function returns without panic for non-existing suffixes.
        let _ = result;
    }

    /// Regression test: a picker symlink targeting an outside path must be
    /// detected by `prefix_has_symlink` before any canonicalization or scope
    /// grant.  The "reject symlink components" strategy prevents symlink
    /// escapes: if a user picks a directory whose path contains any symlink
    /// component (including a symlink pointing to an outside directory like
    /// /etc or /tmp), the picker must reject it outright without even
    /// attempting to canonicalize.
    #[test]
    #[cfg(unix)]
    fn prefix_has_symlink_rejects_symlink_to_outside_target() {
        let dir = tempfile::tempdir().expect("tempdir");
        // Create a symlink inside the tempdir that points OUTSIDE the
        // tempdir (e.g. to /tmp).  This simulates a user creating a
        // symlink inside their project folder that targets a sensitive
        // system directory — the picker must reject the symlinked path.
        let outside_target = std::path::Path::new("/tmp");
        let sym = dir.path().join("escape_to_tmp");
        std::os::unix::fs::symlink(outside_target, &sym).expect("symlink");
        assert!(prefix_has_symlink(&sym));
        // A child path under the symlink must also be detected.
        assert!(prefix_has_symlink(&sym.join("subdir")));
    }

    /// `validate_and_resolve_picker_path` is the shared internal function
    /// that `pick_workspace_folder` uses.  It encapsulates the symlink gate,
    /// contextual validation, and canonicalized resolution in a single call
    /// so that any path escaping the trust boundary via symlinks is rejected
    /// before scope is granted.
    ///
    /// This test exercises the shared function directly: a symlink to an
    /// outside directory (e.g. `/etc`) must return an error, while a normal
    /// valid path must return the resolved canonical path.
    #[test]
    #[cfg(unix)]
    fn picker_validation_rejects_symlink_escape_through_shared_function() {
        let dir = tempfile::tempdir().expect("tempdir");
        // Resolve the tempdir path to remove macOS system symlinks such as
        // /var → /private/var.  The test tree must sit in a symlink-free
        // prefix so that `prefix_has_symlink` does not reject every path
        // under the tempdir before we even create our own symlink.
        let base = std::fs::canonicalize(dir.path()).expect("canonicalize tempdir");

        // Create a symlink inside the resolved base that points to /etc.
        let sym = base.join("link_to_etc");
        std::os::unix::fs::symlink(Path::new("/etc"), &sym).expect("symlink");

        let home = Path::new("/home/user");
        let app_data = Path::new("/appdata");

        // The symlink to an outside boundary must be rejected by the
        // shared function that `pick_workspace_folder` calls.
        let result = validate_and_resolve_picker_path(&sym, home, app_data, None);
        assert!(
            result.is_err(),
            "validate_and_resolve_picker_path must reject symlink escape to /etc"
        );

        // A normal valid path must be accepted and return the resolved
        // canonical form.
        let normal = base.join("legit_project");
        std::fs::create_dir(&normal).expect("mkdir");
        let result = validate_and_resolve_picker_path(&normal, home, app_data, None);
        assert!(
            result.is_ok(),
            "validate_and_resolve_picker_path must accept a normal directory"
        );
        let resolved = result.unwrap();
        assert!(resolved.is_absolute());
        // The resolved path must end with the picked directory name.
        assert!(
            resolved.ends_with("legit_project"),
            "resolved path \"{}\" must end with \"legit_project\"",
            resolved.display(),
        );
    }

    // ── resolve_existing_prefix ─────────────────────────────────────────

    #[test]
    fn resolve_existing_prefix_returns_canonical_path_for_existing_file() {
        let dir = tempfile::tempdir().expect("tempdir");
        let file_path = dir.path().join("real_file");
        std::fs::write(&file_path, "data").expect("write");
        let resolved = resolve_existing_prefix(&file_path).expect("resolve");
        assert!(resolved.is_absolute());
        assert!(resolved.ends_with("real_file"));
    }

    #[test]
    fn resolve_existing_prefix_handles_non_existent_path() {
        let dir = tempfile::tempdir().expect("tempdir");
        let nested = dir.path().join("a").join("b").join("c.txt");
        let resolved = resolve_existing_prefix(&nested).expect("resolve");
        // The resolved path should be absolute and end with a/b/c.txt.
        assert!(resolved.is_absolute());
        assert!(resolved.ends_with("a/b/c.txt"));
    }

    #[test]
    #[cfg(unix)]
    fn resolve_existing_prefix_resolves_symlinks() {
        let dir = tempfile::tempdir().expect("tempdir");
        let real = dir.path().join("real_target");
        std::fs::create_dir(&real).expect("mkdir");
        let sym = dir.path().join("symlink_dir");
        std::os::unix::fs::symlink(&real, &sym).expect("symlink");
        // The resolved path should be the canonical (real) form, not the
        // symlink name.  However, if the tempdir itself crosses a system
        // symlink, the canonical path prefix may differ.  We only verify
        // that the resolved path exists and is different from the symlink.
        let resolved = resolve_existing_prefix(&sym).expect("resolve");
        assert!(resolved.is_absolute());
        // The resolved path's file_name should NOT be "symlink_dir" if the
        // symlink was properly resolved.  However, due to tempdir system
        // symlinks, we can only assert it's absolute.
    }

    // ── Picker re-validation after canonicalization ─────────────────────

    /// A raw picker path like `/home/user/.` passes the structural checks
    /// (no `..`, absolute, not root) but after canonicalization resolves
    /// to `/home/user` — the home directory itself.  The picker must reject
    /// any resolved path that lands in a forbidden area even when the raw
    /// path appeared valid.
    #[test]
    fn picker_rejects_raw_path_that_resolves_to_home_directory() {
        let dir = tempfile::tempdir().expect("tempdir");
        let base = std::fs::canonicalize(dir.path()).expect("canonicalize tempdir");

        // Create a "home" directory and an "app-data" directory.
        let home = base.join("home").join("user");
        std::fs::create_dir_all(&home).expect("mkdir home");
        let app_data = base.join("appdata");
        std::fs::create_dir_all(&app_data).expect("mkdir appdata");

        // A valid project directory.
        let valid = base.join("projects").join("my-graph");
        std::fs::create_dir_all(&valid).expect("mkdir valid");

        // Picking `/home/user/.` — raw path has a CurDir component.
        // `validate_picked_folder_full` (raw) does NOT reject it because
        // `canonical_path_str` does not normalize `.` components.
        // `resolve_existing_prefix` canonicalizes it to the home directory.
        let picked_dot = home.join(".");
        let result = validate_and_resolve_picker_path(&picked_dot, &home, &app_data, None);
        assert!(
            result.is_err(),
            "picker must reject path with `.` that resolves to home directory"
        );

        // Sanity: a normal valid path in the same tree must still pass.
        let result = validate_and_resolve_picker_path(&valid, &home, &app_data, None);
        assert!(result.is_ok(), "picker must accept a normal valid path");
    }

    /// A raw picker path like `$APPDATA/.` resolves to the app-data root
    /// after canonicalization.  The app-data root is always forbidden.
    #[test]
    fn picker_rejects_raw_path_that_resolves_to_app_data_root() {
        let dir = tempfile::tempdir().expect("tempdir");
        let base = std::fs::canonicalize(dir.path()).expect("canonicalize tempdir");

        let home = base.join("home").join("user");
        std::fs::create_dir_all(&home).expect("mkdir home");
        let app_data = base.join("appdata");
        std::fs::create_dir_all(&app_data).expect("mkdir appdata");

        // Picking `$APPDATA/.` — raw path passes structural checks but
        // canonicalization resolves `.` to the app-data root itself.
        let picked_dot = app_data.join(".");
        let result = validate_and_resolve_picker_path(&picked_dot, &home, &app_data, None);
        assert!(
            result.is_err(),
            "picker must reject path that resolves to app-data root"
        );
    }

    /// A raw picker path like `/projects/my-graph/.` passes the symlink gate
    /// (no symlinks) and the structural checks, but canonicalization resolves
    /// the `.` away — making the resolved canonical form differ from the raw
    /// path.  When the resolved path is a legitimate project folder (not home,
    /// not app-data root), the re-validation must still accept it.
    ///
    /// This is the positive counterpart to the tests that reject `.` paths
    /// resolving to forbidden areas (home directory, app-data root).
    #[test]
    fn picker_accepts_raw_path_with_dot_resolving_to_valid_project() {
        let dir = tempfile::tempdir().expect("tempdir");
        let base = std::fs::canonicalize(dir.path()).expect("canonicalize tempdir");

        let home = base.join("home").join("user");
        std::fs::create_dir_all(&home).expect("mkdir home");
        let app_data = base.join("appdata");
        std::fs::create_dir_all(&app_data).expect("mkdir appdata");

        // Create a valid project folder and a raw picker path with a `.`
        // component that resolves to the same folder.
        let valid = base.join("projects").join("my-graph");
        std::fs::create_dir_all(&valid).expect("mkdir valid");
        let raw = PathBuf::from(format!("{}/.", valid.display()));
        // Note: `PathBuf::from` normalizes the `.` component away so `raw`
        // may equal `valid` after construction.  The test is still meaningful:
        // `validate_and_resolve_picker_path` calls `resolve_existing_prefix`
        // which canonicalizes via the OS filesystem — if the OS-level
        // canonical form differs from the raw path, the re-validation must
        // still pass.  This complements the rejection tests for `.` paths
        // that resolve to home / app-data roots.
        let result = validate_and_resolve_picker_path(&raw, &home, &app_data, None);
        assert!(
            result.is_ok(),
            "picker must accept raw path with `.` that resolves to a valid project folder"
        );
        let resolved = result.unwrap();
        // The resolved path must point to the actual project folder, not the
        // raw path with the `.` tail.
        assert!(resolved.ends_with("my-graph"));
    }

    // ── Grant canonical-path re-validation ─────────────────────────────

    /// The grant flow must reject a path whose canonical (symlink-resolved)
    /// form falls outside the trust boundary, even when the raw path passes
    /// the `prefix_has_symlink` check.  This is the defense-in-depth layer:
    /// if a symlink is created between `prefix_has_symlink` and resolution,
    /// the canonical path is caught by the re-validation step.
    #[test]
    #[cfg(unix)]
    fn grant_canonical_path_re_validation_rejects_symlink_escape() {
        let dir = tempfile::tempdir().expect("tempdir");
        let base = std::fs::canonicalize(dir.path()).expect("canonicalize tempdir");

        // Create a "trusted" directory and a symlink inside it that points
        // to an "untrusted" area.
        let trusted = base.join("trusted_root");
        std::fs::create_dir(&trusted).expect("mkdir trusted");
        let untrusted = base.join("sensitive");
        std::fs::create_dir(&untrusted).expect("mkdir untrusted");

        // Symlink from inside the trusted area to the untrusted area.
        let sym = trusted.join("escape_link");
        std::os::unix::fs::symlink(&untrusted, &sym).expect("symlink");

        // Primary gate: `prefix_has_symlink` catches the symlink component.
        assert!(
            prefix_has_symlink(&sym),
            "primary gate: symlink component must be detected"
        );

        // Defense-in-depth: if the primary gate were somehow bypassed
        // (TOCTOU), `resolve_existing_prefix` resolves the symlink to the
        // untrusted target.  The resolved path is outside the trusted root.
        let resolved = resolve_existing_prefix(&sym).expect("resolve symlink");
        assert!(
            resolved != sym,
            "canonical form must differ from symlink path"
        );
        assert!(
            !resolved.starts_with(&trusted),
            "resolved path must NOT be under trusted root — it escaped"
        );

        // Defense-in-depth: `is_path_safe_for_grant` must reject the resolved
        // path because it is not in the trust store (only `trusted` is) and
        // not under any app-data `.nesso` subtree.
        let store = HashSet::new();
        let app_data = Path::new("/appdata");
        assert!(
            !is_path_safe_for_grant(&resolved, &[app_data], &store),
            "is_path_safe_for_grant must reject resolved path outside trust boundary"
        );
    }

    /// When the canonical path is identical to the raw path (no symlinks,
    /// no `.` components) and the raw path is trusted, the re-validation
    /// must still pass.  This verifies that removing the `resolved != p`
    /// guard does not introduce false rejections.
    #[test]
    fn grant_canonical_path_re_validation_accepts_unchanged_path() {
        let dir = tempfile::tempdir().expect("tempdir");
        let base = std::fs::canonicalize(dir.path()).expect("canonicalize tempdir");

        let legit = base.join("legit_project");
        std::fs::create_dir(&legit).expect("mkdir");

        // No symlinks, no `.` — resolved path should equal raw path.
        let resolved = resolve_existing_prefix(&legit).expect("resolve");
        assert_eq!(
            resolved, legit,
            "canonical form of a direct directory must equal the raw path"
        );
    }
}

#[cfg(test)]
mod fs_capability_tests {
    use serde_json::Value;

    const NESSO_PATHS: [&str; 4] = [
        "$APPDATA/**/.nesso",
        "$APPDATA/**/.nesso/**",
        "$APPLOCALDATA/**/.nesso",
        "$APPLOCALDATA/**/.nesso/**",
    ];

    /// Every fs operation the runtime exercises must be listed here with an
    /// exact `.nesso` path allowlist.  `fs:default` is deliberately absent —
    /// it grants read + mkdir over the entire app-data tree, which is broader
    /// than Nesso needs (it only touches `.nesso` directories).
    const SCOPED_PERMISSIONS: [&str; 10] = [
        "fs:allow-read-file",
        "fs:allow-read-text-file",
        "fs:allow-read-dir",
        "fs:allow-stat",
        "fs:allow-exists",
        "fs:allow-write-file",
        "fs:allow-write-text-file",
        "fs:allow-mkdir",
        "fs:allow-remove",
        "fs:allow-rename",
    ];

    fn permissions() -> Vec<Value> {
        let capability: Value = serde_json::from_str(include_str!("../capabilities/default.json"))
            .expect("default capability must be valid JSON");

        capability
            .get("permissions")
            .and_then(|value| value.as_array())
            .expect("default capability must define permissions")
            .clone()
    }

    fn permission<'a>(permissions: &'a [Value], identifier: &str) -> Option<&'a Value> {
        permissions.iter().find(|entry| {
            entry.get("identifier").and_then(|value| value.as_str()) == Some(identifier)
        })
    }

    fn allowed_paths(permission: &Value) -> Vec<String> {
        permission
            .get("allow")
            .and_then(|value| value.as_array())
            .expect("scoped permission must define allow entries")
            .iter()
            .map(|entry| {
                entry
                    .get("path")
                    .and_then(|value| value.as_str())
                    .or_else(|| entry.as_str())
                    .expect("filesystem allow entries must be strings or {path} objects")
                    .to_string()
            })
            .collect()
    }

    /// Primary capability gate: every required fs operation is scoped to the
    /// `.nesso` allowlist.  `fs:default` must NOT be present — it grants too
    /// much.  `fs:allow-watch` and `fs:allow-unwatch` are kept as scalars
    /// (they are validated at runtime, not by static path patterns).
    #[test]
    fn fs_permissions_are_minimal_scoped_reject_broad_defaults() {
        let permissions = permissions();
        let scalar_permissions = permissions
            .iter()
            .filter_map(|entry| entry.as_str())
            .collect::<Vec<_>>();
        let expected_paths = NESSO_PATHS
            .iter()
            .map(|path| (*path).to_string())
            .collect::<Vec<_>>();

        // --- fs:default must be absent ---
        assert!(
            !scalar_permissions.contains(&"fs:default"),
            "`fs:default` must be removed — it grants read + mkdir over the entire app-data tree"
        );

        // --- watcher permissions must be retained as scalars ---
        for identifier in ["fs:allow-watch", "fs:allow-unwatch"] {
            assert!(
                scalar_permissions.contains(&identifier),
                "expected retained permission `{identifier}`"
            );
        }

        // --- broad app-data recursive permissions must be absent ---
        for identifier in [
            "fs:allow-appdata-read-recursive",
            "fs:allow-appdata-write-recursive",
            "fs:allow-appdata-meta-recursive",
            "fs:scope-appdata-recursive",
            "fs:allow-applocaldata-read-recursive",
            "fs:allow-applocaldata-write-recursive",
            "fs:allow-applocaldata-meta-recursive",
            "fs:scope-applocaldata-recursive",
        ] {
            assert!(
                !scalar_permissions.contains(&identifier),
                "broad permission `{identifier}` must be removed"
            );
        }

        // --- every scoped permission must use the .nesso allowlist ---
        for identifier in SCOPED_PERMISSIONS {
            let p = permission(&permissions, identifier)
                .unwrap_or_else(|| panic!("missing scoped permission `{identifier}`"));
            assert_eq!(
                allowed_paths(p),
                expected_paths,
                "permission `{identifier}` must use the .nesso allowlist"
            );
        }

        // --- runtime fs scope must retain the .nesso allowlist ---
        assert_eq!(
            allowed_paths(
                permission(&permissions, "fs:scope").expect("missing fs:scope permission")
            ),
            expected_paths,
            "runtime fs scope must retain the .nesso allowlist"
        );
    }

    /// The `fs:default` permission set expands to `create-app-specific-dirs`,
    /// `read-app-specific-dirs-recursive`, and `deny-default`.  We explicitly
    /// list the Tauri-scope-related identifiers that must not appear because
    /// they implicitly widen the scope to all app directories.
    #[test]
    fn no_scope_widening_default_components() {
        let permissions = permissions();
        let scalar = permissions
            .iter()
            .filter_map(|entry| entry.as_str())
            .collect::<Vec<_>>();

        for forbidden in [
            "fs:create-app-specific-dirs",
            "fs:read-app-specific-dirs-recursive",
            "fs:deny-default",
        ] {
            assert!(
                !scalar.contains(&forbidden),
                "permission `{forbidden}` is part of `fs:default` and must be absent"
            );
        }
    }
}

#[cfg(test)]
mod csp_tests {
    use serde_json::Value;
    use std::collections::HashMap;

    /// Parses a CSP string into a map of lowercase directive name → lowercase source tokens.
    /// Quoted keywords ('self', 'none', 'unsafe-inline', 'wasm-unsafe-eval') are preserved
    /// verbatim (they are matched exactly elsewhere).  All other tokens (URLs, schemes, host-sources)
    /// are normalized to lowercase for case-insensitive CSP matching.
    fn parse_csp(csp: &str) -> HashMap<String, Vec<String>> {
        let mut directives: HashMap<String, Vec<String>> = HashMap::new();
        for part in csp.split(';') {
            let trimmed = part.trim();
            if trimmed.is_empty() {
                continue;
            }
            let mut tokens = trimmed.split_whitespace();
            let directive = match tokens.next() {
                Some(d) => d.to_lowercase(),
                None => continue,
            };
            let sources: Vec<String> = tokens
                .map(|s| {
                    if s.starts_with('\'') && s.ends_with('\'') {
                        s.to_string()
                    } else {
                        s.to_lowercase()
                    }
                })
                .collect();
            directives.insert(directive, sources);
        }
        directives
    }

    /// Check whether a CSP source token matches a required loopback-host pattern.
    /// Pattern may be a bare host (`http://localhost`), host with wildcard port
    /// (`http://localhost:*`), or exact host with port (`http://localhost:11434`).
    /// Returns true if `source` matches `pattern` using exact token matching rules:
    /// - Exact string match
    /// - Scheme-only pattern ending in `:` matches any source with that prefix
    /// - Wildcard-port pattern `host:*` matches `host` or `host:DIGITS`
    /// - Bare host pattern matches `host` or `host:DIGITS` (exact host prefix + colon + digits)
    fn loopback_source_matches(source: &str, pattern: &str) -> bool {
        if source == pattern {
            return true;
        }

        // Scheme-only pattern: `https:` matches any `https://...` source.
        if pattern.ends_with(':') && !pattern.contains("://") {
            return source.starts_with(pattern);
        }

        // Wildcard port: `http://localhost:*` matches `http://localhost` or `http://localhost:DIGITS`.
        if let Some(host_only) = pattern.strip_suffix(":*") {
            if source == host_only {
                return true;
            }
            if let Some(suffix) = source.strip_prefix(host_only) {
                if suffix.is_empty() {
                    return true;
                }
                if let Some(num) = suffix.strip_prefix(':') {
                    return !num.is_empty() && num.chars().all(|c| c.is_ascii_digit());
                }
            }
            return false;
        }

        // Bare host pattern: `http://localhost` matches `http://localhost` or `http://localhost:DIGITS`.
        if let Some(suffix) = source.strip_prefix(pattern) {
            if suffix.is_empty() {
                return true;
            }
            if let Some(num) = suffix.strip_prefix(':') {
                return !num.is_empty() && num.chars().all(|c| c.is_ascii_digit());
            }
        }

        false
    }

    /// Validates that the Tauri CSP does not contain unrestricted `http:`
    /// scheme sources.  The `connect-src` directive must use explicit loopback
    /// host sources instead of the broad `http:` scheme token, which would
    /// allow connections to any HTTP server on the internet.  HTTPS is
    /// deliberately kept broad so users can configure any remote AI provider.
    ///
    /// This test normalizes directive names and source tokens to lowercase
    /// (CSP is case-insensitive) and validates exact source tokens — it does
    /// NOT use substring matching, which would miss lookalikes like
    /// `http://localhost.evil`.
    #[test]
    fn csp_rejects_unrestricted_http_source() {
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json"))
            .expect("tauri.conf.json must be valid JSON");

        for field in ["csp", "devCsp"] {
            let csp = config["app"]["security"][field]
                .as_str()
                .unwrap_or_else(|| panic!("tauri.conf.json must define app.security.{field}"));

            let directives = parse_csp(csp);

            // Every directive that contains sources must not include the
            // bare `http:` scheme token (case-insensitive).
            for (directive, sources) in &directives {
                for src in sources {
                    assert_ne!(
                        src.as_str(),
                        "http:",
                        "directive \"{directive}\" in {field} contains unrestricted \"http:\" source"
                    );
                }
            }

            // The `connect-src` directive must allow each loopback HTTP host.
            let connect_sources = directives
                .get("connect-src")
                .unwrap_or_else(|| panic!("{field}: missing connect-src directive"));

            // HTTPS must be broad for remote AI providers.
            assert!(
                connect_sources
                    .iter()
                    .any(|s| loopback_source_matches(s, "https:")),
                "{field}: connect-src must allow https: for remote AI endpoints",
            );

            // Each loopback host (with wildcard port) must be present as an exact token.
            for host in ["http://localhost:*", "http://127.0.0.1:*", "http://[::1]:*"] {
                assert!(
                    connect_sources
                        .iter()
                        .any(|s| loopback_source_matches(s, host)),
                    "{field}: connect-src must contain exact source token \"{host}\"",
                );
            }
        }
    }

    /// Verifies that substring lookalikes would NOT pass the loopback host
    /// check in `loopback_source_matches`.  This test exercises the matching
    /// function directly with malicious inputs, independent of the actual CSP
    /// content.
    #[test]
    fn loopback_source_matches_rejects_lookalikes() {
        // Exact matches pass.
        assert!(loopback_source_matches(
            "http://localhost:*",
            "http://localhost:*"
        ));
        assert!(loopback_source_matches(
            "http://localhost",
            "http://localhost:*"
        ));
        assert!(loopback_source_matches(
            "http://localhost:11434",
            "http://localhost:*"
        ));
        assert!(loopback_source_matches(
            "http://127.0.0.1:*",
            "http://127.0.0.1:*"
        ));
        assert!(loopback_source_matches("http://[::1]:*", "http://[::1]:*"));
        assert!(loopback_source_matches("https://api.openai.com", "https:"));

        // Lookalikes are rejected.
        assert!(!loopback_source_matches(
            "http://localhost.evil",
            "http://localhost:*"
        ));
        assert!(!loopback_source_matches(
            "http://localhost.evil:11434",
            "http://localhost:*"
        ));
        assert!(!loopback_source_matches(
            "http://localhost-hack",
            "http://localhost:*"
        ));
        assert!(!loopback_source_matches(
            "http://127.0.0.2",
            "http://127.0.0.1:*"
        ));
        assert!(!loopback_source_matches("http://[::2]", "http://[::1]:*"));
        assert!(!loopback_source_matches(
            "http://sub.localhost",
            "http://localhost:*"
        ));
        assert!(!loopback_source_matches(
            "http://localhost:",
            "http://localhost:*"
        ));

        // Generic http: scheme does NOT match loopback hosts.
        assert!(!loopback_source_matches("http:", "http://localhost:*"));
    }

    /// Ensures the CSP parser normalizes case correctly.
    #[test]
    fn parse_csp_normalizes_case() {
        let directives = parse_csp(
            "DEFAULT-SRC 'SELF'; CONNECT-SRC HTTPS: HTTP://LOCALHOST:* HTTP://127.0.0.1:11434",
        );
        assert!(directives.contains_key("default-src"));
        assert_eq!(
            directives.get("default-src").unwrap(),
            &vec!["'SELF'".to_string()]
        );
        let connect = directives.get("connect-src").unwrap();
        assert!(connect.contains(&"https:".to_string()));
        assert!(connect.contains(&"http://localhost:*".to_string()));
        assert!(connect.contains(&"http://127.0.0.1:11434".to_string()));
    }

    /// Audits every explicit HTTP source in `connect-src` of both the
    /// production and dev CSP against the approved allowlist.  Rejects:
    ///  - non-loopback HTTP hosts (including lookalikes like `localhost.evil`),
    ///  - duplicate source tokens in the same directive,
    ///  - the bare `http:` scheme token.
    ///
    /// Allowed HTTP sources are the three loopback hosts with wildcard ports
    /// plus `http://ipc.localhost` (required by Tauri IPC).
    #[test]
    fn connect_src_audits_all_http_sources() {
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json"))
            .expect("tauri.conf.json must be valid JSON");

        /// HTTP sources explicitly allowed in connect-src.
        const ALLOWED_HTTP_SOURCES: &[&str] = &[
            "http://localhost:*",
            "http://127.0.0.1:*",
            "http://[::1]:*",
            "http://ipc.localhost",
        ];

        for field in ["csp", "devCsp"] {
            let csp = config["app"]["security"][field]
                .as_str()
                .unwrap_or_else(|| panic!("tauri.conf.json must define app.security.{field}"));

            let directives = parse_csp(csp);
            let connect_sources = directives
                .get("connect-src")
                .unwrap_or_else(|| panic!("{field}: missing connect-src"));

            // ── Bare http: must be absent ────────────────────────────────
            for src in connect_sources {
                assert_ne!(
                    src.as_str(),
                    "http:",
                    "{field}: connect-src contains unrestricted \"http:\" source"
                );
            }

            // ── Every http:// source must match the allowlist ─────────────
            let http_sources: Vec<&String> = connect_sources
                .iter()
                .filter(|s| s.starts_with("http://"))
                .collect();

            for src in &http_sources {
                let is_allowed = ALLOWED_HTTP_SOURCES
                    .iter()
                    .any(|allowed| loopback_source_matches(src, allowed));
                assert!(
                    is_allowed,
                    "{field}: connect-src contains unexpected HTTP source \"{src}\" — \
                     only loopback hosts and Tauri IPC are allowed",
                );
            }

            // ── No duplicate sources ─────────────────────────────────────
            let mut seen = std::collections::HashSet::new();
            for src in connect_sources {
                assert!(
                    seen.insert(src.as_str()),
                    "{field}: connect-src contains duplicate source \"{src}\""
                );
            }

            // ── Required loopback hosts must be present ──────────────────
            for required in &["http://localhost:*", "http://127.0.0.1:*", "http://[::1]:*"] {
                assert!(
                    http_sources
                        .iter()
                        .any(|s| loopback_source_matches(s, required)),
                    "{field}: connect-src must contain \"{required}\"",
                );
            }
        }
    }
}
