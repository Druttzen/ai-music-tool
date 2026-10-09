# Original phase plan — ChatGPT Web

Source: https://chatgpt.com/share/6ac92db0-bcf8-83eb-af54-69ca48748a66
Chat: Fortsätt coolpro2 analysen
Retrieved: 2026-10-09
The complete implementation blueprint below was read from the rendered shared
conversation, including older messages loaded by scrolling. This supersedes
inferences based only on the five recent turns returned by the chat reader.

The existing PR #54 labels cancellation extensions as 3C–3D. The original
plan below instead defines 3C as TS/Python contracts, 3D as Maestro command
results, and 3E as history/variation schemas. Use the original requirements.
The earlier FABLE specification is explicitly retired by the user in this chat.

## Exact recovered implementation blueprint
Arbetade i 8s

Kör. Jag har nu tagit igenom resten av den planerade FAS 3-hardeningen på kontraktsnivå och stannat precis före kodskrivning.

Det viktiga är att vi nu har en samlad implementation blueprint, så vi slipper börja ändra en sak och upptäcka halvvägs att en annan del av arkitekturen bygger på det gamla beteendet.

FAS 3 — komplett genomgång
3A — Cancellation
Beslut: implementeras först

Nuvarande verklighet:

Job
 ├── queued
 ├── running
 ├── done
 ├── error
 └── cancelled

men cancelled är i praktiken oanvänd eftersom ingen extern väg sätter job.cancel.

Nytt kontrakt
queued
   │
   ├── cancel ───────────────► cancelled
   │
   ▼
running
   │
   └── cancel ───────────────► cancellation_requested
                                  │
                                  ├── runner kan stoppa
                                  │       ↓
                                  │    cancelled
                                  │
                                  └── runner kan inte stoppa
                                          ↓
                                        done/error
Viktig implementation

Vi ska inte göra detta:

Python
job.cancel = True
job.status = "cancelled"

för ett aktivt MusicGen/ACE-Step-jobb.

I stället:

cancel request
      ↓
cancellation_requested
      ↓
runner-specific capability
Queue cancellation

Detta kan implementeras säkert direkt:

Job A → running
Job B → queued

cancel B

Job A → running
Job B → cancelled

Runnern för B ska aldrig startas.

Running cancellation

Första versionen:

running
   ↓
cancel
   ↓
cancellation_requested

MusicGen/ACE-Step får avsluta normalt eftersom vi redan verifierat att deras nuvarande integrationspunkter inte erbjuder säker interruption.

Tester

Vi lägger till:

queued → cancelled

running → cancellation_requested

non-cancellable runner → done

cancellable test-runner → cancelled

cancel after done → done

cancel after error → error

artifact survives request-only cancellation

completion/cancel race

public status exposes correct state

3A status

READY FOR CODE ✅

3B — Artifact result schemas

Här gör vi inte ett enormt universal-Artifact-objekt.

Det skulle vara överengineering.

Nuvarande system har flera tydliga artifactfamiljer:

Job Result
│
├── Audio
│   ├── MusicGen
│   └── ACE-Step
│
├── Stems
│
├── Vocal Transform
│
└── Other job artifacts

och separata direct-binary-resultat:

Direct Binary
├── Cover
├── Cover Ref
└── Vocal Embed
MusicGen/ACE-Step

Nuvarande:

Python
dict[str, Any]

bör få minimala interna kontrakt.

Konceptuellt:

AudioJobArtifact
├── path
├── model
├── meta
├── device?
└── audio_format?

Men viktigt:

public_job_status() ska fortsätta filtrera detta.

Vi ska alltså behålla:

internal result
       ↓
public_job_status()
       ↓
safe DTO
Stems

SeparateResult är redan relativt bra:

device
model
sources
job_id
stems[]
  ├── name
  ├── download_url
  └── filename

Behåll.

Vocal Transform

Detta är fortfarande den svagaste artifactgränsen:

body
+
headers
+
secondary URL
+
job id

Men jag rekommenderar inte att vi river upp den nu.

Det räcker att dokumentera den som ett explicit VocalTransformResult-kontrakt.

Artifactregel

Vi låser:

Frontend får aldrig backendens fysiska temp-path.

och:

Job status beskriver artifactens tillstånd.
Download endpoint levererar bytes.
3B status

READY FOR CODE ✅

3C — TypeScript ↔ Python contracts

Här hittade vi en viktig men icke-akut svaghet:

Python Pydantic
       │
       X
       │
TypeScript interfaces

Det finns alltså två manuellt underhållna representationer.

Men vi ska inte börja med codegen.

Varför?

Först behöver cancellation och artifact-kontrakten stabiliseras.

Annars bygger vi en generator ovanpå kontrakt som fortfarande ändras.

Fas 3C implementation

När 3A/3B är stabila:

Python response model
        ↓
OpenAPI
        ↓
generated/shared TS types

eller en mycket begränsad explicit contract layer om OpenAPI-generationen visar sig olämplig.

Viktig regel

Vi ska inte ersätta fungerande sidecar-bridge.ts med genererad kod.

I stället:

Generated types
      ↓
sidecar-bridge.ts
      ↓
React

Bridge-logiken ska fortsätta äga:

auth

lifecycle

error handling

polling

blob handling

headers

3C status

DESIGN READY, implementation efter 3A/3B ✅

3D — Maestro command result contract

Nuvarande:

Maestro
 ↓
commands[]
 ↓
runCommands()
 ↓
React actions

Command whitelist är redan bra.

Problemet är resultatet.

Idag är det relativt löst vad ett kommando returnerar.

Nytt kontrakt

Varje command bör konceptuellt ge:

CommandResult
├── command
├── status
├── message?
├── jobId?
├── artifact?
└── error?

Exempel:

generateMusicGen
       ↓
{
  command: "generateMusicGen",
  status: "started",
  jobId: "abc123"
}

Sedan separat:

job abc123
 ↓
running
 ↓
done
Viktigt

Vi ska inte göra Maestro ansvarig för GPU-jobb.

Maestro ska bara förstå:

started
completed
failed
cancelled
Multi-command

Nuvarande commands körs inte som en transaktion.

Det ska vi behålla.

Vi ska inte introducera rollback-system för något som idag är en enkel whitelisted dispatcher.

3D status

READY FOR CODE ✅

3E — History / variations schemas

Här finns en verklig svag typgräns:

TypeScript
variations: z.array(z.unknown())
history: z.array(z.unknown())

Det fungerar idag, men det är den typen av kontrakt som senare skapar svårdebuggade migrationer.

Men här ska vi vara försiktiga

history och variations används bredare än bara persistence.

Därför ska vi först definiera:

HistoryEntry
VariationEntry

innan Zod ändras.

Min rekommenderade struktur

Inte gigantiska schemas.

Exempelvis:

HistoryEntry
├── id
├── timestamp
├── label?
├── patch/state reference
└── metadata?

och:

VariationEntry
├── id
├── created
├── label?
├── state/patch
└── metadata?

Men exakt shape ska tas från faktisk användning, inte gissas.

3E status

AUDIT READY, men inte första kodpatchen. 🟡

3F — Cover persistence

Här blev resultatet tydligt efter artifact-tracen:

Det finns persistent:

imageAnalysis

men inte ett etablerat:

generatedCover
coverBlob
coverCacheKey
coverArtifactId

Det betyder att vi inte ska skapa en persistence-modell bara för att "det borde finnas".

Nuvarande modell
Image
 ├── preview → runtime
 └── analysis → snapshot

Cover generation:

prompt
 ↓
/cover
 ↓
PNG blob
 ↓
frontend

Den faktiska reload-contracten för genererade covers är inte etablerad.

Beslut

Ingen kodändring i FAS 3.

Om produktkravet senare blir:

"En genererad cover måste överleva projekt reload"

då gör vi en separat artifact-persistence-design.

3F status

DEFERRED BY DESIGN 🟢

Slutlig FAS 3-ordning

Nu har vi en mycket ren sekvens:

                  FAS 3
                    │
          ┌─────────▼─────────┐
          │ 3A Cancellation   │
          └─────────┬─────────┘
                    │
                    ▼
          ┌───────────────────┐
          │ 3B Artifact DTOs  │
          └─────────┬─────────┘
                    │
                    ▼
          ┌───────────────────┐
          │ 3C TS/Python     │
          │ contract align    │
          └─────────┬─────────┘
                    │
                    ▼
          ┌───────────────────┐
          │ 3D Maestro       │
          │ command result    │
          └─────────┬─────────┘
                    │
                    ▼
          ┌───────────────────┐
          │ 3E History /     │
          │ Variations       │
          └─────────┬─────────┘
                    │
                    ▼
          ┌───────────────────┐
          │ 3F Cover          │
          │ persistence      │
          │ decision only    │
          └───────────────────┘
Vad vi INTE ska göra

Det här är lika viktigt som vad vi ska göra.

❌ Ingen arkitekturomskrivning

Nuvarande:

React
 ↓
Sidecar Bridge
 ↓
FastAPI
 ↓
JobManager
 ↓
AI

är bra.

❌ Ingen ny universal-artifact engine

Inte nödvändigt.

❌ Ingen ny MCP-arkitektur

MCP fungerar och är separat.

❌ Ingen Maestro → MCP-koppling ännu

Det skulle vara en arkitekturförändring utan identifierat behov.

❌ Ingen parallell GPU-job queue

_worker_lock är avsiktlig VRAM-skyddsmekanism.

❌ Ingen fake cancellation

Detta är nu uttryckligen förbjudet i designen.

❌ Ingen cover persistence utan produktkrav
❌ Ingen Fable 5-workflow

Som du sagt: den gamla workflowen är bortkopplad från projektet.

Kodskrivningsordningen

När vi börjar skriva kod ska varje steg följa:

AUDIT
 ↓
TEST
 ↓
MINIMAL PATCH
 ↓
TEST
 ↓
CONTRACT LOCK
 ↓
NEXT PHASE
Patch 1

Endast:

ai-sidecar/ai_sidecar/jobs.py
ai-sidecar/tests/test_jobs.py

och eventuellt:

ai-sidecar/ai_sidecar/main.py

för cancellation endpoint.

Ingen MusicGen-kod.

Ingen ACE-Step-kod.

Ingen React-kod ännu.

Patch 2

Artifact-resultat.

Patch 3

TS/Python contract alignment.

Patch 4

Maestro command result.

Patch 5

History/variation.

FINAL STOP GATE — före första riktiga kodändringen

Jag skulle sätta följande lås:

Gate	Status
FAS 0 baseline	✅
FAS 1 architecture audit	✅
FAS 1A–1H	✅
FAS 2A Artifact contracts	✅
FAS 2B TS/Python alignment	✅
FAS 2C Maestro contract	✅
FAS 2D Cancellation design	✅
FAS 2E Persistence	✅
FAS 2F Artifact reload	✅
FAS 2G Cover trace	✅
MusicGen cancellation audit	✅
ACE-Step cancellation audit	✅
Existing JobManager tests audited	✅
Cancellation test matrix defined	✅
Artifact patch scope defined	✅
TS/Python patch scope defined	✅
Maestro patch scope defined	✅
History/variation audit target defined	✅
Cover persistence decision	✅
Architecture rewrite required	❌
Unknown blocker before coding	❌
🟢 PROJEKTET ÄR NU REDO FÖR KODSKRIVNING

Vi har alltså nått den punkt du bad om:

förstå befintliga kontrakt → identifiera svaga gränser → förbättra dem utan att förstöra fungerande subsystem.

Första kodpatchen bör vara FAS 3A — JobManager cancellation, med testerna först. Den ska vara liten, isolerad och inte röra MusicGen/ACE-Step-inferensen.

Repo-baslinjen är fortfarande 916c9e5 / v0.50.48, och hittills i den här genomgången har vi gjort 0 produktionsändringar.
