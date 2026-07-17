// SPDX-License-Identifier: MIT
use serde::Deserialize;
use std::path::{Component, Path};
use tauri::Manager;
use tauri_plugin_fs::FsExt;

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

/// Runtime FS-scope grant for user-chosen project folders. The command is
/// callable from the webview, so it validates its input: a compromised
/// renderer must not be able to widen the scope to the whole filesystem,
/// the home directory itself, or dotfile directories like ~/.ssh.
#[tauri::command]
fn grant_fs_scope(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.is_absolute() {
        return Err("path must be absolute".into());
    }
    if p.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err("path must not contain ..".into());
    }
    if p.parent().is_none() {
        return Err("cannot grant a filesystem root".into());
    }

    // The app's own data dirs are always fine (the bundled default workspace
    // lives there — note it sits under a hidden dir on Linux).
    let under_app_dirs = [
        app.path().app_data_dir().ok(),
        app.path().app_local_data_dir().ok(),
    ]
    .into_iter()
    .flatten()
    .any(|d| p.starts_with(&d));

    if !under_app_dirs {
        if let Ok(home) = app.path().home_dir() {
            if p == home {
                return Err("cannot grant the home directory itself".into());
            }
        }
        let hidden = p.components().any(|c| match c {
            Component::Normal(name) => {
                let n = name.to_string_lossy();
                n.starts_with('.') && n != ".nesso"
            }
            _ => false,
        });
        if hidden {
            return Err("cannot grant hidden directories".into());
        }
    }

    app.fs_scope()
        .allow_directory(p, true)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![grant_fs_scope, set_app_menu])
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::{Emitter, Manager};

                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;

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
