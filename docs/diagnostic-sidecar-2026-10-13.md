# Felsökning av app och sidecar, 2026-10-13

## Resultat

Två installationsproblem är reproducerade: RVC:s beroenden fungerar inte med den installerade Python 3.12-miljön, och den gemensamma sidecar-miljön använder CPU-versioner av torch/torchaudio trots ett Nvidia RTX 4070 SUPER. Ett tredje fel hittades vid kontroll av utvecklingsstart/stopp: Windows venv-underprocess kändes inte igen som arbetsmappens egen sidecar. Ett fjärde fel gjorde att ett avvisat API-anrop visades som nätverksfel i appens webbfönster.

Koden har korrigerats för kontroll av motorimport före aktivering, CUDA-reparation vid installation, identifiering av den egna Windows-underprocessen och läsbara avvisade API-svar. **RVC:s underliggande kompatibilitet är fortfarande olöst.** Ändringarna ligger i arbetsmappen; den installerade versionen 0.50.69 har inte ersatts och dess gemensamma Python-paket har inte ändrats.

Jag kan inte intyga att varje funktion fungerar i varje läge. Nedan redovisas vad som verkligen körts, vad som testats med simulerade tjänstesvar och vad som saknar förutsättningar för ett riktigt test.

## Miljö och metod

- Arbetsmapp: `F:\ai-music-tool`, GitHub-repo `Druttzen/ai-music-tool`, version 0.50.69. GitHub-åtkomst och repoidentitet kontrollerade; inga ändringar publicerade.
- Installerad app: `C:\Program Files\AI Music Creator Studio\ai-music-studio.exe`.
- Befintlig sidecar: `C:\Users\micke\AppData\Local\com.djmad.aimusiccreator.studio\sidecar`, Python 3.12.10. Aktiveringslistan innehåller acestep, classify, generate, stems-melband och vision.
- Den installerade appen öppnades med en separat testprofil under `build/diagnostics/desktop-profile`. Testexporter och Canvas-profilen ligger där. Befintliga projekt och inställningar har inte skrivits över.
- Modelltester använde den installerade miljön och dess befintliga modellcache. ACE-Step kördes i sin befintliga isolerade miljö. Testmaterialet var syntetiskt ljud/bild; lyckad körning innebär inte ett kvalitetsomdöme om riktiga musikproduktioner.
- RVC:s fallback undersöktes i en separat paketkatalog. CUDA-reparation provades med pip dry-run, inte genom att ersätta användarens torch-installation.
- Webbtesterna kördes med appens E2E-inställning. Vissa scenarier använder avsiktligt simulerade svar. De räknas som UI-/logiktester, inte bevis på fungerande externa AI-tjänster.

## Bekräftade fel och ändringar

### 1. RVC: installationsfel och falsk möjlighet till lyckad fallback

Normal installation med den installerade Python-versionen avbryts eftersom `rvc-python` kräver `faiss-cpu==1.7.3`, som inte kunde lösas för denna miljö. Logg: [rvc-install-dry-run.log](../build/diagnostics/rvc-install-dry-run.log).

Den befintliga fallbacken kringgår beroendeupplösningen med `--no-deps`. När motorns riktiga import körs med fallback-paketen avbryter fairseq 0.12.2:

> mutable default ... CommonConfig ... for field common is not allowed: use default_factory

Detta är ett reproducerat motorfel, inte en slutsats enbart från pip-metadata. Logg: [rvc-inference-import.log](../build/diagnostics/rvc-inference-import.log).

Tidigare verifierade den vanliga installationsvägen inte RVC:s inferensmotor innan aktivering. Nu måste `rvc_python.infer.RVCInference` kunna importeras. Felet visas och tillägget markeras inte som aktivt. Samma princip gäller de övriga gemensamma tilläggen och återaktivering av avstängda tillägg. Kontrollen hämtar inte modellvikter.

**Kvar:** ett kompatibelt RVC-runtime/engine och en konfigurerad röstmodell behövs fortfarande. RVC-inferens är inte godkänd. Den nya kontrollen har provats med de verkliga fallback-paketen och avvisar dem korrekt: [validation-installed.log](../build/diagnostics/validation-installed.log).

### 2. Gemensamma tillägg använder CPU på Nvidia-datorn

Installerad gemensam miljö: torch `2.14.1+cpu`, torchaudio `2.11.0+cpu`. ACE-Step:s separata miljö har CUDA och klarade riktig GPU-generering. Utvecklingsmiljön har också fungerande CUDA. Problemet är därför avgränsat till den gemensamma installerade miljön.

Desktop-installationen saknade den CUDA-reparation som fanns i utvecklingsskripten. Skripten använde dessutom `--extra-index-url`, där PyPI:s CPU-paket kunde konkurrera med CUDA-paketen.

Nu kontrollerar desktop-installationen CUDA i en ny Python-process efter paketinstallation, installerar från enbart det angivna CUDA-indexet om det behövs och kontrollerar resultatet igen innan aktivering. CPU-undantaget `AIMC_FORCE_CPU=1` respekteras. Utvecklingsskripten använder också enbart CUDA-indexet för torch/torchaudio.

Den installerade Python-versionen kunde lösa kommandot i dry-run och valde `torch 2.14.1+cu126` och `torchaudio 2.11.0+cu126`: [cuda-repair-dry-run.log](../build/diagnostics/cuda-repair-dry-run.log). Automatiska tester kontrollerar att misslyckad CUDA-verifiering inte rapporteras som framgång. **Själva paketbytet och GPU-inferens efter det bytet är inte körda i användarens gemensamma miljö.**

### 3. Utvecklingens start/stopp identifierar fel Python-process

Windows venv-launchern startade en underprocess med den globala Python-exekverbara filen. Stoppfunktionen avvisade därför den egna listener-processen, och port 8723 förblev upptagen. Startfunktionen kunde också behandla den som en okänd process.

Start och stopp delar nu en kontroll som kräver rätt uvicorn-app, exakt arbetsmapp och en verifierad föräldraprocess från arbetsmappens venv. Enbart en global Python-process accepteras inte. Kontrollen provades mot den verkliga körande underprocessen: rätt arbetsmapp godkändes, en annan arbetsmapp avvisades, upprepad start återanvände processen och stopp avslutade den.

Ytterligare start från ledig port, återanvändning och stopp provades på riktiga processer. Slutkontrollen visar att rätt arbetsmapp godkänns, en annan avvisas och porten blir ledig efter stopp: [sidecar-process-final.json](../build/diagnostics/sidecar-process-final.json).

### 4. Avvisat API-anrop blir ett generiskt nätverksfel

Efter riktig start från en tom separat profil svarade sidecar med owned=true, ready=true och korrekt ljudanalys via appens webbfönster. Samma webbfönsters anrop utan autentiseringsnyckel gav däremot `TypeError: Failed to fetch`. Ett separat HTTP-anrop visade att 401-svaret saknade CORS-headers: auth-middleware returnerade innan den inre CORS-kontrollen kördes. [native-sidecar-live.json](../build/diagnostics/native-sidecar-live.json).

Auth-felsvaret får nu samma begränsade origin-headers som andra sidecar-svar. Behörighetskontrollen finns kvar. Fem nya tester verifierar tillåtna origins, otillåten origin och saknad origin. Korrigerad kod kördes också med den nya profilens riktiga Python 3.12 och paket via TestClient: 401 med läsbart fel för tillåtna origins, inga tillåtande headers för okänd origin, och korrekt autentiserat anrop nådde valideringen för saknad ljudfil. [cors-auth-check.log](../build/diagnostics/cors-auth-check.log). Det sista är ett servertest, inte en ombyggd installerad app.

### Övriga observationer

- xformers var byggt för andra torch-/Python-versioner och varnade att C++/CUDA-tilläggen inte kunde laddas. MusicGen genererade ändå riktigt ljud på CPU. Varningen är därför en bekräftad begränsning, inte ett bevis på att MusicGen är trasigt.
- pip check rapporterade äldre audiocraft-krav och saknade paket. AudioCraft installeras avsiktligt med `--no-deps`; riktig MusicGen-inferens fungerade. Alla metadataavvikelser har inte reparerats.
- Automatisk tillgänglighetskontroll gav fem regeltyper: 122 kontrastträffar, 17 fält utan tillgängligt namn, tre select-fält utan namn, fyra scrollområden utan tangentbordsåtkomst och ett ej unikt landmark. Detta är granskningsresultat för det aktuella sidläget, inte 147 separat manuellt bekräftade funktionsfel. De är inte korrigerade i denna ändring. [a11y.json](../build/diagnostics/a11y.json).
- Ett fel i befintligt Demucs-webbtest korrigerades: testet valde inte Demucs-modellen och antog att paketet saknades. Nu väljs Demucs uttryckligen och det saknade paketets felsvar simuleras deterministiskt.

## Riktiga funktionstester

| Funktion | Faktiskt utfört | Resultat / belägg |
|---|---|---|
| MusicGen | Befintlig small-modell, tre sekunder, seed 42, CPU | WAV 32 kHz, mono, PCM24. [generate.log](../build/diagnostics/generate.log), [ljud](../build/diagnostics/musicgen-live.wav) |
| ACE-Step | Egen API-process och befintliga modeller, tio sekunder instrumental på GPU | Ljudfil skapad; testets API-process stängd efteråt. [acestep-live.log](../build/diagnostics/acestep-live.log), [ljud](../build/diagnostics/acestep-live.wav) |
| Genreklassificering | Modell laddad, tre sekunder syntetiskt ljud analyserat | Tre klassificeringsresultat. [genre.log](../build/diagnostics/genre.log) |
| Bildtext, BLIP | Riktig pipeline på syntetisk bild | Bildtext returnerad. [caption.log](../build/diagnostics/caption.log) |
| Bildbedömning, CLIP | Riktig modell jämförde två bildbeskrivningar | Poäng returnerade. [clip.log](../build/diagnostics/clip.log) |
| Demucs | htdemucs separerade två sekunder syntetiskt ljud | Fyra ljudstammar skapade. [demucs.log](../build/diagnostics/demucs.log) |
| MelBand clean | Riktig modell separerade en sekund syntetiskt ljud | Två stammar, återkombinationens största avvikelse cirka 3,73 × 10⁻⁹. [melband-live.log](../build/diagnostics/melband-live.log) |
| Motorverifiering | Ny kontroll körd med installerad Python och installerade paket | generate, classify, vision, stems, stems-melband, vocal, vocal-ml importeras. Covers avvisas eftersom diffusers saknas; RVC-fallback avvisas med verkligt fairseq-fel. [validation-installed.log](../build/diagnostics/validation-installed.log) |
| Native ljudmätning | Installerade appens kommandon på tre sekunder stereo 48 kHz | LUFS, true peak, stereofas och WAV-dekodning returnerade; tomt ljud avvisades. [native-results.json](../build/diagnostics/native-results.json) |
| Native sidecar-start och analys | Tom separat testprofil fick grundpaket installerade; appen startade och autentiserade sin egen sidecar; syntetiskt ljud skickades från webbfönstret | ready=true, spawned=true, owned=true, health HTTP 200 och analyze HTTP 200. [native-sidecar-live.json](../build/diagnostics/native-sidecar-live.json) |
| Native mastering/export | Två sekunders urval exporterades i WAV16, WAV24, WAV32 float, FLAC24, MP3 och M4A | Alla filer öppnades och avkodades, stereo 48 kHz och ändliga sampel. Lossless-format exakt två sekunder; MP3/AAC har codec-padding. [canvas-exports.log](../build/diagnostics/canvas-exports.log) |
| Canvas | Riktig renderer, H.264 720 × 1280, 90 bildrutor; öppnad i appens Canvas-panel | Tre sekunders video laddades och spelades. [bild](../build/diagnostics/canvas-desktop.png), [video](../build/diagnostics/desktop-profile/exports/canvas-diagnostic-canvas.mp4) |
| Uppdateringskontroll | Installerade appens läsande kontroll | ok=true, available=false, currentVersion=0.50.69, error=null. Ingen uppdatering installerades. [desktop-update-check.json](../build/diagnostics/desktop-update-check.json) |
| Preset/text/historik | Manuellt webbflöde för preset, textutkast och snapshot | UI kontrollerat, inga konsolfel registrerade i den sessionen. [bild](../build/diagnostics/prompt-lyrics-history.png) |

## Automatiska kontroller

| Kontroll | Resultat | Logg |
|---|---|---|
| JavaScript-enhetstester | 731 godkända, 137 testfiler | [unit-final.log](../build/diagnostics/unit-final.log) |
| Python, CI-filter `not slow` | 265 godkända, sju överhoppade, ett bortvalt, en librosa-varning för syntetiskt testljud | [python-final.log](../build/diagnostics/python-final.log) |
| Rust, desktop | 49 godkända | [rust-final.log](../build/diagnostics/rust-final.log) |
| Rust, DSP | 30 godkända | [dsp-final.log](../build/diagnostics/dsp-final.log) |
| Playwright, hela sviten | 68 godkända, sex överhoppade, totalt 74 scenarier | [e2e-final.log](../build/diagnostics/e2e-final.log) |
| ESLint | Godkänd | [lint-final.log](../build/diagnostics/lint-final.log) |
| Produktionsbygge och lazy-paneler | Godkända, statiska sidor `/`, `/canvas`, `/_not-found` | [build-final.log](../build/diagnostics/build-final.log) |
| TypeScript, Rust-låsfiler, sidecar-kontrakt | Godkända; 53 sidecar-scheman | [types-final.log](../build/diagnostics/types-final.log), [rust-locks-final.log](../build/diagnostics/rust-locks-final.log), [contracts-final.log](../build/diagnostics/contracts-final.log) |
| Ändrade PowerShell-/Bash-skript | Syntaxkontroll godkänd; Windows start/stopp provat på riktiga processer | [sidecar-process-final.json](../build/diagnostics/sidecar-process-final.json) |

Webbsviten täcker bland annat guidat Suno-flöde, presets, prompt-/textkopiering, variationer, Co-Producer, Maestro offline och simulerade LLM-handoffs, bild-/ljudanalyshandoff, genre-/stilreferenser, karaktärsröster, vocal-planering och mixpreview, import/export av projekt/bundle, snapshots/autosave/reset, återimport, notifieringar och MusicGen-/ACE-jobbavbrott. Ett godkänt simulerat tjänstesvar betyder att gränssnittets flöde fungerar för svaret; det bevisar inte att den externa tjänsten fungerar.

## Inte fullt verifierat

- De sex överhoppade webbscenarierna gäller tre MusicGen live-/melody-flöden, två OpenVPI-status/inferensflöden och RVC-ready. MusicGen:s vanliga generering verifierades separat med den installerade miljön; melody/highlight-region är fortfarande inte verifierad med riktig inferens här.
- Python-sviten använder CI-filtret och innehåller villkorade testhopp. Riktig Demucs/MelBand-inferens kördes separat enligt tabellen; alla alternativa modeller och ljudformat har inte provats.
- Cover/cover-ref: diffusers finns inte i den installerade gemensamma miljön. Ingen Flux-inferens körd; tilläggen kan inte beskrivas som fungerande.
- RVC-röstkonvertering, OpenVPI/DiffSinger, verklig MFA-alignering och Composer kräver fungerande/konfigurerade motorer eller checkpoints som saknades. Heuristisk alignering och vocal-mixpreview i webbtesterna ersätter inte dessa tester.
- Externa LLM-leverantörer, Spotify, AudD och kontobundna YouTube-flöden har inte testats med verkliga autentiserade konton. Simulerade svar och offline-logik är testade där sviten har sådana scenarier.
- Appuppdateringens installation, avinstallation, administratörsinstallation, full ominstallation av alla stora modeller samt macOS/Linux kördes inte. Läsande uppdateringskontroll och tillhörande automatiska tester är genomförda.
- Den nya CUDA-reparationens riktiga paketbyte i den installerade gemensamma miljön återstår. Riktig GPU-generering är verifierad för ACE-Step:s separata miljö.

## Leverans och nästa konkreta arbete

Källändringarna behöver byggas och levereras som en uppdaterad app för att påverka den installerade versionen. RVC kräver separat kompatibilitetsarbete med efterföljande verklig röstinferens. Därefter bör CUDA-paketbytet köras i den gemensamma miljön och MusicGen/stems verifieras på GPU. Covers, röstmodeller och autentiserade externa tjänster behöver sina saknade förutsättningar innan de kan godkännas.

Detaljloggar och testmedia ligger lokalt i den ignorerade katalogen `build/diagnostics`; själva rapporten och källändringarna ligger i arbetsmappen.
