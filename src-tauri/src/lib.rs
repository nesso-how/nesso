// SPDX-License-Identifier: MIT
use tauri_plugin_fs::FsExt;

#[tauri::command]
fn grant_fs_scope(app: tauri::AppHandle, path: String) {
    let _ = app.fs_scope().allow_directory(&path, true);
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
