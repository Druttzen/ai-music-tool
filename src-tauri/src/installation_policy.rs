//! A copied release executable must belong to the one registered installation.
#[cfg(all(windows, not(debug_assertions)))]
pub(crate) fn enforce() -> Result<(), String> {
    use winreg::{RegKey, enums::{HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_64KEY}};
    let registered: Option<String> = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey_with_flags(r"Software\com.djmad.aimusiccreator.studio", KEY_READ | KEY_WOW64_64KEY)
        .ok().and_then(|key| key.get_value("InstallPath").ok());
    let actual = std::env::current_exe().map_err(|e| e.to_string())?;
    let valid = registered.and_then(|path| std::path::Path::new(&path).canonicalize().ok())
        .zip(actual.parent().and_then(|path| path.canonicalize().ok()))
        .is_some_and(|(registered, actual)| registered == actual);
    if valid { Ok(()) } else { Err("This copy does not belong to the registered Studio installation. Uninstall the existing Studio installation, then use the Studio installer.".into()) }
}
#[cfg(any(not(windows), debug_assertions))]
pub(crate) fn enforce() -> Result<(), String> { Ok(()) }
