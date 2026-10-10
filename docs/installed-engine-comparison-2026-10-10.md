# Installerad app: referensjämförelse och ljudtest, 10 oktober 2026

## Vad som faktiskt kördes

Testerna gjordes i den installerade Tauri-appen i
`B:\AI Music Creator Studio Offline Drafts`, med dess synliga gränssnitt,
inbyggda Python och förberedda lokala modeller. MusicGen och ACE-Step skapade
riktiga ljudfiler på datorns RTX 4070 SUPER (12 GB). Dessa resultat kommer från
modellkörningar, inte från ersättningsljud eller simulerade svar.

Referensen var användarens `C:\Users\micke\Downloads\Theme of Simon.B.mp3`:
233,88 sekunder, 48 kHz, stereo. Musikbeskrivningen för alla jämförda utkast var:

> Melodic trance instrumental, video game inspired synthesizer lead,
> arpeggiated analog synthesizers, pulsing bass, driving electronic drums,
> energetic cinematic mood, clean stereo mix

Referensen användes för stillikhet. Melody conditioning var avstängd. Ingen
Suno-uppladdning eller Suno-generering gjordes. Verktygen kunde inte läsa det
redan öppna Suno-kontot/inspektorfönstret; granskningen av Suno bygger på
offentliga primärkällor och den lokala MP3-filen.

## Generering och jämförelse

| Körning | Faktisk modell och inställningar | Resultat |
| --- | --- | --- |
| Tre MusicGen-tagningar | Stereo Medium, 30 s, seeds 123/124/125 | Alla tre skapades, spelades och exporterades. Den första appkörningen var uttryckligen orankad på grund av fel cachemapp. Efter rättningen jämfördes samma exporterade ljud lokalt. Seed 124 fick högst stilpoäng. |
| Två MusicGen-tagningar | Stereo Small, 30 s, seeds 321/322 | Appens jämförelse fungerade med den rättade cachen och valde seed 322. Båda tagningarna kunde spelas och sparas. |
| ACE-Step | `acestep-v15-sft`, 30 s, 50 steg, guidance 7, seed 123, LM thinking av, tom sångtext | Riktigt SFT-ljud skapades, spelades och exporterades. API-resultat, analysmetadata och återställda kontroller visade samma inställningar. |

Alla sex ljudfiler innehöll ändliga, icke-tysta samples och äkta tvåkanalsljud.
MusicGen exporterade 32 kHz PCM24; SFT exporterade 48 kHz FLOAT.

CLAP-jämförelsen nedan använder samma prompt och samma metod för alla tre
valda ljud. Poängen är cosinuslikheter, **inte procent eller ljudkvalitetsbetyg**.
Den sammanvägda poängen är 0,6 × prompt + 0,4 × referens.

| Vald tagning | Prompt | Referens | Sammanvägt |
| --- | ---: | ---: | ---: |
| Stereo Medium, seed 124 | 0,5767 | 0,8467 | 0,6847 |
| Stereo Small, seed 322 | 0,5678 | 0,7287 | 0,6322 |
| SFT, seed 123 | 0,5279 | 0,8393 | 0,6524 |

Detta är ett begränsat urval med olika seeds och antal försök. Det visar ingen
universell rangordning mellan modellerna. CLAP-värden verifierar inte melodi,
sång, ljudkvalitet eller likvärdighet med Suno v6. Uppspelning och signalanalys
verifierades; någon blind lyssningspanel eller separat sångtest genomfördes inte.

Lyssningskopior finns i:

- `B:\AI Music Creator Studio Phase Test Final\data\exports\offline-reference-medium-30sec.wav`
- `B:\AI Music Creator Studio Phase Test Final\data\exports\offline-reference-sft-30sec.wav`

SHA256 för Medium-kopian är
`85d9be139039457970bd90ead2809d14ceb2eb7eacaca8a8605b5332d1804c4d`.
SHA256 för SFT-kopian är
`fa5c6ee4930b9cb68c519ee764a07463de5ab2820a3a4e2f1ffa9cf56ce1be86`.

## Gränssnitt, lagring och fel som hittades

- Byte till en sparad tagning ändrar både ljudet och den synliga seed-kontrollen.
  Testet hittade först att seed 124 kunde ha kontrollvärdet 123. Detta rättades
  i 0.50.53 och verifierades i den installerade appen med seeds 321/322.
- Efter en verklig sidomladdning återställdes båda tagningarnas metadata och ljud.
  Alla fyra ljudspelare nådde `readyState=4`. Byte mellan tagningarna skapade
  inga nya genereringsjobb.
- Den installerade appen använder cachemappen direkt som `HF_HUB_CACHE`.
  Förberedelseverktyget lade först CLAP i en underkatalog `hub`, vilket gav en
  tydlig orankad körning. Verktyget rättades och nästa appkörning rankade ljuden.
- Native-exporten skapade WAV och Suno-brief med faktisk modell, seed,
  samplinginställningar och vald tagning. Small-exportens SHA256 var identisk
  med den valda tagningen, `1534c699558756123e1f43e067e7425287f59d1c80a6e8b25c2996b62de64af9`.
- Avbryt-knappen testades under en ny tvåtagningars sökning. Jobbet
  `a02392b8634342c6` slutade i `cancelled`, med `ready=false` och inget ljudresultat.
- Ofullständiga checkpoint-mappar betraktas nu som otillgängliga. SFT-filen
  kontrollerades mot Hugging Faces officiella SHA256:
  `d4dd3a93870f06720027965b90771f529ab02094b3d29e2518f1d5e097e1af7e`.
- Den redan körande ACE-servern hade inga aktiva/köade jobb. För testet laddades
  SFT genom serverns officiella `/v1/init`-funktion. Appens automatiska vägran
  att ändra en annan servers modell kvarstår.
- `Exit Studio` rensar arbetsytan enligt appens befintliga funktion. Detta
  är separat från sidomladdningens verifierade återställning. En arbetsbundle
  exporterades inför installationen.
- Byte från SFT till MusicGen lade först tekniska analysrubriker i musikprompten.
  Den slutliga rättningen i 0.50.54 återanvänder musikbeskrivningen eller de
  valda projektfälten och utesluter dessa rapportnamn.
- Kontrollen i installerade 0.50.54 återställde först ”Use track DNA” till på,
  trots att genereringen hade körts med funktionen av. I 0.50.55 lagras valet
  uttryckligen. Äldre sparade tagningar återställer det från sina faktiska
  BPM-/tonartsparametrar. Aktiverad DNA återanvänder ursprungliga värden och
  ersätter dem inte med uppskattningar från det nygenererade ljudet.
- En uttryckligen vald SFT-/Base-modell bevaras också när readiness tillfälligt
  saknas. Saknad checkpoint blockerar genereringsknappen och ger en tydlig
  status, istället för att byta till Turbo.

## Kodtester och byggresultat

Version 0.50.55: 659 JavaScript-tester i 128 testfiler godkända, lint godkänd.
Backendändringarna: 172 Python-tester godkända, ett hoppat över och ett avvalt.
52 genererade API-scheman samt Rust-låsfiler verifierades. Produktionsbygge
av både NSIS och MSI godkänt; NSIS-installationen gav exitkod 0.

### Slutkontroll av installerade 0.50.55

Appens titel och lokala `/health` rapporterade 0.50.55 och CUDA. Byte från det
återställda SFT-resultatet till MusicGen visade den ursprungliga musikprompten,
utan tekniska rapportnamn. Inget genereringsjobb startades av återställningen.

Ett ytterligare riktigt SFT-jobb, `8e093bdf3c6d445f`, skapade 30 sekunder stereo
med 50 steg, guidance 7, seed 123 och DNA av. Native-spelarens tid avancerade
till 1,5978 sekunder utan mediafel. Efter sidomladdning nådde båda spelarna
`readyState=4`; modell, seed, steg, guidance, LM av och uttryckligt `useDna=false`
återställdes. WAV och brief exporterades från gränssnittet. Därmed skapades
totalt sju verkliga testljud i denna fas.

Slutexporten är
`B:\AI Music Creator Studio Phase Test Final\data\exports\suno-draft-1791634477642.wav`
med SHA256 `413b7321ee48eb47263ee354fe3918504f2a36f4c28e7e3363d5b5d061c66167`,
30 sekunder, 48 kHz, två kanaler, ändliga samples och peak 0,8913.
Briefen redovisar uttryckligen DNA av. En uppdaterad arbetsbundle sparades också.
De två SFT-körningarna gav olika ljudbytes trots samma noterade seed och
huvudinställningar; byteidentisk reproducerbarhet har alltså inte verifierats.

Testerna omfattar bland annat seeds, bounds, avbrytning/rensning, saknad
jämförelsemodell, tyst referens, privata filsökvägar i API-svar, lagrade
ljudbytes, migration, SFT-readiness och återställda kontroller.

Maskinläsbara lokala bevis sparas i den ignorerade katalogen
`test-results/engine-research`, bland annat `installed-ranked-0.50.53.json`,
`take-switch-no-generation.json`, `installed-sft.json`, `sft-playback.json`,
`physical-search-cancel.json` och `final-reference-comparison.json`.
Slutversionens bevis är `installed-0.50.55-prompt.json`,
`installed-sft-0.50.55.json`, `reloaded-sft-0.50.55.json`,
`final-sft-waveform.json` och `final-installed-ui.png`.
Användarens MP3 och genererade ljud har inte lagts i Git.

Se [motorgranskningen](suno-engine-research-2026-10-10.md) för primärkällor,
modellalternativ och det arbete som fortfarande krävs för att kunna pröva
ett påstående om Suno-likvärdig kvalitet.
