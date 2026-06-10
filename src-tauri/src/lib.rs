// SPDX-License-Identifier: MIT
use std::path::{Component, Path};
use tauri::Manager;
use tauri_plugin_fs::FsExt;

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
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![grant_fs_scope])
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
                use tauri::{Emitter, Manager};

                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;

                let about_i = MenuItemBuilder::with_id("about", "About Nesso").build(app)?;
                let new_project_i = MenuItemBuilder::with_id("new-project", "New Project…")
                    .accelerator("CmdOrCtrl+Shift+N")
                    .build(app)?;
                let open_project_i = MenuItemBuilder::with_id("open-project", "Open Project…")
                    .accelerator("CmdOrCtrl+O")
                    .build(app)?;

                let mut menu = MenuBuilder::new(app);

                #[cfg(target_os = "macos")]
                {
                    let app_menu = SubmenuBuilder::new(app, "Nesso")
                        .item(&about_i)
                        .separator()
                        .services()
                        .separator()
                        .hide()
                        .hide_others()
                        .show_all()
                        .separator()
                        .quit()
                        .build()?;
                    menu = menu.item(&app_menu);
                }

                let file_menu = SubmenuBuilder::new(app, "File")
                    .item(&new_project_i)
                    .item(&open_project_i)
                    .build()?;
                menu = menu.item(&file_menu);

                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;
                menu = menu.item(&edit_menu);

                let window_menu = SubmenuBuilder::new(app, "Window")
                    .minimize()
                    .separator()
                    .close_window()
                    .build()?;
                menu = menu.item(&window_menu);

                // No Help submenu on macOS — About already lives in the app menu.
                #[cfg(not(target_os = "macos"))]
                {
                    let help_menu = SubmenuBuilder::new(app, "Help")
                        .item(&about_i)
                        .separator()
                        .build()?;
                    menu = menu.item(&help_menu);
                }

                let menu = menu.build()?;
                app.set_menu(menu)?;

                let about_id = about_i.id().clone();
                let new_project_id = new_project_i.id().clone();
                let open_project_id = open_project_i.id().clone();
                app.on_menu_event(move |app, event| {
                    let Some(w) = app.get_webview_window("main") else {
                        return;
                    };
                    if about_id == event.id() {
                        let _ = w.emit("menu:about", ());
                    } else if new_project_id == event.id() {
                        let _ = w.emit("menu:new-project", ());
                    } else if open_project_id == event.id() {
                        let _ = w.emit("menu:open-project", ());
                    }
                });
            }
            if cfg!(debug_assertions) {
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
