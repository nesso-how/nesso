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
                app.on_menu_event(move |app, event| {
                    if about_id == event.id() {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.emit("menu:about", ());
                        }
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
