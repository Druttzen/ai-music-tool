# Rättningar av 15 granskningsfynd — Studio 0.50.64

Rättningar av [granskningen 2026-10-10](analyzer-plugin-code-review-2026-10-10.md). Alla 15 konkreta fynd har åtgärdats. Rapportens större framtida uppgraderingar (P3) ingår inte i dessa 15 fynd.

## Ändringar och regressionstest

| Fynd | Rättning | Kontroll |
|---|---|---|
| 1 | Tillägg avaktiveras separat; delade bibliotek och modeller bevaras. Basimporter verifieras och aktivering skrivs atomiskt. | Rust: avaktivering/återaktivering och syskontillägg. Python: avaktiverade funktioner spärras. |
| 2 | CORS exponerar de HTTP-huvuden som klienten läser, inklusive remix och acapella-adress. | Tre tillåtna ursprung; klientens hantering av båda filerna. |
| 3 | FLUX-inferens körs i bakgrundstråd och delar resurslåset. | Lång modelloperation samtidigt som händelseloopen fortsätter svara. |
| 4 | Källgeneration kontrolleras efter väntande operationer. Rensning, reset, källbyte och projektbyte ogiltigförklarar tidigare resultat. Analys visar busy-status. | Hooktester för ljud/bild, generering och reset medan operationer pågår. |
| 5 | Stems kopplas till källidentitet, ursprungligt namn, modell och jobb. Resultat från äldre källa döljs och kan inte exporteras som en ny låt. | Fördröjt resultat, källbyte och exportnamn. |
| 6 | Export använder temporär fil och atomisk publicering utan överskrivning; kollision ger ett ledigt räknarnamn. | Rust: två exporter med samma namn bevarar båda filerna. |
| 7 | Vocal-transform och lokal cover/remix sparar ljudet i samma beständiga cache som övrig generering. Lagringsfel visas. | Cache skrivs före rapport/publicering; misslyckad cache behåller exportmöjligheten. |
| 8 | Jobbkön begränsar aktiva jobb och binära indata. Terminala jobb frigör indata; TTL räknas från avslut och rensar inte aktiva jobb. | Kögräns, payload-frigöring, avbrytning och TTL. |
| 9 | Bibliotek, modellfiler, konfiguration och faktisk offlineberedskap redovisas separat. Install/Repair förbereder modellfiler; ej förberedda modellval spärras. | Saknade checkpoints, endast clean-modellen, RVC/DiffSinger-konfiguration och snabb readiness utan Torch-import. |
| 10 | Obelagda taktarts-, tonarts- och sånggissningar tas bort. Okända värden förblir okända. | Långsam fyrtakt blir inte vals; ljushet ger inte tonart eller sångdetektion. |
| 11 | Export inväntas innan klart-status. Omedelbara dubbelklick spärras och skrivfel fångas. | Väntande nedladdning, fel och dubbelklick. |
| 12 | MusicGens obligatoriska installation och riktiga import måste lyckas före registrering/aktivering. | Fel propageras genom native-installern; fungerande import krävs. |
| 13 | Lokala modeller delar resurslås, frigör cache efter inferens och kontrollerar ledigt GPU-minne. Små analyser använder CPU. Externa motorer behåller sina processer. | Samtidighet, modellfrisläppning och nekad GPU-admission. |
| 14 | Canvas-cachefilens faktiska SHA-256 kontrolleras vid återanvändning. Installerinvokationer serialiseras. | Manipulerad cache underkänns; installerflöde och Windows-sökvägar. |
| 15 | DiffSinger stöder JSON-argumentlista; äldre Windows-kommandon parsas med Windows regler för citering. Ingen shell-körning. | Citerade sökvägar med blanksteg och JSON-argument. |

## Automatiska tester

- JavaScript: **678 godkända tester** i 131 filer; ytterligare fokuserad omkörning: **21 godkända**.
- Python: **231 godkända, 1 överhoppat, 1 bortvalt**.
- Rust: **53 godkända**.
- End-to-end: **20 godkända**.
- Lint utan varningar, produktionsbygge, 53 API-kontrakt och låsfiler kontrollerade.

## Installerad app

NSIS-installation och appstart genomfördes i `B:\AI Music Creator Studio Offline Drafts`, med testprofilen `B:\AI Music Creator Studio Phase Test Final\data`. Native-app och sidecar rapporterade **0.50.64**. WebView styrdes via sin egen felsökningsanslutning, med verkliga modelloperationer och native-export; inga modellsvar simulerades i dessa prov. Hugging Face och Transformers kördes med offline-inställning.

- MusicGen genererade en **5 sekunders stereodraft** med `facebook/musicgen-stereo-small`, på CUDA, och laddade den i spelaren/cachen.
- Clean-modellen separerade **Clean vocal demo 30s.wav**. Export av vocals och instrumental gav modell- och jobbidentifierade filnamn och två **11 520 088 byte** långa WAV-filer.
- Under separation svarade samtliga **12 health-anrop HTTP 200**, med högsta uppmätta latens **65,3 ms**.
- Native-export med samma namn två gånger gav separata filer, med ursprungligt innehåll `ABC` respektive `DEF`; första filen bevarades.
- Vocal-transform med båda utdata gav en remix på **5 760 044 byte** och separat acapella på **2 880 044 byte**. Remixens cachepost och ljud återställdes efter sidans omladdning. Detta utövar verklig WebView-CORS.
- Lokal remix skapades genom gränssnittets **Generate + download**, exporterades och återställdes efter omladdning: cache, rapport och export hade **5 760 044 byte**, och spelaren rapporterade **30 sekunder**.
- Verklig uppspelning startade: spelaren var inte pausad och tidsmarkören avancerade till **0,915 sekunder** före paus.
- Genre avaktiverades genom Plugins. Grundanalysen fortsatte fungera (`sidecar+sonic`), samtidigt som MusicGen och stems förblev tillgängliga. Återaktivering verifierade befintliga bibliotek/modeller och behövde ingen ny hämtning.
- Vision och RVC visade **Setup needed** för saknade modellfiler. Ocachead MusicGen Medium mono var spärrad i modellväljaren.
- Analys av **Theme of Simon.B.mp3** startades och rensades medan den arbetade. Efter väntan fanns ingen rapport, inget ljud i spelaren och ingen sparad ljudanalys; den äldre analysen kom inte tillbaka.
- Efter MusicGen-inferens sjönk totalt upptaget GPU-minne från cirka **8 030 till 6 332 MiB**. Efter efterföljande separation/remix låg det kring **6 360–6 453 MiB**. Dessa totalvärden inkluderar andra processer på datorn och är inte ett isolerat mått på sidecarens allokering.

App-testet upptäckte även saknad koppling av lokal cover/remix till workspace. Action och busy-state anslöts, fick ett nytt regressionstest och testades efter ominstallation.

Evidens, byggloggar, skärmbilder och testljud behålls i `B:\AI Music Creator Studio Phase Test Final\verification\analyzer-fixes-0.50.64` och profilens exportmapp, utanför Git. Slutlig end-to-end-omkörning: **20 godkända på 55,3 sekunder**.

## Praktiska gränser

Readiness betyder att erforderliga lokala filer och konfiguration har hittats; den garanterar inte kvalitet hos en godtycklig extern checkpoint. Testprofilen saknar FLUX-/vision-vikter, RVC-röstmodell och DiffSinger-modell. Deras felvägar, konfiguration och trådhantering täcks av regressionstest; någon full musikalisk/bildmässig inferens med dessa modeller påstås inte här. Separation ger ingen garanti om helt instrumentfri sång i varje inspelning.
