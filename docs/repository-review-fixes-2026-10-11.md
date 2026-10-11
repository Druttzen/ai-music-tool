# Rättningar efter kataloggranskningen — 11 oktober 2026

Branch: `codex/fix-repository-review-2026-10-11`. Utgångspunkt: `462cb6c` och produktversion 0.50.66. Rättningar i källkoden, inte en publicerad ny installation.

## Åtgärdade fynd

| Fynd | Rättning |
|---|---|
| R01 — Räddning av projektdata | Räddningskopians skrivresultat kontrolleras före radering. Misslyckad hydrerings-/räddningsväg blockerar autosave; även trasig JSON behålls. Användarens uttryckliga reset återupptar autosave. |
| R02 — Pluginstängning återställer huvudappen | Återställningsflaggan sätts endast vid slutfört appavslut, inte vid ett pluginfönsters stängningsbegäran. |
| R03 — Avbruten avinstallation | Kontroll/fråga om körande app sker före radering av pluginmanifest och installationsbokföring. |
| R04 — Långa ljudjobb | En räknare håller sidecaren aktiv under förfrågningar, köande/körande jobb och modelloperationer. Efter avslutat arbete börjar inaktivitetstiden om. |
| R05 — LLM/CSP | Båda desktop-policyerna tillåter de fyra erbjudna externa leverantörernas exakta värdar. |
| R06 — Automatisk publicering | Reparationsskripten kräver ett rent arbetsområde före körning och stage:ar endast spårade reparationer. Rapportpublicering skyddas också mot redan ändrat arbetsområde och befintlig branch. |
| R07 — Hemligheter i felrapporter | Gemensam maskering av hela Bearer/Basic-headern, nya tokenformat och strukturerade credentialfält. Används i kö/URL/export och vid slutlig CLI-leverans, även för gamla rapportfiler. |
| R08 — Formanttransform | Spektral formantförskjutning med bevarade harmoniska frekvenser/faser och exakt ISTFT-längd ersätter pitch-/tidsändringen. Noll förskjutning är identitet. |
| R09 — Omsampling | Bibliotekets filterfördröjning kompenseras; tillräcklig flush följs av exakt utmatningslängd. Felaktig samplingsfrekvens/kanalram avvisas. |
| R10 — ACE-Step-reset | Det odefinierade `setCopyStatus`-anropet är borttaget. |
| R11 — Slumpval bland stilar | Fallback använder det faktiskt laddade registret `awesomeTags`. |
| R12 — Processägarskap | Stoppskriptet kräver detta arbetsområdes Python, sidecar-entrypoint och exakta appkatalog innan stopp. |
| R13 — MusicGen-modellinstallation | Valda Small/Medium/Melody- och stereomodeller kan förberedas internt genom en tillåten lista. Ny desktopknapp förbereder vald modell; generering är spärrad tills den verifierats. |

Det saknade importnamnet i pluginpanelens fallback är också rättat. ESLint kontrollerar nu odefinierade namn i appens JavaScript/JSX utan att felaktigt klassa TypeScript-typnamn som runtimefel. README-versionen är synkad.

## Genomförd verifiering

- JavaScript: **718 tester passerade i 136 testfiler** efter funktionsrättningarna och den slutliga ersättningen av den sårbara beroendekedjan.
- Python: **251 passerade, 7 hoppades över, 1 långsam test deselectades**. Ingen ny modellhämtning behövdes för dessa tester. En librosa-varning om tomt frekvensunderlag kom från ett syntetiskt rytmtest.
- DSP/Rust: **30 tester passerade**, inklusive exakt längd för korta/partiella block vid fyra samplingsfrekvenser samt korrekt impulsposition efter omsampling.
- Native Studio: `cargo check --locked` passerade med den nya modellförberedelsekommandot och fönsterlivscykeln.
- Processägarskap: tre isolerade kontroller godkände den egna sidecaren och avvisade en annan tjänst respektive ett annat arbetsområde. Ingen riktig process stoppades i kontrollen.
- Produktionsbygge med **Next 16.4.0** och TypeScript passerade, inklusive statisk export och kontroll av lazyladdade kataloger.

Regressionsfallen omfattar full lagringskvot/trasig JSON, hela Authorization-headern, avinstallationens ordning, reset endast vid appavslut, nekad automatisk publicering vid befintliga ändringar, vald modellförberedelse och formanttransform utan tyst utfyllnad eller ändrad tonhöjd. Modellhämtningen provades med mockade modellbibliotek; testet laddade inte ner flera GB vikter.

Efter den gemensamma maskeringen och återupptagning av autosave kördes hela JavaScript-sviten, lint och produktionsbygge igen.

## Beroenden

Next och dess ESLint-konfiguration är uppdaterade till **16.4.0**. Säkerhetsuppdateringar för `sharp`, `source-map-js` och `brace-expansion` är låsta genom paketmanifest och lockfil.

**Fullständig audit: 0 rapporterade sårbarheter. Produktionsaudit: 0.** De fem tidigare high-varningarna kom från samma kedja `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. Eftersom senaste publicerade `braces` fortfarande är 3.0.3 och saknar rättning för [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) ersätts kedjan med `tinyglobby@0.2.17` genom en intern kompatibilitetsmodul i `tools/next-eslint-glob`.

Ersättningen gäller endast `@next/eslint-plugin-next@16.4.0`. Modulens stöd motsvarar det enda faktiska anropet i denna version: `globSync(rootDir, { onlyDirectories: true })`. Den bevarar matchning av själva mappen och absoluta Windows-sökvägar över olika diskar. Mönster över 65 536 tecken eller 128 nästlingsnivåer avvisas före parsning och mappsökning. Next och ESLint-konfigurationen är fortsatt 16.4.0; säkerhetsvarningar är inte undertryckta och inga externa paket har fått påhittade versionsnummer.

En ren installation från lockfilen (`npm ci --ignore-scripts`) och kontroll av hela det installerade beroendeträdet passerade. `braces` och `micromatch` finns inte längre i lockfilen eller det installerade trädet. **18 nya regressionstester passerade**: absoluta/relativa Windows-sökvägar, literal/wildcard/brace/extglob, mappar kontra filer, Nexts interna-länkregel och skadlig nästling. Testet kontrollerar även att pluginens faktiska användning fortfarande motsvarar kompatibilitetsmodulen. Vid framtida Next-uppgradering måste ersättningen omvärderas.

Auditresultaten är sparade i `test-results/repository-review-2026-10-11/npm-audit-dependency-fix.json` och `npm-audit-production-dependency-fix.json`.

Efter den rena installationen passerade hela JavaScript-sviten (718 tester), `npm run lint` utan lintvarningar och `npm run build`, inklusive TypeScript, statisk export och kontroll av lazyladdade kataloger. Testresultatet finns i `test-results/repository-review-2026-10-11/vitest-dependency-fix.json`.

## Återstående leveranskontroll

Ingen ny installerare publicerades och den installerade kopian ersattes inte under den här rättningen. Avinstallationens avbrytande, verklig hämtning av en ny stor modell och en separat fysisk genomgång av den nya installerade appen är därför inte verifierade här. Formantalgoritmens tester styrker de rättade pitch-/längdproblemen; de garanterar inte perfekt sångkvalitet eller perfekt stems-separation.
