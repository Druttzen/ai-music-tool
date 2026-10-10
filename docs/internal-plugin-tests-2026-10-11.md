# Internal plugin verification — Studio 0.50.66

## Passed

- JavaScript: 690 tests in 134 files; lint and production web export passed.
- Python: 243 passed, one skipped, one deselected. Includes app-owned activation, ignored external ACE-Step URLs, pinned source checksums, blocked external network connections and an actual Canvas MP4 render.
- Rust: 47 unit tests passed; lockfile checks passed.
- Packaged sidecar and Windows NSIS installer built locally. The local installer uses zlib compression to shorten iteration; the release workflow uses the normal bundle settings.
- Running the actual 0.50.66 installer while 0.50.65 was registered returned **1638**. The requested second installation directory was not created.
- The existing test installation was explicitly uninstalled: exit 0, application executable and registration removed, data and exports preserved.
- The internal ACE-Step runtime generated an actual **30.0-second, 48 kHz stereo WAV** with the offline network guard active. All samples were finite; peak amplitude was 0.891251. Local model readiness, private loopback address and owned process were verified. Its child process stopped after the test; the pre-existing external ACE-Step process was left running.

## Installed app test and remaining Windows interaction

- After renewed administrator confirmation, 0.50.66 installed successfully (exit 0); HKLM ownership pointed to its installation folder.
- The actual installed executable launched as 0.50.66 and its managed sidecar became ready. Canvas activation through the app succeeded, creating its internal manifest with no external installer/uninstaller.
- Opening the Canvas panel exposed a Windows synchronous-command deadlock and an incorrect exported route. Fixed by making the launch command asynchronous, using `canvas/index.html` and sharing assets from the app origin. Regression checks, all local gates and the corrected NSIS build passed.
- The additional duplicate-install test is waiting for Windows administrator confirmation. Full Canvas UI/render, installed ACE-Step generation and graceful restart tests on the corrected package are **still pending**. The successful ACE-Step generation above is a real managed-runtime integration test, not an installed-app UI test.

Test data is preserved under `B:\AI Music Creator Studio Phase Test Final\data`. Runtime evidence and the generated WAV are under `B:\AI Music Creator Studio Phase Test Final\verification\internal-plugins-0.50.66`.

## Scope

The enforced single installation policy applies to new Windows releases. Old downloaded installers/executables cannot be retroactively changed. Canvas currently provides internal artwork loops; it does not import all features from the former standalone Canvas application.
