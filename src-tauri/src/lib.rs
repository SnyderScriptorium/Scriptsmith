//! Android crash diagnostics: a Rust panic hook + startup stage markers.
//!
//! A Rust panic (e.g. the `.expect("error while running ScriptSmith")`) aborts the
//! process with SIGABRT — no Java exception is ever thrown, so the Kotlin
//! UncaughtExceptionHandler never fires and the user just sees "keeps stopping".
//! These hooks write the panic payload and startup progress to the app's files
//! dir, where CrashReportActivity picks them up and shows them on screen.
//!
//! Every file operation is best-effort and can never itself panic.
//!
//! v1009: REVERTED the v1006 background-thread change. Tauri Android needs the
//! calling (main) thread for JNI — spawning builder.run() elsewhere broke
//! initialization. builder.run() is called directly on the calling thread again.
//! Startup markers are ALSO mirrored to the app-specific external files dir
//! (Internal storage > Android > data > com.snyderscriptorium.scriptsmith > files)
//! so the user can read them with a file manager even if the app's UI never appears.

const FILES_DIR: &str = "/data/data/com.snyderscriptorium.scriptsmith/files";
/// Externally visible mirror of the startup markers, readable via a file manager.
/// App-specific external files dir: no permission needed on Android 11+, visible
/// under Internal storage > Android > data > com.snyderscriptorium.scriptsmith > files.
const EXT_DIAG: &str =
    "/storage/emulated/0/Android/data/com.snyderscriptorium.scriptsmith/files/ScriptSmith-diag.txt";

fn append_log(name: &str, line: &str) {
    let _ = (|| -> std::io::Result<()> {
        use std::io::Write as _;
        let dir = std::path::Path::new(FILES_DIR);
        std::fs::create_dir_all(dir)?;
        let mut f = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(dir.join(name))?;
        writeln!(f, "{}", line)?;
        f.flush()?;
        Ok(())
    })();
}

fn truncate_log(name: &str) {
    let _ = (|| -> std::io::Result<()> {
        let dir = std::path::Path::new(FILES_DIR);
        std::fs::create_dir_all(dir)?;
        std::fs::write(dir.join(name), "")?;
        Ok(())
    })();
    // Mirror: fresh external diag file per launch too. App-specific external
    // files dir may not exist yet (fresh install) — create the parent first.
    let _ = (|| -> std::io::Result<()> {
        let p = std::path::Path::new(EXT_DIAG);
        if let Some(parent) = p.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(p, "")?;
        Ok(())
    })();
}

/// Write a startup marker to the internal log AND mirror it to the externally
/// visible diag file. Best-effort; never panics.
fn marker(line: &str) {
    append_log("rust-startup.log", line);
    let _ = (|| -> std::io::Result<()> {
        use std::io::Write as _;
        let p = std::path::Path::new(EXT_DIAG);
        if let Some(parent) = p.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut f = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(p)?;
        writeln!(f, "{}", line)?;
        f.flush()?;
        Ok(())
    })();
}

fn install_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        let payload = info.payload();
        let msg: &str = if let Some(s) = payload.downcast_ref::<&str>() {
            s
        } else if let Some(s) = payload.downcast_ref::<String>() {
            s.as_str()
        } else {
            "<non-string panic payload>"
        };
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "<unknown location>".to_string());
        append_log(
            "rust-panic.log",
            &format!("--- panic ---\npayload: {}\nlocation: {}", msg, location),
        );
    }));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    install_panic_hook();
    // Fresh logs per launch so a stale panic from a previous run can't mislead.
    truncate_log("rust-startup.log");
    truncate_log("rust-panic.log");
    marker("entry");

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init());
    marker("builder-built");

    marker("run-called");
    // v1009/v1010: call directly on the calling thread (v1006 background-thread
    // spawn REVERTED — Tauri Android needs this thread for JNI).
    // v1010: external diag mirror moved to the app-specific external files dir
    // (scoped-storage safe, no permission needed).
    builder
        .run(tauri::generate_context!())
        .expect("error while running ScriptSmith");
    // Should not normally be reached; if it is, record it.
    marker("run-returned");
}
