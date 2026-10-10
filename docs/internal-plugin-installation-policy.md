# Internal plugins and one Windows installation (0.50.66)

## Policy

- Plugins install into Studio’s managed data root. Normal sidecar extras use the internal Python runtime; ACE-Step has an isolated runtime under `data/addons/acestep`.
- Canvas uses the internal Python renderer and a Studio WebView panel. It never installs or starts AI Canvas Tool as another application. Current internal Canvas support renders artwork to a 720 × 1280 H.264 MP4 loop, 3–8 seconds. The external Canvas application's AI-video editing features are not imported.
- External ACE-Step checkout discovery and service URLs are ignored. The internal ACE-Step process uses a private loopback port and session authentication, and closes with Studio.
- Optional external vocal APIs and arbitrary DiffSinger command launchers are disabled in the Studio host. RVC inference uses the installed internal Python package. DiffSinger and MFA executables must belong to the managed addons/tools directories; model/audio files remain user data.

## Windows installer

Windows releases publish NSIS only. A machine registration and scans of existing NSIS/MSI registration in the 32-bit and 64-bit registry views block a second installation, including silent, same-version, downgrade and updater attempts. Exit code: **1638**. The existing version must be explicitly uninstalled first. A global installer mutex also blocks concurrent installers.

The release executable verifies its installation directory against the registration. Copying the executable to another directory does not create an accepted installation. Developer/debug builds are exempt.

App updates inside Studio check availability; they cannot overwrite the existing installation. Internal plugins may be updated inside Studio.

The machine installer requires normal Windows administrator confirmation. This policy cannot retroactively modify old installers/executables already downloaded before 0.50.66. Other platform packages do not yet enforce the Windows machine registration policy.

## Uninstall and retained data

Studio’s registered files and its installation ownership record are removed by the uninstaller. Cached plugin dependencies/checkpoints, projects, profiles and exports are preserved for reuse; they are not another registered application installation. Canvas and ACE-Step activation markers in the installation’s colocated data folder are deactivated. Externally selected `STUDIO_DATA_DIR` test profiles are preserved.

## ACE-Step provisioning

The source archive is pinned to official ACE-Step commit `ca1e85fe9430179831e6bc6be790c332190a3866`, SHA-256 `108e45dffc7eb62af98d781c4159aa63a2b7a241186734e3e065279da7fc198d`. Initial provisioning downloads dependencies/models inside Studio's data folder. Once cached, inference uses the local model files. An interrupted install does not write the plugin activation manifest.
