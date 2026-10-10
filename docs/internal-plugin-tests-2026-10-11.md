# Internal plugin verification — Studio 0.50.66

## Passed

- JavaScript: 690 tests in 134 files; lint and production web export passed.
- Python: 244 passed, one skipped, one deselected. Includes app-owned activation, ignored external ACE-Step URLs, pinned source checksums, blocked external network connections, preserved engine errors and an actual Canvas MP4 render.
- Rust: 47 unit tests passed; lockfile checks passed.
- Packaged sidecar and Windows NSIS installer built locally. The local installer uses zlib compression to shorten iteration; the release workflow uses the normal bundle settings.
- Running the actual 0.50.66 installer while 0.50.65 was registered returned **1638**. The requested second installation directory was not created.
- The existing test installation was explicitly uninstalled: exit 0, application executable and registration removed, data and exports preserved.
- The internal ACE-Step runtime generated an actual **30.0-second, 48 kHz stereo WAV** with the offline network guard active. All samples were finite; peak amplitude was 0.891251. Local model readiness, private loopback address and owned process were verified. Its child process stopped after the test; the pre-existing external ACE-Step process was left running.

## Installed app tests — passed

- After renewed administrator confirmation, 0.50.66 installed successfully (exit 0); HKLM ownership pointed to its installation folder.
- The actual installed executable launched as 0.50.66 and its managed sidecar became ready. Canvas activation through the app succeeded, creating its internal manifest with no external installer/uninstaller.
- Opening the Canvas panel exposed a Windows synchronous-command deadlock and an incorrect exported route. Fixed by making the launch command asynchronous, using `canvas/index.html` and sharing assets from the app origin. Regression checks, all local gates and the corrected NSIS build passed.
- The final corrected package was explicitly uninstalled/reinstalled using one normally elevated helper. Both operations returned 0. A second installation of the registered 0.50.66 package returned **1638**, with no second installation folder.
- Actual Canvas UI artwork upload produced an **8-second, 720 × 1280 MP4**, displayed in the app-owned panel with decoded video readiness 4. This passed again after installing the final package.
- The installed app's full-song UI generated a **30-second, 48 kHz stereo WAV** through its internal ACE-Step process. A first run exposed legacy Windows output encoding failure; UTF-8/unbuffered logging corrected it. Job `0ba2ded454ea4f3f` finished with no error and a ready audio result. The generated file contained finite samples. This integration used the corrected internal plugin source, subsequently packaged in the final installer.
- Native ACE-Step deactivation removed its activation manifest while retaining checkpoint weights. Reactivation through the final installed app returned `ok: true`, `mode: installed`, using the owned internal source/runtime; no standalone installer or service was used.
- The final installed app started its own ACE-Step process on private loopback port 49556. With Canvas and ACE-Step open, clicking **Exit Studio** closed the app, both WebViews, the main sidecar and the owned ACE-Step child. External process 34108 remained running.
- A final restart launched 0.50.66 with its managed sidecar ready, no startup error, Canvas still activated, and one main WebView target. A Windows close callback deadlock found during earlier testing was corrected by deferring plugin window closure outside the callback.

Test data is preserved under `B:\AI Music Creator Studio Phase Test Final\data`. Runtime evidence and the generated WAV are under `B:\AI Music Creator Studio Phase Test Final\verification\internal-plugins-0.50.66`.

## Scope

The enforced single installation policy applies to new Windows releases. Old downloaded installers/executables cannot be retroactively changed. Canvas currently provides internal artwork loops; it does not import all features from the former standalone Canvas application.
