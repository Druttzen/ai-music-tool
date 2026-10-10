# M4A och återkommande fel vid omstart — 0.50.65

## Orsaker och ändringar

- Mel-Band läste M4A med libsndfile, som inte stöder AAC/ALAC i den behållaren. En gemensam lokal PyAV-avkodare används nu för Mel-Band, Demucs, ljudanalys, sonic signature och guide-vokalanalys. Den bevarar samplingsfrekvens, kanaler och flyttalsljud. Avkodaren ingår i basberoendena och PyInstaller-paketet; äldre användarmiljöer får den vid uppgradering (kräver tillgänglig wheel eller nät vid första provisioneringen).
- Fail-safe läste alla sparade fel som aktuella och laddade också den gamla hälsorapporten vid start. Varje programstart har nu en egen session. Äldre och verifierat lösta fel visas i separat historik; nya fel blir fortsatt aktiva varningar.
- Panelomförsök får bara status reparerad när panelen har renderats igen. Andra operationsfel kan inte repareras genom att radera felloggen. Ett färskt hälsoprov måste bekräfta rapporterad reparation. Återhämtning av AI-tjänsten uppdaterar också rapporten.
- Botens etikett är nu monitoring. Övervakning innebär inte att boten har korrigerat programkod.
- about:blank skapades av testverktygets WebView-anslutning. Den egna tomma fliken stängdes; det är inte appens startsida.

## Kontroller

- 687 JavaScript-tester, 237 Python-tester (1 hoppad, 1 bortvald), 53 Rust-tester.
- Noll lintvarningar, produktionsbygge och CI-kontroller godkända.
- Hela gränssnittssviten: 60 godkända, 14 valfria tester hoppade över (1,1 minuter). Installerad app testas i sin egen WebView; live-webbtester kräver åtkomst till en separat testtjänst och tillhörande modeller.
- AAC och ALAC i mono/stereo avkodas även med tom PATH; WAV-flyttal klipps inte.
- Regressionstester för historik över omstarter, upprepade nya fel, lyckade/misslyckade panelomförsök och kontroll av reparationsresultat.
- UI-tester väntar på analysernas faktiska tidsgräns. Lokala tjänsteprober har en tidsgräns och kontrollerar åtkomst till skyddade API:er; det valfria MusicGen-meloditestet kräver att just melodimodellen finns lokalt.

## Installerad Windows-app

Installeraren användes för testkopian på B:. Appen körde den levererade Python-koden; filhasharna jämfördes med källan. Modellåtkomst sattes till offline.

- Den verkliga M4A-kopia som tidigare felat (55,934 s, AAC, stereo) analyseras med librosa, genre och sonic signature utan avkodningsvarning.
- Samma M4A separeras med FT2 Bleedless på GPU till vocals och instrumental. Exporterade WAV-filer har 48 kHz, 2 684 802 bildrutor, två kanaler och enbart ändliga värden. Vocals + instrumental återger den avkodade mixen exakt i testet. Detta mäter rekonstruktion, inte perfekt frånvaro av instrumentläckage.
- Två normala stängningar och omstarter: sex historiska fel kvar, noll aktiva fel, ingen automatisk reparationsruta efter start.
- Ljudfiler och detaljerade testloggar sparas separat under testprofilens verification-katalog och ingår inte i Git.
