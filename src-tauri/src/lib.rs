use std::path::PathBuf;
use std::process::Command;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use tauri::AppHandle;
use tauri::Emitter;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

#[tauri::command]
fn set_dock_icon(app: AppHandle, path: String) -> Result<(), String> {
    let _ = std::io::Write::write_fmt(
        &mut std::io::stderr(),
        format_args!("Requested Dock Icon change to: {}\n", path),
    );

    #[cfg(target_os = "macos")]
    {
        let _: Result<(), tauri::Error> = app.run_on_main_thread(move || {
            use cocoa::base::{id, nil};
            use cocoa::foundation::NSString;
            use objc::{class, msg_send, sel, sel_impl};

            unsafe {
                let ns_path = NSString::alloc(nil).init_str(&path);
                let img_class = class!(NSImage);
                let img: id = msg_send![img_class, alloc];
                let img: id = msg_send![img, initWithContentsOfFile: ns_path];

                if img != nil {
                    let app_class = class!(NSApplication);
                    let ns_app: id = msg_send![app_class, sharedApplication];
                    let _: () = msg_send![ns_app, setApplicationIconImage: img];
                } else {
                    let _ = std::io::Write::write_fmt(
                        &mut std::io::stderr(),
                        format_args!("Error: Could not load image from path: {}\n", path),
                    );
                }
            }
        });
    }

    #[cfg(not(target_os = "macos"))]
    {
        if let Ok(img) = image::open(&path) {
            let rgba = img.into_rgba8();
            let (width, height) = (rgba.width(), rgba.height());
            let icon = tauri::image::Image::new_owned(rgba.into_raw(), width, height);
            let _ = app.set_icon(icon);
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();
            
            // App menu
            #[cfg(target_os = "macos")]
            let app_submenu = Submenu::with_items(
                handle,
                "App",
                true,
                &[
                    &PredefinedMenuItem::about(handle, None, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::services(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::hide(handle, None)?,
                    &PredefinedMenuItem::hide_others(handle, None)?,
                    &PredefinedMenuItem::show_all(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::quit(handle, None)?,
                ],
            )?;

            let new_project_item = MenuItem::with_id(handle, "new-project", "New Project/Directory", true, Some("CmdOrCtrl+N"))?;
            
            let file_submenu = Submenu::with_items(
                handle,
                "File",
                true,
                &[
                    &new_project_item,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::close_window(handle, None)?,
                ],
            )?;

            let undo_item = MenuItem::with_id(handle, "undo", "Undo", true, Some("CmdOrCtrl+Z"))?;
            let redo_item = MenuItem::with_id(handle, "redo", "Redo", true, Some("CmdOrCtrl+Shift+Z"))?;
            
            let edit_submenu = Submenu::with_items(
                handle,
                "Edit",
                true,
                &[
                    &undo_item,
                    &redo_item,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::cut(handle, None)?,
                    &PredefinedMenuItem::copy(handle, None)?,
                    &PredefinedMenuItem::paste(handle, None)?,
                    &PredefinedMenuItem::select_all(handle, None)?,
                ],
            )?;

            let view_submenu = Submenu::with_items(
                handle,
                "View",
                true,
                &[
                    &PredefinedMenuItem::fullscreen(handle, None)?,
                ]
            )?;

            let window_submenu = Submenu::with_items(
                handle,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::close_window(handle, None)?,
                ]
            )?;

            #[cfg(target_os = "macos")]
            let menu = Menu::with_items(
                handle,
                &[&app_submenu, &file_submenu, &edit_submenu, &view_submenu, &window_submenu],
            )?;

            #[cfg(not(target_os = "macos"))]
            let menu = Menu::with_items(
                handle,
                &[&file_submenu, &edit_submenu, &view_submenu, &window_submenu],
            )?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app, event| {
                if event.id() == new_project_item.id() {
                    let _ = app.emit("menu-action", "new-project");
                } else if event.id() == undo_item.id() {
                    let _ = app.emit("menu-action", "undo");
                } else if event.id() == redo_item.id() {
                    let _ = app.emit("menu-action", "redo");
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, set_dock_icon])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
