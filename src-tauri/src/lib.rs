// SPDX-License-Identifier: MIT
use serde::Deserialize;
use std::collections::HashMap;
use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};
use tauri::Manager;
use tauri_plugin_fs::FsExt;

// ── Symlink hardening ─────────────────────────────────────────────────────────
// Reject-symlink strategy: any symlink component in a picked/granted path is
// rejected outright. resolve_existing_prefix provides defense-in-depth by
// verifying the canonical resolved path is still within the trust boundary.
//
// NOTE: A TOCTOU window exists between path validation and use — this is
// documented, not expanded into new work.

/// Returns true if any existing component of `p` is a symlink.
#[allow(dead_code)]
fn prefix_has_symlink(p: &Path) -> bool {
    let mut current = PathBuf::new();
    for comp in p.components() {
        current = current.join(comp);
        match std::fs::symlink_metadata(&current) {
            Ok(meta) => {
                if meta.file_type().is_symlink() {
                    return true;
                }
            }
            Err(_) => break, // non-existing component — no symlink possible beyond here
        }
    }
    false
}

/// Canonicalize the existing prefix of `p`; append non-existing components verbatim.
fn resolve_existing_prefix(p: &Path) -> Option<PathBuf> {
    if let Ok(resolved) = std::fs::canonicalize(p) {
        return Some(resolved);
    }
    let mut current = p.to_path_buf();
    let mut suffix: Vec<std::ffi::OsString> = Vec::new();
    loop {
        match std::fs::canonicalize(&current) {
            Ok(resolved) => {
                let mut result = resolved;
                for comp in suffix.into_iter().rev() {
                    result.push(comp);
                }
                return Some(result);
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                let file_name = current.file_name().map(|n| n.to_os_string());
                current = current.parent()?.to_path_buf();
                if let Some(name) = file_name {
                    suffix.push(name);
                }
            }
            Err(_) => return None,
        }
    }
}

// ── Trust store ──────────────────────────────────────────────────────────────
// Two grant paths: (1) user-picked folders persisted in a trust-store file,
// (2) app-data `.nesso` subtrees (auto-trusted). Project roots under app-data
// require explicit trust-store entry. Hidden components (except `.nesso`) are
// always rejected. A compromised renderer cannot widen scope.

const TRUST_STORE_FILENAME: &str = ".nesso-trusted-paths.json";

static TRUST_STORE: std::sync::Mutex<Option<HashMap<String, Vec<String>>>> =
    std::sync::Mutex::new(None);

/// Serializes trust-store modifications so concurrent approvals cannot
/// race through the read-modify-write cycle and lose entries.
static TRUST_STORE_MUTATION: std::sync::Mutex<()> = std::sync::Mutex::new(());

fn trust_store_path(app_data: &Path) -> PathBuf {
    app_data.join(TRUST_STORE_FILENAME)
}

fn load_trust_store(app_data: &Path) -> Vec<String> {
    let key = canonical_path_str(app_data);
    let mut guard = TRUST_STORE.lock().unwrap();
    if let Some(ref cache) = *guard {
        if let Some(data) = cache.get(&key) {
            return data.clone();
        }
    }
    let path = trust_store_path(app_data);
    let data: Vec<String> = std::fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default();
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
    let key = canonical_path_str(app_data);
    let mut guard = TRUST_STORE.lock().unwrap();
    let cache = guard.get_or_insert_with(HashMap::new);
    cache.insert(key, data.to_vec());
    Ok(())
}

fn add_to_trust_store(app_data: &Path, approved: &str) -> Result<(), String> {
    let _guard = TRUST_STORE_MUTATION
        .lock()
        .map_err(|e| format!("trust store lock poisoned: {e}"))?;
    let mut data = load_trust_store(app_data);
    let norm = canonical_path_str(Path::new(approved));
    if !data.contains(&norm) {
        data.push(norm);
        if data.len() > 100 {
            data.remove(0);
        }
        persist_trust_store(app_data, &data)?;
    }
    Ok(())
}

fn app_data_dirs(app: &tauri::AppHandle) -> Vec<PathBuf> {
    [
        app.path().app_data_dir().ok(),
        app.path().app_local_data_dir().ok(),
    ]
    .into_iter()
    .flatten()
    .collect()
}

/// Shared structural checks: absolute, no `..`, not root, no hidden except `.nesso`.
fn has_valid_structure(p: &Path) -> bool {
    p.is_absolute()
        && !p.components().any(|c| matches!(c, Component::ParentDir))
        && p.parent().is_some()
        && !p.components().any(|c| {
            matches!(c, Component::Normal(name) if {
                let n = name.to_string_lossy();
                n.starts_with('.') && n != ".nesso"
            })
        })
}

fn is_path_trusted(p: &Path, app_dirs: &[&Path], trust_store: &HashSet<String>) -> bool {
    // App-data `.nesso` subtrees are auto-trusted.
    if let Some(app_dir) = app_dirs.iter().find(|d| p.starts_with(d)) {
        if let Ok(rest) = p.strip_prefix(app_dir) {
            if rest
                .components()
                .any(|c| matches!(c, Component::Normal(n) if n == ".nesso"))
            {
                return true;
            }
        }
    }
    let norm = canonical_path_str(p);
    if trust_store.contains(&norm) {
        return true;
    }
    trust_store.iter().any(|trusted_path| {
        norm.starts_with(trusted_path) && {
            let rest = &norm[trusted_path.len()..];
            rest.is_empty() || rest.starts_with('/')
        }
    })
}

/// Full validation for `grant_fs_scope`. Rejects app-data roots even if they
/// appear in the trust store (they contain the trust-store file).
fn is_path_safe_for_grant(p: &Path, app_dirs: &[&Path], trust_store: &HashSet<String>) -> bool {
    if !has_valid_structure(p) {
        return false;
    }
    let canon_p = canonical_path_str(p);
    if app_dirs.iter().any(|d| canonical_path_str(d) == canon_p) {
        return false;
    }
    is_path_trusted(p, app_dirs, trust_store)
}

/// Structural validation for native folder-picker results (no trust context needed).
fn validate_picked_folder(p: &Path) -> bool {
    has_valid_structure(p)
}

/// Canonicalize a path string for trust-store persistence/comparison.
/// Normalizes: backslash→slash, trims trailing `/`, strips NT `\\?\` prefixes,
/// and lowercases on Windows for case-insensitive matching.
fn canonical_path_str(p: &Path) -> String {
    let mut s = p
        .to_string_lossy()
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_string();
    if let Some(rest) = s.strip_prefix("//?/UNC/") {
        s = format!("//{rest}");
    } else if let Some(rest) = s.strip_prefix("//?/") {
        s = rest.to_string();
    }
    #[cfg(target_os = "windows")]
    {
        s = s.to_lowercase();
    }
    s
}

/// Full validation for a native folder-picker result that additionally
/// rejects `$HOME`, ancestors of `$HOME`, app-data roots, ancestors of
/// app-data roots, and any directory containing the trust-store file.
///
/// This extends [`validate_picked_folder`] with context that the basic
/// structural check cannot see (home directory, app-data directories,
/// trust-store location).  The picker path is human-verified; this guard
/// prevents obviously-dangerous choices while still allowing legitimate
/// external projects and the default app-data workspace.
fn validate_picked_folder_full(
    p: &Path,
    home_dir: &Path,
    app_data_dir: &Path,
    app_local_data_dir: Option<&Path>,
    trust_store_filename: &str,
) -> bool {
    if !validate_picked_folder(p) {
        return false;
    }

    // Reject if the picked path equals $HOME or is an ancestor of $HOME
    // (meaning $HOME is a descendant of the picked path — picking /home
    // when $HOME=/home/user would grant scope over the entire home dir).
    let canon_p = canonical_path_str(p);
    let canon_home = canonical_path_str(home_dir);
    if canon_p == canon_home || canon_home.starts_with(&format!("{canon_p}/")) {
        return false;
    }

    // Reject if the picked path equals an app-data root or is an ancestor
    // of one.  This also covers the trust-store file (it lives in the
    // app-data root): see the explicit containment check below.
    for app_dir in [Some(app_data_dir), app_local_data_dir]
        .into_iter()
        .flatten()
    {
        let canon_app = canonical_path_str(app_dir);
        if canon_p == canon_app || canon_app.starts_with(&format!("{canon_p}/")) {
            return false;
        }
    }

    // Reject any picked path that contains the trust-store file.
    // The trust store must stay outside every grantable fs root so a
    // compromised renderer can never read or overwrite it.
    let ts_path = canonical_path_str(&app_data_dir.join(trust_store_filename));
    if ts_path == canon_p || ts_path.starts_with(&format!("{canon_p}/")) {
        return false;
    }

    true
}

// ── Trusted folder picker ────────────────────────────────────────────────────

/// Extracted folder-approval helper: validates a picked path, resolves symlinks,
/// grants fs scope, and persists trust — in that exact order.  Separated from
/// the Tauri command so it can be tested without a real dialog or runtime.
///
/// `selected` is the raw path from the native dialog (`None` = cancelled).
/// `grant_fn` receives the resolved canonical path for fs-scope grant.
/// `persist_fn` receives the canonical-path string for trust-store persistence.
///
/// Returns `Ok(Some(canonical_utf8_string))` on success, `Ok(None)` on
/// cancellation, or `Err(...)` when validation or any step fails.  The
/// returned string is the same canonical UTF-8 path used for scope grant
/// and trust persistence, so the renderer, scope, and trust store all
/// agree on path identity.
///
/// Security invariants enforced before any side effect:
///   - structural validation (no `..`, absolute, not root, no hidden except `.nesso`)
///   - full context validation (home/app-data/trust-store boundaries)
///   - symlink rejection (`prefix_has_symlink`)
///   - canonical resolution + re-validation when resolved path differs
///   - UTF-8 validation (`to_str()` — rejects non-UTF-8 before grant/persist)
///   - grant before persist (atomicity: if grant fails, trust is not persisted)
fn try_approve_folder<F, G>(
    selected: Option<&Path>,
    home_dir: &Path,
    app_data_dir: &Path,
    app_local_data_dir: Option<&Path>,
    trust_store_filename: &str,
    grant_fn: F,
    persist_fn: G,
) -> Result<Option<String>, String>
where
    F: FnOnce(&Path) -> Result<(), String>,
    G: FnOnce(&str) -> Result<(), String>,
{
    let Some(path) = selected else {
        return Ok(None);
    };

    // Reject non-UTF-8 paths before entering validation.  The trust
    // store and the renderer's IPC layer both require valid UTF-8
    // strings; using `to_string_lossy()` inside validation would
    // silently corrupt path identity and create mismatches between
    // the scope-granted path and the persisted trust entry.  The
    // later gate on `resolved.to_str()` remains as defense in depth.
    if path.to_str().is_none() {
        return Err(format!(
            "cannot grant scope: picked path is not valid UTF-8: \"{}\"",
            path.display(),
        ));
    }

    // Structural + home/app-data/trust-store context validation.
    if !validate_picked_folder_full(
        path,
        home_dir,
        app_data_dir,
        app_local_data_dir,
        trust_store_filename,
    ) {
        return Err(format!(
            "cannot grant scope for picked path \"{}\": path validation failed",
            path.display(),
        ));
    }

    // Symlink hardening: reject any picked path whose existing prefix
    // contains a symlink component BEFORE any canonicalization.
    if prefix_has_symlink(path) {
        return Err(format!(
            "cannot grant scope for picked path \"{}\": path contains a symlink",
            path.display(),
        ));
    }

    // Symlink hardening: resolve symlinks BEFORE granting fs scope.
    // If the resolved path differs from the picked path, verify the
    // resolved path still passes the full context validation.
    let resolved = resolve_existing_prefix(path)
        .ok_or_else(|| format!("cannot resolve picked path \"{}\"", path.display()))?;
    if resolved != path
        && !validate_picked_folder_full(
            &resolved,
            home_dir,
            app_data_dir,
            app_local_data_dir,
            trust_store_filename,
        )
    {
        return Err(format!(
            "picked path \"{}\" resolves to \"{}\" which is not a valid project folder",
            path.display(),
            resolved.display(),
        ));
    }

    // Reject non-UTF-8 paths before any side effect.  The trust store and
    // the renderer's IPC layer both require valid UTF-8 strings; using
    // `to_string_lossy()` would corrupt path identity and create mismatches
    // between the scope-granted path and the persisted trust entry.
    let canonical_str = resolved.to_str().ok_or_else(|| {
        format!(
            "picked path \"{}\" resolves to a non-UTF-8 path; only UTF-8 paths are supported",
            path.display(),
        )
    })?;

    // Grant the runtime fs scope for the resolved canonical path.
    grant_fn(&resolved)?;

    // Persist the canonical path so future `grant_fs_scope` calls for
    // descendants (e.g. `<project>/.nesso`) succeed.  Called only after
    // grant succeeds to prevent a dangling trust entry.
    persist_fn(canonical_str)?;

    Ok(Some(canonical_str.to_string()))
}

/// Generic callback bridging a native dialog into an async future.
/// The callback receives `Result<T, String>` where `T` is the dialog's
/// success payload (e.g. `Option<PathBuf>` for both folder picker and
/// save-file dialog callers).
#[cfg(desktop)]
type NativePathDialogCallback<T> = Box<dyn FnOnce(Result<T, String>) + Send>;

/// Bridges a callback-based native dialog into an async future using the
/// Tauri async-runtime mpsc channel.
///
/// `launch` receives a callback to invoke when the dialog completes.
/// `dialog_type` is a human-readable label ("folder picker", "save dialog",
/// etc.) included in error messages so callers can distinguish which dialog
/// failed.
///
/// The generic parameter `T` is the dialog's success payload:
/// - folder picker   → `T = Option<PathBuf>` (Some(path) = picked, None = cancelled)
/// - save-file dialog → `T = Option<PathBuf>` (Some(path) = chosen, None = cancelled)
#[cfg(desktop)]
async fn await_native_path_dialog<T, F>(launch: F, dialog_type: &str) -> Result<T, String>
where
    F: FnOnce(NativePathDialogCallback<T>),
    T: Send + 'static,
{
    let (tx, mut rx) = tauri::async_runtime::channel::<Result<T, String>>(1);

    let cb: NativePathDialogCallback<T> = Box::new(move |result: Result<T, String>| {
        let _ = tx.try_send(result);
    });

    launch(cb);

    match rx.recv().await {
        Some(Ok(value)) => Ok(value),
        Some(Err(e)) => Err(format!("{dialog_type} failed: {e}")),
        None => Err(format!("{dialog_type} was dropped without completing")),
    }
}

/// Combines the native OS folder-picker dialog with a fs-scope grant so the
/// renderer never provides the path for a *new* project folder.  The Rust side
/// owns the dialog; the returned path is therefore human-verified.
///
/// Uses the callback-based `pick_folder` via [`await_native_path_dialog`] so
/// the Tauri runtime stays unblocked while the native dialog is open.  Returns
/// `null` when the user cancels the dialog.
#[cfg(desktop)]
#[tauri::command]
async fn pick_workspace_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let selected: Option<PathBuf> = await_native_path_dialog(
        |cb| {
            app.dialog()
                .file()
                .pick_folder(move |selected_path| match selected_path {
                    None => {
                        cb(Ok(None));
                    }
                    Some(fp) => match fp.into_path() {
                        Ok(pb) => {
                            cb(Ok(Some(pb)));
                        }
                        Err(e) => {
                            cb(Err(format!("failed to convert picked path: {e}")));
                        }
                    },
                });
        },
        "folder picker",
    )
    .await?;

    let selected = selected.as_deref();

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

    try_approve_folder(
        selected,
        &home,
        &app_data,
        app_local.as_deref(),
        TRUST_STORE_FILENAME,
        |p| {
            app.fs_scope()
                .allow_directory(p, true)
                .map_err(|e| e.to_string())
        },
        |canon| {
            add_to_trust_store(
                app.path()
                    .app_data_dir()
                    .map_err(|e| e.to_string())?
                    .as_path(),
                canon,
            )
        },
    )
}

/// Non-desktop stub: `pick_workspace_folder` returns `null` (no dialog available).
#[cfg(not(desktop))]
#[tauri::command]
async fn pick_workspace_folder(_app: tauri::AppHandle) -> Result<Option<String>, String> {
    Ok(None)
}

/// Writes `contents` to `selected` and returns the chosen path.
/// Returns `Ok(Some(path))` when a path was selected and the write succeeded,
/// `Ok(None)` when no path was selected (cancellation), or `Err(...)` when
/// the write failed.  The error message includes both the selected path and
/// the underlying IO cause.
///
/// Extracted so the write logic can be tested in isolation from the dialog.
/// The caller is responsible for running this through
/// [`tauri::async_runtime::spawn_blocking`] to keep the async runtime free.
fn write_selected_export<P: AsRef<Path>>(
    selected: Option<P>,
    contents: &str,
) -> Result<Option<String>, String> {
    let Some(path) = selected else {
        return Ok(None);
    };
    let path = path.as_ref();
    // Validate UTF-8 before writing so a non-UTF-8 path is never
    // persisted to disk and then reported with `to_string_lossy()`.
    let path_str = path.to_str().ok_or_else(|| {
        format!(
            "cannot export: selected path is not valid UTF-8: \"{}\"",
            path.display(),
        )
    })?;
    std::fs::write(path, contents)
        .map_err(|e| format!("failed to write export file \"{path_str}\": {e}",))?;
    Ok(Some(path_str.to_string()))
}

/// Opens a native save-file dialog **on the Rust side** and writes the
/// provided contents, then returns the chosen absolute path (or `null` when
/// the user cancels).  This keeps the fs capability scoped to `.nesso`
/// directories while still allowing user-initiated exports to arbitrary
/// locations — the Rust side owns both the dialog and the write, so no
/// renderer-supplied path is trusted.
///
/// Uses the callback-based [`DialogExt::save_file`] via
/// [`await_native_path_dialog`] so the Tauri runtime stays unblocked while
/// the native dialog is open.  File I/O is dispatched through
/// [`tauri::async_runtime::spawn_blocking`] — never inside the dialog
/// callback — because `std::fs::write` is synchronous.
#[cfg(desktop)]
#[tauri::command]
async fn save_file_dialog(
    app: tauri::AppHandle,
    default_name: String,
    contents: String,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let selected: Option<PathBuf> = await_native_path_dialog(
        |cb| {
            app.dialog()
                .file()
                .add_filter("JSON", &["json"])
                .set_file_name(&default_name)
                .save_file(move |selected_path| match selected_path {
                    None => {
                        cb(Ok(None));
                    }
                    Some(fp) => match fp.into_path() {
                        Ok(pb) => {
                            cb(Ok(Some(pb)));
                        }
                        Err(e) => {
                            cb(Err(format!("failed to convert save path: {e}")));
                        }
                    },
                });
        },
        "save dialog",
    )
    .await?;

    tauri::async_runtime::spawn_blocking(move || write_selected_export(selected, &contents))
        .await
        .map_err(|e| format!("save dialog task failed: {e}"))?
}

/// Non-desktop stub: `save_file_dialog` is not available.  The frontend
/// must fall back to a browser-based export (File System Access API or
/// anchor-download).
#[cfg(not(desktop))]
#[tauri::command]
async fn save_file_dialog(
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

    // Symlink hardening: resolve the existing prefix and verify the canonical
    // path is still trusted.  This catches the case where a trusted path
    // contains a symlink component pointing outside the trust boundary.
    let resolved = resolve_existing_prefix(p)
        .ok_or_else(|| format!("cannot resolve path \"{path}\": symlink resolution failed"))?;
    if resolved != p && !is_path_safe_for_grant(&resolved, &app_dirs_refs, &trust_set) {
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
    use tauri::utils::acl::capability::{CapabilityFile, PermissionEntry};
    use tauri::utils::acl::RemoteUrlPattern;
    use tauri::Url;

    #[derive(Deserialize)]
    struct HttpAllowEntry {
        url: String,
    }

    fn http_scope_patterns() -> Vec<RemoteUrlPattern> {
        let capability: CapabilityFile =
            serde_json::from_str(include_str!("../capabilities/default.json"))
                .expect("default capability must deserialize");
        let capability = match capability {
            CapabilityFile::Capability(c) => c,
            CapabilityFile::List(_) | CapabilityFile::NamedList { .. } => {
                panic!("default capability must be a single capability")
            }
        };
        capability
            .permissions
            .into_iter()
            .find_map(|p| match p {
                PermissionEntry::ExtendedPermission { identifier, scope }
                    if identifier.get() == "http:default" =>
                {
                    scope.allow
                }
                _ => None,
            })
            .expect("default capability must define an http:default allow scope")
            .into_iter()
            .map(|v| {
                let entry: HttpAllowEntry = serde_json::from_value(
                    serde_json::to_value(v).expect("HTTP scope value must serialize"),
                )
                .expect("HTTP allow entry must contain a url string");
                entry
                    .url
                    .parse::<RemoteUrlPattern>()
                    .unwrap_or_else(|e| panic!("invalid HTTP URL pattern `{}`: {e}", entry.url))
            })
            .collect()
    }

    #[test]
    fn default_http_scope_deserializes_and_matches_supported_endpoints() {
        let patterns = http_scope_patterns();
        let allows = |u: &str| patterns.iter().any(|p| p.test(&u.parse::<Url>().unwrap()));
        for url in [
            "https://opencode.ai/zen/v1/chat/completions",
            "https://api.openai.com/v1/chat/completions",
            "http://localhost:11434/v1/chat/completions",
            "http://localhost/v1/chat/completions",
            "http://127.0.0.1:11434/v1/chat/completions",
            "http://127.0.0.1/v1/chat/completions",
            "http://[::1]:11434/v1/chat/completions",
            "http://[::1]/v1/chat/completions",
        ] {
            assert!(allows(url), "expected {url} to be allowed");
        }
        for url in [
            "http://example.com/v1/chat/completions",
            "http://192.168.1.10:11434/v1/chat/completions",
        ] {
            assert!(!allows(url), "expected {url} to be denied");
        }
    }
}

#[cfg(test)]
mod grant_fs_scope_tests {
    use super::*;
    use std::collections::HashSet;

    fn ts(paths: &[&str]) -> HashSet<String> {
        paths
            .iter()
            .map(|s| canonical_path_str(Path::new(s)))
            .collect()
    }

    fn ad() -> &'static Path {
        Path::new("/appdata")
    }

    // ── is_path_trusted ────────────────────────────────────────────────

    #[test]
    fn path_trust_contract() {
        let e = HashSet::new();
        let s = ts(&["/appdata/graphs", "/home/user/projects/my-graph"]);
        let s2 = ts(&["C:/Users/me/projects/my-graph"]);

        let cases: &[(&str, &HashSet<String>, bool)] = &[
            // .nesso auto-trust under app-data
            ("/appdata/graphs/.nesso", &e, true),
            ("/appdata/.nesso/subdir/file.json", &e, true),
            ("/appdata/.nesso", &e, true),
            ("/appdata/projects/my-graph/.nesso", &e, true),
            ("/appdata/.nesso/meta", &e, true),
            // non-.nesso under app-data falls through to trust store
            ("/appdata/graphs", &e, false),
            ("/appdata/graphs", &s, true),
            ("/appdata/some-file", &e, false),
            ("/appdata/foo/bar", &e, false),
            // trust-store file not auto-trusted
            ("/appdata/.nesso-trusted-paths.json", &e, false),
            // external paths
            ("/home/user/projects/my-graph", &e, false),
            ("/home/user/projects/my-graph", &s, true),
            ("/home/user/projects/my-graph/.nesso", &s, true),
            ("/home/user/projects/unknown", &e, false),
            ("/home/user/projects/some-graph", &e, false),
            // cross-platform separators
            ("\\home\\user\\projects\\my-graph", &s, true),
            ("\\home\\user\\projects\\my-graph\\.nesso", &s, true),
            ("C:\\Users\\me\\projects\\my-graph", &s2, true),
        ];
        for &(path, store, expected) in cases {
            assert_eq!(
                is_path_trusted(Path::new(path), &[ad()], store),
                expected,
                "is_path_trusted({path:?}) != {expected}"
            );
        }
    }

    // ── is_path_safe_for_grant ─────────────────────────────────────────

    #[test]
    fn grant_safety_contract() {
        let e = HashSet::new();
        let s = ts(&["/home/user/projects/my-graph", "/appdata"]);
        let ad2 = Path::new("/applocaldata");

        let cases: &[(&str, &[&Path], &HashSet<String>, bool)] = &[
            ("/home/user/../etc", &[ad()], &s, false),
            ("/home", &[ad()], &e, false),
            ("/tmp", &[ad()], &e, false),
            ("/etc", &[ad()], &e, false),
            ("/.nesso", &[ad()], &e, false),
            ("/some/random/.nesso", &[ad()], &e, false),
            ("/home/user/.nesso", &[ad()], &e, false),
            ("/appdata/.nesso-trusted-paths.json", &[ad()], &e, false),
            (
                "/appdata/.nesso-trusted-paths.json",
                &[ad()],
                &ts(&["/appdata/.nesso-trusted-paths.json"]),
                false,
            ),
            ("/appdata", &[ad()], &s, false), // app-data root rejected even if in store
            ("/applocaldata", &[ad(), ad2], &e, false),
            ("/home/user/projects/my-graph/.nesso", &[ad()], &s, true),
            ("/appdata/.nesso", &[ad()], &e, true),
        ];
        for &(path, dirs, store, expected) in cases {
            assert_eq!(
                is_path_safe_for_grant(Path::new(path), dirs, store),
                expected,
                "is_path_safe_for_grant({path:?}) != {expected}"
            );
        }
    }

    // ── validate_picked_folder ─────────────────────────────────────────

    #[test]
    fn picker_structure_contract() {
        let cases: &[(&str, bool)] = &[
            ("/home/user/projects/ok", true),
            ("/home/user/projects/.nesso", true),
            ("/", false),
            ("relative/path", false),
            ("/home/../etc", false),
            ("/home/user/.ssh", false),
            ("/home/user/.config/nvim", false),
        ];
        for &(path, expected) in cases {
            assert_eq!(
                validate_picked_folder(Path::new(path)),
                expected,
                "validate_picked_folder({path:?}) != {expected}"
            );
        }
    }

    // ── canonical_path_str ─────────────────────────────────────────────

    fn win_lower(s: &str) -> String {
        let s = canonical_path_str(Path::new(s));
        if cfg!(target_os = "windows") {
            s.to_lowercase()
        } else {
            s
        }
    }

    #[test]
    fn canonicalization_contract() {
        let cases: &[(&str, &str)] = &[
            (
                "C:\\Users\\me\\projects\\my-graph",
                &win_lower("C:/Users/me/projects/my-graph"),
            ),
            (
                "C:\\Users/me\\projects\\my-graph/",
                &win_lower("C:/Users/me/projects/my-graph"),
            ),
            (
                "/home/user/projects/my-graph/",
                "/home/user/projects/my-graph",
            ),
            (
                "/home/user/projects/my-graph///",
                "/home/user/projects/my-graph",
            ),
            ("\\\\?\\C:\\Users\\me", &win_lower("C:/Users/me")),
            (
                "\\\\?\\C:\\Users\\me\\projects\\my-graph\\.nesso",
                &win_lower("C:/Users/me/projects/my-graph/.nesso"),
            ),
            ("\\\\?\\UNC\\server\\share\\folder", "//server/share/folder"),
            ("\\\\server\\share\\folder", "//server/share/folder"),
        ];
        for &(input, expected) in cases {
            let got = canonical_path_str(Path::new(input));
            assert_eq!(got, expected, "canonical_path_str({input:?})");
        }
    }

    #[test]
    fn canonical_forms_are_consistent() {
        let unc_n = canonical_path_str(Path::new("\\\\server\\share\\folder"));
        let unc_x = canonical_path_str(Path::new("\\\\?\\UNC\\server\\share\\folder"));
        assert_eq!(unc_n, unc_x, "normal and extended UNC must match");
        let drv_n = canonical_path_str(Path::new("C:\\Users\\me\\projects"));
        let drv_x = canonical_path_str(Path::new("\\\\?\\C:\\Users\\me\\projects"));
        assert_eq!(drv_n, drv_x, "normal and extended drive must match");
    }

    #[test]
    fn trust_store_matches_canonical_variants() {
        let s = ts(&["C:/Users/me/projects/my-graph", "//server/share"]);
        let a = ad();
        let cases: &[(&str, bool)] = &[
            ("\\\\?\\C:\\Users\\me\\projects\\my-graph", true),
            ("\\\\?\\C:\\Users\\me\\projects\\my-graph\\", true),
            ("\\\\?\\UNC\\server\\share", true),
            ("\\\\server\\share", true),
        ];
        for &(path, expected) in cases {
            assert_eq!(
                is_path_trusted(Path::new(path), &[a], &s),
                expected,
                "trust store + canonical match for {path:?}"
            );
        }
    }

    // ── validate_picked_folder_full ────────────────────────────────────

    #[test]
    fn picker_full_context_contract() {
        let home = Path::new("/home/user");
        let adp = Path::new("/appdata");
        let adl = Path::new("/applocaldata");
        let ts_file = TRUST_STORE_FILENAME;

        let cases: &[(&str, &Path, &Path, Option<&Path>, bool)] = &[
            ("/home/user", home, adp, None, false),
            ("/home", home, adp, None, false),
            ("/", home, adp, None, false),
            ("/appdata", home, adp, None, false),
            ("/var/lib", home, Path::new("/var/lib/app"), None, false),
            ("/applocaldata", home, adp, Some(adl), false),
            ("/home/user/projects/my-graph", home, adp, None, true),
            ("/appdata/graphs", home, adp, None, true),
            ("/appdata/graphs/.nesso", home, adp, None, true),
        ];
        for &(picked, h, ad, al, expected) in cases {
            assert_eq!(
                validate_picked_folder_full(Path::new(picked), h, ad, al, ts_file),
                expected,
                "validate_picked_folder_full({picked:?}) != {expected}"
            );
        }
    }

    // ── Trust store serialization ──────────────────────────────────────

    #[test]
    fn trust_store_round_trip_as_json_array_of_path_strings() {
        let dir = tempfile::tempdir().expect("tempdir");
        let app_data = dir.path();
        let paths = vec![
            "/home/user/projects/my-graph".to_string(),
            "/home/user/projects/other-project".to_string(),
        ];
        persist_trust_store(app_data, &paths).expect("persist");
        let raw = std::fs::read_to_string(app_data.join(TRUST_STORE_FILENAME)).expect("read");
        let parsed: Vec<String> = serde_json::from_str(&raw).expect("deserialize");
        assert_eq!(parsed, paths);
        {
            let mut guard = TRUST_STORE.lock().unwrap();
            *guard = None;
        }
        assert_eq!(load_trust_store(app_data), paths);
    }

    #[test]
    fn trust_store_handles_missing_file() {
        let dir = tempfile::tempdir().expect("tempdir");
        {
            let mut guard = TRUST_STORE.lock().unwrap();
            *guard = None;
        }
        assert!(load_trust_store(dir.path()).is_empty());
    }

    #[test]
    fn trust_store_cache_is_keyed_by_app_data_path() {
        let dir_a = tempfile::tempdir().expect("A");
        let dir_b = tempfile::tempdir().expect("B");
        let pa = vec!["/home/user/projects/a".to_string()];
        let pb = vec!["/home/user/projects/b".to_string()];
        persist_trust_store(dir_a.path(), &pa).expect("persist A");
        persist_trust_store(dir_b.path(), &pb).expect("persist B");
        {
            let mut guard = TRUST_STORE.lock().unwrap();
            *guard = None;
        }
        assert_eq!(load_trust_store(dir_a.path()), pa);
        assert_eq!(
            load_trust_store(dir_b.path()),
            pb,
            "cache must be keyed by app-data path"
        );
    }

    #[test]
    fn concurrent_trust_store_updates_do_not_lose_entries() {
        let dir = tempfile::tempdir().expect("tempdir");
        let app_data = dir.path();
        // Reset the global cache so every thread loads fresh from disk.
        {
            let mut guard = TRUST_STORE.lock().unwrap();
            *guard = None;
        }

        let entries: Vec<String> = (0..10)
            .map(|i| format!("/home/user/projects/project-{i}"))
            .collect();

        std::thread::scope(|s| {
            for entry in &entries {
                let entry = entry.clone();
                let app_data = app_data.to_path_buf();
                s.spawn(move || {
                    add_to_trust_store(&app_data, &entry).expect("concurrent add must succeed");
                });
            }
        });

        // Reset cache to force a re-read from disk.
        {
            let mut guard = TRUST_STORE.lock().unwrap();
            *guard = None;
        }

        let stored = load_trust_store(app_data);
        for entry in &entries {
            let norm = canonical_path_str(Path::new(entry));
            assert!(
                stored.contains(&norm),
                "entry {entry} must be in trust store after concurrent adds"
            );
        }
        assert_eq!(stored.len(), entries.len(), "no duplicate entries expected");
    }
}

#[cfg(test)]
mod symlink_tests {
    use super::*;

    #[test]
    fn prefix_has_symlink_detects_symlink_component() {
        let dir = tempfile::tempdir().expect("tempdir");
        let real = dir.path().join("real_dir");
        std::fs::create_dir(&real).expect("mkdir");
        #[cfg(unix)]
        {
            let sym = dir.path().join("link_dir");
            std::os::unix::fs::symlink(&real, &sym).expect("symlink");
            assert!(prefix_has_symlink(&sym));
            assert!(prefix_has_symlink(&sym.join("child.txt")));
        }
    }

    #[test]
    fn prefix_has_symlink_handles_nonexistent_paths() {
        let existing = std::env::current_dir().expect("cwd");
        let nonexistent = existing.join("noexist_92734").join("deep").join("file.txt");
        let _ = prefix_has_symlink(&nonexistent); // must not panic
    }

    #[test]
    #[cfg(unix)]
    fn prefix_has_symlink_rejects_symlink_to_outside_target() {
        let dir = tempfile::tempdir().expect("tempdir");
        let sym = dir.path().join("escape_to_tmp");
        std::os::unix::fs::symlink(Path::new("/tmp"), &sym).expect("symlink");
        assert!(prefix_has_symlink(&sym));
        assert!(prefix_has_symlink(&sym.join("subdir")));
    }

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
        let resolved = resolve_existing_prefix(&sym).expect("resolve");
        assert!(resolved.is_absolute());
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
            .and_then(|v| v.as_array())
            .expect("default capability must define permissions")
            .clone()
    }

    fn allowed_paths(permission: &Value) -> Vec<String> {
        permission
            .get("allow")
            .and_then(|v| v.as_array())
            .expect("scoped permission must define allow entries")
            .iter()
            .map(|e| {
                e.get("path")
                    .and_then(|v| v.as_str())
                    .unwrap_or_else(|| e.as_str().unwrap())
                    .to_string()
            })
            .collect()
    }

    #[test]
    fn fs_permissions_are_minimal_scoped_reject_broad_defaults() {
        let perms = permissions();
        let scalar: Vec<&str> = perms.iter().filter_map(|e| e.as_str()).collect();
        let expected: Vec<String> = NESSO_PATHS.iter().map(|p| (*p).to_string()).collect();

        assert!(!scalar.contains(&"fs:default"), "fs:default must be absent");
        for id in ["fs:allow-watch", "fs:allow-unwatch"] {
            assert!(scalar.contains(&id), "expected retained permission `{id}`");
        }
        for id in [
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
                !scalar.contains(&id),
                "broad permission `{id}` must be removed"
            );
        }
        for id in SCOPED_PERMISSIONS {
            let p = perms
                .iter()
                .find(|e| e.get("identifier").and_then(|v| v.as_str()) == Some(id))
                .unwrap_or_else(|| panic!("missing scoped permission `{id}`"));
            assert_eq!(
                allowed_paths(p),
                expected,
                "permission `{id}` must use .nesso allowlist"
            );
        }
        let scope = perms
            .iter()
            .find(|e| e.get("identifier").and_then(|v| v.as_str()) == Some("fs:scope"))
            .expect("missing fs:scope permission");
        assert_eq!(
            allowed_paths(scope),
            expected,
            "fs:scope must retain .nesso allowlist"
        );
    }

    #[test]
    fn no_scope_widening_default_components() {
        let perms = permissions();
        let scalar: Vec<&str> = perms.iter().filter_map(|e| e.as_str()).collect();
        for id in [
            "fs:create-app-specific-dirs",
            "fs:read-app-specific-dirs-recursive",
            "fs:deny-default",
        ] {
            assert!(
                !scalar.contains(&id),
                "permission `{id}` is part of fs:default and must be absent"
            );
        }
    }
}

// ── Picker approval regression tests ─────────────────────────────────────────
// Tests for the extracted `try_approve_folder` helper that encapsulates the
// post-dialog validation → grant → persist chain.  Each test models a
// scenario from the issue #141 approval flow without a real Tauri runtime.

#[cfg(test)]
mod picker_approval_tests {
    use super::*;

    /// Create a temporary directory whose name does NOT start with `.`,
    /// so it passes `has_valid_structure` (hidden-component rejection).
    /// Also resolves symlinks in the system temp-dir prefix (on macOS
    /// `/var` and `/tmp` are symlinks) so `prefix_has_symlink` doesn't
    /// reject the test path.
    fn temp_dir_no_dot() -> tempfile::TempDir {
        let sys_tmp = std::env::temp_dir();
        let base = resolve_existing_prefix(&sys_tmp).unwrap_or(sys_tmp);
        tempfile::Builder::new()
            .prefix("nesso-test-")
            .tempdir_in(&base)
            .expect("tempdir")
    }

    #[test]
    fn successful_selection_validates_grants_persists_in_order() {
        let dir = temp_dir_no_dot();
        let home = dir.path().join("home").join("user");
        std::fs::create_dir_all(&home).expect("mkdir home");
        let project = home.join("projects").join("my-graph");
        std::fs::create_dir_all(&project).expect("mkdir project");
        let app_data = dir.path().join("appdata");
        std::fs::create_dir_all(&app_data).expect("mkdir appdata");

        // Use RefCell so both closures can record their call order through
        // interior mutability without conflicting mutable borrows.
        let calls: std::cell::RefCell<Vec<&str>> = std::cell::RefCell::new(Vec::new());

        let result = try_approve_folder(
            Some(project.as_path()),
            &home,
            &app_data,
            None,
            TRUST_STORE_FILENAME,
            |p: &Path| {
                calls.borrow_mut().push("grant");
                assert!(p.is_absolute(), "grant must receive canonical path");
                Ok(())
            },
            |s: &str| {
                calls.borrow_mut().push("persist");
                assert!(!s.is_empty(), "persist must receive canonical string");
                Ok(())
            },
        );

        assert!(
            result.is_ok(),
            "approval must succeed for valid path: {result:?}"
        );
        let recorded = calls.borrow();
        assert!(recorded.contains(&"grant"), "grant must have been called");
        assert!(
            recorded.contains(&"persist"),
            "persist must have been called"
        );
        assert_eq!(
            *recorded,
            vec!["grant", "persist"],
            "grant must be called before persist"
        );
    }

    #[test]
    fn cancellation_has_no_side_effects() {
        let home = Path::new("/home/user");
        let app_data = Path::new("/appdata");

        let grant_called = std::sync::atomic::AtomicBool::new(false);
        let persist_called = std::sync::atomic::AtomicBool::new(false);

        let result = try_approve_folder(
            None,
            home,
            app_data,
            None,
            TRUST_STORE_FILENAME,
            |_p: &Path| {
                grant_called.store(true, std::sync::atomic::Ordering::SeqCst);
                Ok(())
            },
            |_s: &str| {
                persist_called.store(true, std::sync::atomic::Ordering::SeqCst);
                Ok(())
            },
        );

        assert!(result.is_ok(), "cancellation must not produce an error");
        assert_eq!(result.unwrap(), None, "cancellation must return None");
        assert!(
            !grant_called.load(std::sync::atomic::Ordering::SeqCst),
            "grant must NOT be called on cancellation"
        );
        assert!(
            !persist_called.load(std::sync::atomic::Ordering::SeqCst),
            "persist must NOT be called on cancellation"
        );
    }

    #[test]
    fn invalid_selection_has_no_side_effects() {
        let home = Path::new("/home/user");
        let app_data = Path::new("/appdata");

        let grant_called = std::sync::atomic::AtomicBool::new(false);
        let persist_called = std::sync::atomic::AtomicBool::new(false);

        // Root path is invalid — `has_valid_structure` rejects paths with no parent.
        let result = try_approve_folder(
            Some(Path::new("/")),
            home,
            app_data,
            None,
            TRUST_STORE_FILENAME,
            |_p: &Path| {
                grant_called.store(true, std::sync::atomic::Ordering::SeqCst);
                Ok(())
            },
            |_s: &str| {
                persist_called.store(true, std::sync::atomic::Ordering::SeqCst);
                Ok(())
            },
        );

        assert!(
            result.is_err(),
            "approval must fail for invalid (root) path"
        );
        assert!(
            !grant_called.load(std::sync::atomic::Ordering::SeqCst),
            "grant must NOT be called when validation fails"
        );
        assert!(
            !persist_called.load(std::sync::atomic::Ordering::SeqCst),
            "persist must NOT be called when validation fails"
        );
    }

    #[test]
    fn scope_grant_failure_does_not_persist_trust() {
        let dir = temp_dir_no_dot();
        let home = dir.path().join("home").join("user");
        std::fs::create_dir_all(&home).expect("mkdir home");
        let project = home.join("projects").join("my-graph");
        std::fs::create_dir_all(&project).expect("mkdir project");
        let app_data = dir.path().join("appdata");
        std::fs::create_dir_all(&app_data).expect("mkdir appdata");

        let persist_called = std::sync::atomic::AtomicBool::new(false);

        let result = try_approve_folder(
            Some(project.as_path()),
            &home,
            &app_data,
            None,
            TRUST_STORE_FILENAME,
            |_p: &Path| Err("simulated scope grant failure".to_string()),
            |_s: &str| {
                persist_called.store(true, std::sync::atomic::Ordering::SeqCst);
                Ok(())
            },
        );

        assert!(
            result.is_err(),
            "approval must fail when scope grant fails: {result:?}"
        );
        assert!(
            !persist_called.load(std::sync::atomic::Ordering::SeqCst),
            "persist must NOT be called when scope grant fails"
        );
    }

    /// Non-UTF-8 paths must be rejected before any side effect (grant or
    /// persist).  The trust store and the renderer's IPC layer both require
    /// valid UTF-8 strings; using `to_string_lossy()` would corrupt path
    /// identity and create mismatches between the scope-granted path and
    /// the persisted trust entry.
    ///
    /// The test creates a valid UTF-8 project-parent directory on disk,
    /// then appends an invalid UTF-8 byte suffix to the path.  On macOS
    /// (APFS) the suffix cannot live on the filesystem, but
    /// `resolve_existing_prefix` walks up to the existing parent, appends
    /// it verbatim, and `to_str()` still rejects it — the same path
    /// resolution the other picker fixtures exercise.
    #[test]
    #[cfg(unix)]
    fn non_utf8_path_rejected_before_any_side_effect() {
        use std::os::unix::ffi::OsStrExt;

        let dir = temp_dir_no_dot();
        let home = dir.path().join("home").join("user");
        std::fs::create_dir_all(&home).expect("mkdir home");

        // Create the project parent with valid UTF-8 so
        // resolve_existing_prefix can walk up to it on both Linux and macOS.
        let project_parent = home.join("projects").join("my-graph");
        std::fs::create_dir_all(&project_parent).expect("mkdir project parent");

        // 0xC3 is a UTF-8 lead byte; 0x28 ('(') is not a valid
        // continuation byte, so the whole sequence is invalid UTF-8.
        let non_utf8_name = std::ffi::OsStr::from_bytes(b"proj\xc3\x28");
        let project = project_parent.join(non_utf8_name);

        let app_data = dir.path().join("appdata");
        std::fs::create_dir_all(&app_data).expect("mkdir appdata");

        let grant_called = std::sync::atomic::AtomicBool::new(false);
        let persist_called = std::sync::atomic::AtomicBool::new(false);

        let result = try_approve_folder(
            Some(project.as_path()),
            &home,
            &app_data,
            None,
            TRUST_STORE_FILENAME,
            |_p: &Path| {
                grant_called.store(true, std::sync::atomic::Ordering::SeqCst);
                Ok(())
            },
            |_s: &str| {
                persist_called.store(true, std::sync::atomic::Ordering::SeqCst);
                Ok(())
            },
        );

        assert!(
            result.is_err(),
            "non-UTF-8 resolved path must be rejected: got {result:?}"
        );
        let err = result.unwrap_err();
        assert!(
            err.to_lowercase().contains("utf-8"),
            "error must mention UTF-8 issue: {err}"
        );
        assert!(
            !grant_called.load(std::sync::atomic::Ordering::SeqCst),
            "grant must NOT be called for non-UTF-8 path"
        );
        assert!(
            !persist_called.load(std::sync::atomic::Ordering::SeqCst),
            "persist must NOT be called for non-UTF-8 path"
        );
    }

    /// When the callback is invoked with `Err(...)`, the error returned
    /// by `await_native_path_dialog` must wrap the original error with
    /// the dialog-type context string so callers can distinguish which
    /// dialog failed without inspecting the inner message.
    #[test]
    #[cfg(desktop)]
    fn await_native_path_dialog_wraps_callback_error_with_context() {
        use tauri::async_runtime::TokioRuntime;

        let rt = TokioRuntime::new().expect("create test runtime");

        rt.block_on(async {
            let result = await_native_path_dialog(
                |cb: NativePathDialogCallback<Option<String>>| {
                    cb(Err("inner conversion error".to_string()));
                },
                "folder picker",
            )
            .await;

            match result {
                Err(e) => {
                    assert!(
                        e.contains("folder picker"),
                        "error must include dialog-type context: {e}"
                    );
                    assert!(
                        e.contains("inner conversion error"),
                        "error must include original callback error: {e}"
                    );
                }
                other => panic!("expected Err, got {other:?}"),
            }
        });
    }

    /// Regression: the `await_native_path_dialog` bridge must not block the
    /// Tauri async runtime while the native dialog is open.  This test
    /// exercises the production helper directly on a real `TokioRuntime`:
    /// a heartbeat task ticks while the helper future is pending, the main
    /// task deterministically receives a notification (no wall-clock
    /// threshold), and the spawned heartbeat terminates on its own.
    #[test]
    #[cfg(desktop)]
    fn await_native_path_dialog_yields_while_pending() {
        use std::sync::atomic::{AtomicU32, Ordering};
        use std::sync::{Arc, Mutex};
        use tauri::async_runtime::TokioRuntime;

        let rt = TokioRuntime::new().expect("create test runtime");

        rt.block_on(async {
            let heartbeat = Arc::new(AtomicU32::new(0));

            // Channel: heartbeat notifies after ticking.
            let (tick_tx, mut tick_rx) = tauri::async_runtime::channel::<()>(1);

            // Channel: callback-ready signal from the picker closure.
            let (ready_tx, mut ready_rx) = tauri::async_runtime::channel::<()>(1);

            // Capture the callback that `await_native_path_dialog` gives us.
            let cb_cell: Arc<Mutex<Option<NativePathDialogCallback<Option<String>>>>> =
                Arc::new(Mutex::new(None));
            let cc = cb_cell.clone();

            // Spawn the picker helper — it will be pending until the
            // captured callback is invoked.
            let picker_handle = rt.spawn(async move {
                await_native_path_dialog(
                    move |cb| {
                        *cc.lock().unwrap() = Some(cb);
                        let _ = ready_tx.try_send(());
                    },
                    "folder picker",
                )
                .await
            });

            // Wait until the callback is stored before spawning the
            // heartbeat — avoids a race where the heartbeat signals
            // before the picker task has executed the closure.
            ready_rx.recv().await.expect("callback store must notify");

            // Heartbeat task: ticks once, notifies, then terminates.
            {
                let hb = heartbeat.clone();
                rt.spawn(async move {
                    hb.fetch_add(1, Ordering::SeqCst);
                    let _ = tick_tx.send(()).await;
                });
            }

            // Wait for the heartbeat to tick — deterministically,
            // without depending on a fixed wall-clock threshold.
            tick_rx.recv().await.expect("heartbeat must notify");

            let mid_count = heartbeat.load(Ordering::SeqCst);
            assert!(
                mid_count >= 1,
                "heartbeat must progress while picker is pending: \
                 heartbeat only ticked {mid_count} times (expected ≥ 1)"
            );

            // Invoke the captured callback — simulate the user picking
            // a folder.
            let cb = cb_cell
                .lock()
                .unwrap()
                .take()
                .expect("callback must be captured by await_native_path_dialog");
            cb(Ok(Some("/picked/path".to_string())));

            // The picker future should now resolve.
            let result = picker_handle.await.expect("picker task must not panic");

            assert_eq!(
                result,
                Ok(Some("/picked/path".to_string())),
                "picker must return the selected path"
            );
        });
    }

    /// Distinguishes callback cancellation (Ok(None)) from a dropped
    /// callback (channel closed without invoking), and verifies a PathBuf
    /// payload round-trips correctly.  The test exercises every resolution
    /// path of [`await_native_path_dialog`] in one compact function.
    #[test]
    #[cfg(desktop)]
    fn await_native_path_dialog_callback_cancellation_vs_drop() {
        use tauri::async_runtime::TokioRuntime;

        let rt = TokioRuntime::new().expect("create test runtime");

        rt.block_on(async {
            // 1. Callback returns cancellation — the channel carries Ok(None).
            let result = await_native_path_dialog(
                |cb: NativePathDialogCallback<Option<PathBuf>>| {
                    cb(Ok(None));
                },
                "save dialog",
            )
            .await;
            assert_eq!(
                result,
                Ok(None),
                "Ok(None) callback payload must surface as Ok(None)"
            );

            // 2. Callback is dropped without invoking — the channel send-
            //    half is dropped, so rx.recv().await returns None and the
            //    helper returns an Err mentioning "dropped".
            let result = await_native_path_dialog(
                |_cb: NativePathDialogCallback<Option<PathBuf>>| {
                    // drop the callback without sending
                },
                "save dialog",
            )
            .await;
            assert!(
                result.is_err(),
                "dropped callback must produce Err, got {result:?}"
            );
            let err = result.unwrap_err();
            assert!(
                err.contains("dropped without completing"),
                "dropped callback error must mention 'dropped', got: {err}"
            );

            // 3. Successful PathBuf round-trip — the payload survives
            //    the channel unmodified.
            let result = await_native_path_dialog(
                |cb: NativePathDialogCallback<Option<PathBuf>>| {
                    cb(Ok(Some(PathBuf::from("/export/data.json"))));
                },
                "save dialog",
            )
            .await;
            assert_eq!(
                result,
                Ok(Some(PathBuf::from("/export/data.json"))),
                "PathBuf payload must round-trip through the bridge unchanged"
            );
        });
    }
}

// ── Save export regression tests ──────────────────────────────────────────────
// Tests for the extracted `write_selected_export` helper that encapsulates
// the "write contents to user-chosen path" logic independent of the dialog.

#[cfg(test)]
mod save_export_tests {
    use super::*;

    #[test]
    fn selected_path_writes_exact_bytes_and_returns_path() {
        let dir = tempfile::tempdir().expect("tempdir");
        let file_path = dir.path().join("export.json");
        let contents = "{\"version\":1}";

        let result = write_selected_export(Some(file_path.clone()), contents);
        assert!(
            result.is_ok(),
            "write must succeed for valid path: {result:?}"
        );
        let returned = result.unwrap();
        assert!(
            returned.is_some(),
            "must return Some(path) when a path is selected"
        );

        let written = std::fs::read_to_string(&file_path).expect("file must exist after write");
        assert_eq!(written, contents, "file must contain exact bytes");
    }

    #[test]
    fn cancellation_returns_none_without_writing() {
        let dir = tempfile::tempdir().expect("tempdir");
        let original_file_count = std::fs::read_dir(dir.path()).expect("read dir").count();

        let result = write_selected_export::<PathBuf>(None, "should not be written");
        assert!(
            result.is_ok(),
            "cancellation must not produce an error: {result:?}"
        );
        assert_eq!(result.unwrap(), None, "cancellation must return None");

        let after_file_count = std::fs::read_dir(dir.path()).expect("read dir").count();
        assert_eq!(
            after_file_count, original_file_count,
            "no file must be created on cancellation"
        );
    }

    /// Non-UTF-8 paths must be rejected before any I/O.  The helper must
    /// never call `std::fs::write` with a non-UTF-8 path and must return a
    /// descriptive error.
    #[test]
    #[cfg(unix)]
    fn non_utf8_path_rejected_before_write() {
        use std::os::unix::ffi::OsStrExt;

        let dir = tempfile::tempdir().expect("tempdir");
        // 0xC3 is a UTF-8 lead byte; 0x28 is not a valid continuation byte.
        let non_utf8_name = std::ffi::OsStr::from_bytes(b"export\xc3\x28.json");
        let file_path = dir.path().join(non_utf8_name);

        let result = write_selected_export(Some(file_path.clone()), "data");
        assert!(
            result.is_err(),
            "non-UTF-8 path must be rejected: got {result:?}"
        );
        let err = result.unwrap_err();
        assert!(
            err.to_lowercase().contains("utf-8"),
            "error must mention UTF-8: {err}"
        );
        assert!(
            !file_path.exists(),
            "no file must be written for non-UTF-8 path"
        );
    }

    #[test]
    fn write_error_contains_selected_path_and_underlying_cause() {
        let dir = tempfile::tempdir().expect("tempdir");
        // A directory is not a writable file path — write must fail.
        let result = write_selected_export(Some(dir.path().to_path_buf()), "data");
        match result {
            Err(e) => {
                let path_str = dir.path().to_string_lossy();
                assert!(
                    e.contains(&*path_str),
                    "error must contain selected path \"{path_str}\": got \"{e}\""
                );
                // The underlying OS error on most platforms will be something like
                // "Is a directory" or "Access is denied".  Verify some error text
                // is present beyond just the path.
                let after_path = &e[e.find(&*path_str).unwrap_or(0) + path_str.len()..];
                assert!(
                    !after_path.trim().is_empty(),
                    "error must contain underlying cause after the path: got \"{e}\""
                );
            }
            Ok(v) => panic!("expected Err, got Ok({v:?})"),
        }
    }
}

#[cfg(test)]
mod csp_tests {
    use serde_json::Value;
    use std::collections::HashMap;

    fn parse_csp(csp: &str) -> HashMap<String, Vec<String>> {
        let mut d = HashMap::new();
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
            d.insert(
                directive,
                tokens
                    .map(|s| {
                        if s.starts_with('\'') && s.ends_with('\'') {
                            s.to_string()
                        } else {
                            s.to_lowercase()
                        }
                    })
                    .collect(),
            );
        }
        d
    }

    /// Exact-token check: `source` matches `pattern` where pattern may use
    /// `:*` wildcard port (matches bare host or host:digits).
    fn csp_match(source: &str, pattern: &str) -> bool {
        if source == pattern {
            return true;
        }
        if pattern.ends_with(':') && !pattern.contains("://") {
            return source.starts_with(pattern);
        }
        if let Some(base) = pattern.strip_suffix(":*") {
            if source == base {
                return true;
            }
            if let Some(suffix) = source.strip_prefix(base) {
                if let Some(port) = suffix.strip_prefix(':') {
                    return !port.is_empty() && port.chars().all(|c| c.is_ascii_digit());
                }
            }
            return false;
        }
        if let Some(suffix) = source.strip_prefix(pattern) {
            if suffix.is_empty() {
                return true;
            }
            if let Some(port) = suffix.strip_prefix(':') {
                return !port.is_empty() && port.chars().all(|c| c.is_ascii_digit());
            }
        }
        false
    }

    #[test]
    fn csp_contract() {
        let config: Value = serde_json::from_str(include_str!("../tauri.conf.json"))
            .expect("tauri.conf.json must be valid JSON");

        for field in ["csp", "devCsp"] {
            let csp_str = config["app"]["security"][field]
                .as_str()
                .unwrap_or_else(|| panic!("tauri.conf.json must define app.security.{field}"));
            let dirs = parse_csp(csp_str);
            let connect = dirs
                .get("connect-src")
                .unwrap_or_else(|| panic!("{field}: missing connect-src"));

            // No bare http: in any directive
            for (directive, sources) in &dirs {
                for src in sources {
                    assert_ne!(
                        src.as_str(),
                        "http:",
                        "{field} directive \"{directive}\" contains http:"
                    );
                }
            }

            // https: must be broad
            assert!(
                connect.iter().any(|s| csp_match(s, "https:")),
                "{field}: missing https:"
            );

            // Required loopback hosts
            for host in &["http://localhost:*", "http://127.0.0.1:*", "http://[::1]:*"] {
                assert!(
                    connect.iter().any(|s| csp_match(s, host)),
                    "{field}: missing {host}"
                );
            }

            // Audit all http:// sources against allowlist
            let allowlist = &[
                "http://localhost:*",
                "http://127.0.0.1:*",
                "http://[::1]:*",
                "http://ipc.localhost",
            ];
            for src in connect.iter().filter(|s| s.starts_with("http://")) {
                assert!(
                    allowlist.iter().any(|a| csp_match(src, a)),
                    "{field}: unexpected HTTP source \"{src}\""
                );
            }

            // No duplicates
            let mut seen = std::collections::HashSet::new();
            for src in connect {
                assert!(
                    seen.insert(src.as_str()),
                    "{field}: duplicate source \"{src}\""
                );
            }
        }
    }

    #[test]
    fn csp_match_rejects_lookalikes() {
        assert!(csp_match("http://localhost:*", "http://localhost:*"));
        assert!(csp_match("http://localhost", "http://localhost:*"));
        assert!(csp_match("http://localhost:11434", "http://localhost:*"));
        assert!(csp_match("https://api.openai.com", "https:"));
        for (src, pat) in [
            ("http://localhost.evil", "http://localhost:*"),
            ("http://localhost.evil:11434", "http://localhost:*"),
            ("http://localhost-hack", "http://localhost:*"),
            ("http://127.0.0.2", "http://127.0.0.1:*"),
            ("http://[::2]", "http://[::1]:*"),
            ("http://sub.localhost", "http://localhost:*"),
            ("http://localhost:", "http://localhost:*"),
            ("http:", "http://localhost:*"),
        ] {
            assert!(!csp_match(src, pat), "{src:?} must not match {pat:?}");
        }
    }

    #[test]
    fn parse_csp_normalizes_case() {
        let dirs = parse_csp("DEFAULT-SRC 'SELF'; CONNECT-SRC HTTPS: HTTP://LOCALHOST:*");
        assert_eq!(
            dirs.get("default-src").unwrap(),
            &vec!["'SELF'".to_string()]
        );
        let c = dirs.get("connect-src").unwrap();
        assert!(c.contains(&"https:".to_string()));
        assert!(c.contains(&"http://localhost:*".to_string()));
    }
}
