import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = path => readFileSync(path, "utf8");
describe("internal plugin and installation policy", () => {
  it("publishes one Windows installer with an early duplicate guard", () => {
    const config = JSON.parse(read("src-tauri/tauri.windows.conf.json"));
    expect(config.bundle.targets).toEqual(["nsis"]);
    expect(config.bundle.windows.nsis.installMode).toBe("perMachine");
    const source = read("src-tauri/installer/studio.nsi");
    const init = source.slice(source.indexOf("Function .onInit"), source.indexOf("Section EarlyChecks"));
    expect(init).toContain("Call StudioCheckExistingInstall");
    expect(source).toContain("SetErrorLevel 1638");
    expect(source).toContain("StudioCheckRegistry HKLM 64");
    expect(source).toContain("StudioCheckRegistry HKCU 32");
  });
  it("Canvas has no standalone installer or process launch", () => {
    const source = read("src-tauri/src/canvas_handoff.rs");
    expect(source).not.toContain("Command::new");
    expect(source).not.toContain("Setup.exe");
    expect(source).toContain("ai_sidecar.canvas_plugin");
    expect(source).toContain("WebviewWindowBuilder");
    expect(source).toContain('WebviewUrl::App("canvas/index.html"');
    expect(source).toContain("pub async fn launch_canvas_addon");
    expect(read("next.config.js")).toContain('assetPrefix: "/"');
  });
  it("the updater verifies the download and protects the registered installation", () => {
    const source = read("src-tauri/src/studio_updater.rs");
    expect(source).toMatch(/update\s*\.download\(/);
    expect(source).toContain("update.install(bytes)");
    expect(source.search(/update\s*\.download\(/)).toBeLessThan(source.indexOf("update.install(bytes)"));
    expect(source).toContain("installation_policy::enforce()");
    expect(source).toContain("UpdateGuard::acquire()");
    const installer = read("src-tauri/installer/studio.nsi");
    const init = installer.slice(installer.indexOf("Function .onInit"), installer.indexOf("Section EarlyChecks"));
    expect(init.indexOf('"/UPDATE"')).toBeLessThan(init.indexOf("Call StudioCheckExistingInstall"));
    expect(installer).toContain('GetFullPathName $StudioUpdatePath "$2"');
    expect(installer).toContain('$StudioUpdateRegistrationCount != 1');
    expect(installer).toContain('${VersionCompare} "${VERSION}" "$3" $4');
    expect(installer).toContain('$3 != "$StudioUpdatePath"');
    expect(installer).toContain('$4 != 1');
  });
  it("checks for cancellable running-app exit before disabling plugins", () => {
    const source = read("src-tauri/installer/studio.nsi").split("Section Uninstall")[1];
    expect(source.indexOf("!insertmacro CheckIfAppIsRunning")).toBeLessThan(source.indexOf('Delete "$INSTDIR\\data\\addons\\canvas\\plugin.json"'));
  });
  it("arms workspace reset only on completed app exit", () => {
    const source = read("src-tauri/src/lib.rs");
    expect(source.match(/workspace_reset::arm_reset_on_launch\(\)/g)).toHaveLength(1);
    expect(source.slice(source.indexOf(".run(|app_handle, event|"))).toContain("workspace_reset::arm_reset_on_launch()");
    expect(source).toContain("if !studio_updater::is_update_restart()");
  });
});
