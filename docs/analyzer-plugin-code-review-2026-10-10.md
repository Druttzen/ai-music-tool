# Kodgranskning: Drag & Drop Analyzers och appens tillägg

Datum: 2026-10-10  
Granskad version: **0.50.62**, commit **1c02273**, branch `codex/acestep-installed-runtime`.  
Kodkälla: C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool

**Bedömning: REQUEST CHANGES — rätta de sju P1-fynden först.**  
**Säkerhet i bedömningen: hög för de konkreta kodfelen; medel för resursrisker som kräver belastningsprov.**

## Omfattning och metod

Statisk granskning av drag/drop, ljud- och bildanalys, redigeraren, cache, stem-separation, generationsflöden, export, tilläggskatalog, installation/avinstallation och modellernas tillgänglighet. Relevanta befintliga testfall har lästs. Inga nya tester har körts och ingen implementation har ändrats i denna granskning.

Alla 12 tilläggsrader i Studio-katalogen ingår: Demucs, Mel-Band, MusicGen, ACE-Step, vocal-transform, genreklassificering, vision, FLUX text, FLUX bildreferens, Vocal DSP, Vocal ML och RVC. Dessutom ingår de lokala integrationsgränserna för Vocal Embed, DiffSinger/OpenVPI, MFA, lokal kompositionsplanering, CLAP-rankning och AI Canvas Tool.

Detta är inte en fullständig revision av varje rad i externa modellbibliotek, modellvikter, ACE-Steps separata server eller Canvas Tools separata kodbas. Canvas-fynden gäller Studio-appens installation och överlämning.

F:\ai-music-tool har en äldre arbetskopia med befintliga lokala ändringar. Granskningen använder ovanstående senare version, som användes för den senaste installerade appen. Rapporten ligger i F:\ai-music-tool\docs för enkel åtkomst.

P1 = betydande funktionsfel eller risk att förlora/förväxla resultat. P2 = lägre prioriterat fel eller konkret förbättringsbehov. P3 = större framtida uppgradering.

## Fynd med hög prioritet

### 1. [P1] Avinstallation kan slå ut andra tillägg och grundanalysen

**Kod:** [src-tauri/src/sidecar_userdata.rs:674](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/src-tauri/src/sidecar_userdata.rs:674) och [ai-sidecar/pyproject.toml:14](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/ai-sidecar/pyproject.toml:14).

Avinstallation kopplar en tilläggsrad till ett gemensamt Python-bibliotek: genre tar bort `transformers`, vision tar bort `pillow`, Vocal DSP tar bort `scipy`, Vocal ML tar bort `torchaudio`. Dessa används av flera andra funktioner. Scipy används även av librosa i grundanalysen. Spårningen tar bara bort den valda raden, med ett specialfall för de två FLUX-raderna.

**Konsekvens:** användaren kan avinstallera Vocal DSP och samtidigt få trasig ljudanalys eller separation. Avinstallation av genre kan påverka MusicGen, vision, FLUX och TTS.

**Föreslagen lösning:** registrera användarens aktiverade tillägg separat från delade paket. Behåll bibliotek som basen eller andra aktiverade tillägg kräver. Använd beroendegraf eller separata miljöer för inkompatibla motorer. Kontrollera den kvarvarande miljön innan avinstallationen rapporteras som klar.

### 2. [P1] Vocal-transform tappar acapella-filen i webbgränssnittet

**Kod:** [ai-sidecar/ai_sidecar/main.py:143](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/ai-sidecar/ai_sidecar/main.py:143), [ai-sidecar/ai_sidecar/main.py:1083](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/ai-sidecar/ai_sidecar/main.py:1083) och [app/lib/sidecar-bridge.ts:824](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/app/lib/sidecar-bridge.ts:824).

Servern skickar information om remix, vocals och den extra nedladdningsadressen i egna HTTP-svarshuvuden. CORS-konfigurationen saknar `expose_headers`; middleware för lokala nätverksanrop lägger inte heller till detta. Webbläsarens fetch får därför inte läsa dessa huvudfält över olika ursprung. Klienten får `null` och tolkar primärfilen som remix.

**Konsekvens:** vid `output=both` kan remix fungera medan separat sångfil aldrig hämtas. Vid enbart vocals kan klienten felklassificera filen som remix. Även modell-/motorinformationen för andra funktioner påverkas.

**Föreslagen lösning:** exponera en uttrycklig lista över de huvudfält klienten läser, eller returnera ett JSON-resultat med adresser till båda filerna. Kontrollera flödet genom verklig webbläsar-CORS, eftersom vanliga API-testklienter inte filtrerar svarshuvuden.

Regeln är verifierad mot [FastAPIs CORS-dokumentation](https://fastapi.tiangolo.com/tutorial/cors/#use-corsmiddleware).

### 3. [P1] Omslagsgenerering blockerar hela sidecar-servern

**Kod:** [ai-sidecar/ai_sidecar/main.py:1127](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/ai-sidecar/ai_sidecar/main.py:1127) och [ai-sidecar/ai_sidecar/main.py:1168](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/ai-sidecar/ai_sidecar/main.py:1168).

Båda FLUX-rutterna är `async def` men anropar synkron modellinläsning och inferens direkt. De lämnar inte tillbaka kontrollen till serverns händelseloop under arbetet.

**Konsekvens:** health, status, avbrytningar och andra anrop kan sluta svara under ett långt omslagsjobb. Detta kan få appen att bedöma den lokala motorn som otillgänglig.

**Föreslagen lösning:** lägg FLUX i jobbhanteraren med bakgrundskörning, status och avbrytning. En kortare rättning är `await asyncio.to_thread(...)`, men arbetet behöver också ingå i resursplaneringen för GPU.

Beteendet stöds av [FastAPIs dokumentation om synkrona hjälpfunktioner](https://fastapi.tiangolo.com/async/#other-utility-functions).

### 4. [P1] Rensning eller byte av projekt stoppar inte gamla analyser

**Kod:** [app/hooks/analyzers/use-analyzer-media.js:115](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/app/hooks/analyzers/use-analyzer-media.js:115), [app/hooks/analyzers/use-analyzer-media.js:140](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/app/hooks/analyzers/use-analyzer-media.js:140), [app/hooks/analyzers/use-analyzer-media.js:292](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/app/hooks/analyzers/use-analyzer-media.js:292) och [app/hooks/analyzers/use-analyzer-media.js:656](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/app/hooks/analyzers/use-analyzer-media.js:656).

Ljudanalysen publicerar sitt resultat efter flera väntande operationer utan kontroll av vilken källa/projekt som fortfarande gäller. Bildanalysen har en generationsräknare, men reset och clear höjer inte den räknaren. Reset avbryter bara den separata LLM-merge-operationen.

**Konsekvens:** börja analysera, rensa eller byt arbetsinnehåll medan analysen arbetar, och ett äldre resultat kan sedan dyka upp igen. Generering, vocal-transform och lokal cover/remix har motsvarande risk när de ansluter resultat till analysfältet.

**Föreslagen lösning:** gemensam källidentitet och projektgeneration. Alla långvariga operationer fångar identiteten vid start och kontrollerar den före uppdatering. Rensning, källbyte och projektbyte ogiltigförklarar gamla operationer. Exponera analysens busy-status i gränssnittet; erbjud avbrytning där motorn stödjer det.

### 5. [P1] Stems kan tillhöra föregående låt men exporteras med den nya låtens namn

**Kod:** [app/hooks/use-analyzers.js:143](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/app/hooks/use-analyzers.js:143) och [app/hooks/analyzers/use-analyzer-stems.js:49](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/app/hooks/analyzers/use-analyzer-stems.js:49).

Stems rensas bara vid full reset eller när en ny separation börjar. Vanlig ljudrensning och ny filanalys rensar dem inte. Download bygger filnamnet från den aktuella ljudanalysen, medan stem-adressen ligger kvar från ett tidigare jobb. Ett gammalt pågående separationsjobb kan också publicera sitt resultat efter ett källbyte.

**Konsekvens:** separera låt A, ladda låt B och tryck på en kvarvarande stem-knapp: ljudet kan komma från A men få B:s filnamn.

**Föreslagen lösning:** spara sourceId, ursprungligt filnamn, modell och jobId tillsammans med stem-resultatet. Rensa eller dölj resultaten vid källbyte och kontrollera samma sourceId när ett jobb blir klart.

### 6. [P1] Upprepade exporter skriver över tidigare resultat utan besked

**Kod:** [app/hooks/analyzers/use-analyzer-stems.js:68](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/app/hooks/analyzers/use-analyzer-stems.js:68) och [src-tauri/src/studio_exports.rs:153](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/src-tauri/src/studio_exports.rs:153).

Stem-export använder samma namn för samma låt och stem, oavsett separationsmodell eller körning. Desktop-export använder `fs::write`, som ersätter en befintlig fil. Även upprepad studio-export med samma preset kan kollidera.

**Konsekvens:** en Demucs-vocals-export kan ersätta en tidigare clean-vocals-export. Det försvårar jämförelser och kan förlora en version användaren ville behålla.

**Föreslagen lösning:** välj ett ledigt namn atomiskt, exempelvis med modell och take-id eller ett räknarsuffix. Gör avsiktlig ersättning till ett tydligt val. Skriv till en temporär fil och byt sedan namn så att ett skrivfel inte lämnar en tidigare export trunkerad.

### 7. [P1] Lokal remix och vocal-transform sparar inte ljudet för återöppning

**Kod:** [app/hooks/analyzers/use-analyzer-vocals.js:103](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/app/hooks/analyzers/use-analyzer-vocals.js:103) och [app/hooks/analyzers/use-local-cover-remix.js:86](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/app/hooks/analyzers/use-local-cover-remix.js:86). Jämför [app/lib/generated-audio-cache.js:4](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/app/lib/generated-audio-cache.js:4).

Dessa flöden skapar en rapport och en tillfällig blob-adress men anropar inte ljudcachen. Rapportbyggaren lagrar inte heller filen. Den senare MusicGen-/ACE-Step-vägen använder däremot `cacheGeneratedAudioDraft`.

**Konsekvens:** rapporten kan finnas kvar efter spara/ladda eller omstart medan själva genererade ljudet saknas. Uppspelning och export kan då kräva att användaren manuellt återansluter en redan exporterad fil.

**Föreslagen lösning:** använd samma cachefunktion för alla lokalt skapade ljudresultat innan de ansluts till projektet. Meddela tydligt om lagringen misslyckas och behåll resultatet åtkomligt för export.

## Övriga fynd

| ID | Prioritet | Fynd och konsekvens | Kod | Rekommenderad åtgärd |
|---|---|---|---|---|
| 8 | P2 | Jobb behåller uppladdade ljudbytes i payload även efter att de blivit klara. TTL räknas från skapandet och kan även rensa ett fortfarande köat/pågående jobb. | [ai-sidecar/ai_sidecar/jobs.py:169](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/ai-sidecar/ai_sidecar/jobs.py:169), [ai-sidecar/ai_sidecar/jobs.py:209](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/ai-sidecar/ai_sidecar/jobs.py:209) | Frigör stora indata i finally; begränsa köstorlek; använd avslutningstid för TTL och rensa bara avslutade jobb. |
| 9 | P2 | ”Available” betyder oftast att paket finns, inte att modellen finns eller kan köras offline. Mel-Band standard kan erbjudas trots att bara clean-modellen provisionerats. RVC-raden kontrollerar inte lokal modell, trots att rvc_ready gör det. | [ai-sidecar/ai_sidecar/registry.py:58](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/ai-sidecar/ai_sidecar/registry.py:58), [ai-sidecar/ai_sidecar/registry.py:116](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/ai-sidecar/ai_sidecar/registry.py:116), [ai-sidecar/ai_sidecar/stems_melband.py:121](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/ai-sidecar/ai_sidecar/stems_melband.py:121), [src-tauri/src/sidecar_userdata.rs:719](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/src-tauri/src/sidecar_userdata.rs:719) | Separera dependenciesInstalled, modelCached, configured, runtimeReady och offlineReady per modell. Lägg explicit modellhämtning och reparation i Addons. |
| 10 | P2 | Taktart bestäms från avståndet mellan slag: mer än 0,55 s ger 3/4. Ett långsamt 4/4-spår kan därmed bli ”Waltz”. Vocals likely baseras på ljushet/energi; tonarten i webbfallback baseras på en ljushetsproxy. | [ai-sidecar/ai_sidecar/sonic_signature.py:121](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/ai-sidecar/ai_sidecar/sonic_signature.py:121), [app/lib/analyzer-suggestions.js:121](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/app/lib/analyzer-suggestions.js:121), [app/lib/audio-analyzer.js:100](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/app/lib/audio-analyzer.js:100) | Behåll okänt värde när underlaget saknas. Separera uppmätta värden, modellprediktioner och kreativa stilförslag. Inför faktisk takt-/sångdetektion innan dessa värden används som DNA-krav. |
| 11 | P2 | Nedladdningarna i vocal-transform och lokal cover/remix väntas inte in. ”Klart” kan visas före färdig export och senare skrivfel hamnar utanför funktionens catch. | [app/hooks/analyzers/use-analyzer-vocals.js:108](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/app/hooks/analyzers/use-analyzer-vocals.js:108), [app/hooks/analyzers/use-local-cover-remix.js:91](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/app/hooks/analyzers/use-local-cover-remix.js:91) | Await på export och separat sparstatus. Spärra upprepade klick medan filen skrivs. |
| 12 | P2 | Den extra audiocraft-installationen för MusicGen använder if let Ok och ignorerar fel. Resten av installationen kan därför rapporteras som lyckad när det obligatoriska paketet saknas. | [src-tauri/src/sidecar_userdata.rs:710](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/src-tauri/src/sidecar_userdata.rs:710) | Propagera felet och verifiera att MusicGen faktiskt kan importeras innan installationen registreras som klar. |
| 13 | P2, resursrisk | MusicGen, genre, BLIP/CLIP och RVC har egna cachade modeller. Genre/vision/vocal-embed går utanför den gemensamma jobbserialiseringen. ACE-Step kör dessutom i en annan process. | [ai-sidecar/ai_sidecar/musicgen.py:119](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/ai-sidecar/ai_sidecar/musicgen.py:119), [ai-sidecar/ai_sidecar/genre_classifier.py:55](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/ai-sidecar/ai_sidecar/genre_classifier.py:55), [ai-sidecar/ai_sidecar/vision_analyzer.py:89](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/ai-sidecar/ai_sidecar/vision_analyzer.py:89), [ai-sidecar/ai_sidecar/main.py:618](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/ai-sidecar/ai_sidecar/main.py:618) | Gemensam GPU-budget och modellöverlämning, CPU för små analyser, avlastning/eviction efter inferens. Risken för minnesbrist behöver mätas med flera tillägg i följd. |
| 14 | P2 | Canvas-installerns cache återanvänds genom att jämföra en sparad checksum-text, utan att hasha den faktiska cachefilen igen. En skadad cachefil kan därmed gå vidare till körning. Första nedladdningen hashkontrolleras redan. | [src-tauri/src/canvas_handoff.rs:979](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/src-tauri/src/canvas_handoff.rs:979) | Kontrollera filens SHA-256 mot release-digest även vid återanvändning och hämta om vid avvikelse. |
| 15 | P2 | Den generiska DiffSinger-kommandobryggan använder cmd.split(). Citerade Windows-sökvägar med blanksteg delas därför fel. | [ai-sidecar/ai_sidecar/vocal_ml_models.py:305](C:/Users/micke/.codex/worktrees/fas-3e-acestep-lifecycle/ai-music-tool/ai-sidecar/ai_sidecar/vocal_ml_models.py:305) | Konfigurera körbar fil och argument separat, helst som JSON-argumentlista. Detta gäller den generiska CLI-bryggan, inte OpenVPI-bryggans separata argumentlista. |

## Uppgraderingar per område

| Område/tillägg | Mest värdefulla nästa uppgradering |
|---|---|
| Drag & Drop Analyzers | Gemensam källidentitet, synlig analysprogress, avbrytning, storleks-/längdgränser innan full avkodning och analys i bakgrundsworker. |
| Demucs + Mel-Band | Modellstatus per checkpoint, samma avkodade WAV-indata till båda motorerna, lyssningsjämförelse och snabbval mellan sångbevarande och hård instrumentrensning. Automatisk kontroll av instrumentläckage är en uppskattning, ingen garanti om perfekt separation. |
| MusicGen | Kontrollerad installation av valda checkpoints och kompatibla bibliotek; frigör GPU när nästa motor ska arbeta. Bygg vidare på befintliga seeds, flera takes och melodireferens. |
| ACE-Step + lokal kompositör | Visa den faktiskt laddade motorn och kompositionsplanen. Spara prompt, seed, modellrevision, motiv, harmoni och take tillsammans. Mät hur den genererade låten följer planen. |
| Genre + ljud-DNA | Analysera flera representativa avsnitt, visa osäkerhet och väg in riktiga ljudembeddings. Genre/färg/ljushet bör inte ensam styra instrument eller förekomst av sång. |
| Vision, BLIP/CLIP | Versionsanpassad modelladapter, bildstorleksgränser och lokalt verifierade vikter. Visa bildbaserade musikförslag som inspiration med separat förtroende. |
| FLUX text + bildreferens | Bakgrundsjobb först; därefter dela kompatibla pipeline-komponenter för att undvika dubbla stora modeller. Anpassa stegantal till strength och använd Schnell-anpassade textinställningar. |
| Vocal-transform + Vocal DSP | Bevara stereosång utanför markerade regioner; i dag görs sången mono och dupliceras till stereo vid remix. Använd float/24-bit mellanresultat och bättre formantbevarande. |
| Vocal ML, RVC, DiffSinger | Tydlig skillnad mellan installerat bibliotek, vald röstmodell och verifierad motor. Visa när ett modellanrop faller tillbaka till DSP. Undvik att presentera tal-/guide-syntes som färdig avancerad sång. |
| MFA + Vocal Embed | Språkanpassad textnormalisering, separata statusar för exakt alignment och energiheuristik, samt kontroll av guide, tempo och notplan. |
| CLAP-rankning | Behåll att poängen beskriver stilmatchning och att alla takes sparas. Lägg till separata mått för struktur, störningar, slut och sångtydlighet; en ensam likhetspoäng visar inte musikalisk kvalitet. |
| Canvas Tool | Verifierad installer-cache, versionskontroll, rätt filtyp vid WAV-konverterad förhandslyssning och bekräftelse att båda mediefilerna importerats. |

### Gemensamma förbättringar [P3]

- En tilläggsbeskrivning som används av katalog, hälsostatus, installation och UI. Composer, MFA och DiffSinger bör synas i samma översikt även när de kräver extern installation.
- Kontrollerade versioner/revisioner för modeller och delade bibliotek. Nu har många Python-beroenden bara lägsta version, vilket gör en senare installation svår att reproducera.
- Ett ljudobjekt per källa, med alias som pekar på samma cachepost. Nu skrivs bloben under flera nycklar och gamla analyser saknar tydlig cachebudget/åldringspolicy.
- Exportera stora ljudfiler direkt från lokal motor till godkänd exportmapp. Nu skickas hela filen via blob, arrayBuffer och renderer/native-kommunikation; det kan ge stora minnestoppar.
- Gemensam loggning av funktion, modell, källa, fel och fallback. Flera moduler sväljer modellfel och returnerar None, vilket gör orsaken svår att se.

Offline-laddning stöds av de aktuella modellbiblioteken, men kräver att nödvändiga filer först finns lokalt. Använd explicit setup och lokala laddningsregler enligt [Transformers dokumentation](https://huggingface.co/docs/transformers/installation#offline-mode). FLUX-rekommendationerna bygger på [den officiella pipeline-dokumentationen](https://huggingface.co/docs/diffusers/api/pipelines/flux).

## Rekommenderad åtgärdsordning

1. **Skydda resultat:** rätta avinstallation, CORS, exportkollisioner och lagring av lokala remixresultat.
2. **Skydda arbetsflödet:** källidentitet för alla operationer, rensning av gamla stems och FLUX i bakgrundsjobb.
3. **Gör offline-status tillförlitlig:** modeller/revisioner, verifierad installation, gemensam GPU-planering och kontrollerad kö/cache.
4. **Förbättra musikförståelsen:** riktig sång-/taktanalys, separata osäkerheter och referensjämförelse.
5. **Utöka den avancerade genereringen:** mätbar planföljsamhet, bättre sångmotor och mänsklig lyssningsjämförelse över flera takes.

## Verifiering när rättningarna genomförs

Följande är föreslagna prov, inte utförda tester i denna granskning:

- Rensa/byt spår under ljudanalys, bildanalys, separation och generering: inget äldre resultat får anslutas till det nya spåret.
- Separera A och ladda B: inga A-stems får exporteras som B.
- Exportera samma stem med två modeller: båda resultaten ska finnas kvar.
- Vocal-transform med both i installerad WebView: remix och separat vocals ska kunna spelas och sparas.
- Vocal DSP/genre/vision avinstalleras medan andra tillägg finns: kvarvarande funktioner ska fungera.
- Spara/återöppna lokal cover/remix och vocal-transform: ljud och källa ska återställas.
- Generera FLUX-omslag medan health och status pollas: motorn ska förbli nåbar.
- Starta utan nätverk med respektive checkpoints saknade/närvarande: appen ska visa rätt status och inte försöka hämta modeller under inferens.
- Prova långsamt 4/4, 3/4, instrumentalt spår och isolerad sång: metadata ska inte låsas till obelagda gissningar.
- Testa stora filer och flera motorer i följd med mätning av RAM, GPU-minne och cache.

