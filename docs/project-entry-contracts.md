# Project history and variations — original phase 3E

## Audit of actual producers and consumers

- `use-history-actions.js` produces `{id, label, time, prompt, state, avgScore}`.
  IDs are `Date.now()` numbers. Time is a localized display string; score is the
  workspace average formatted as a string. Restore loads `state` and selects `id`.
- `use-co-producer-actions.js` produces `{id, title, prompt}` variations. It does
  not create timestamps, state patches or artifact references.
- The right sidebar displays label, time, score and prompt. Snapshots can include
  analyzer information and previous history. The state contract must remain a
  plain object without recursive validation of every older snapshot.
- Autosave currently validates before loading, while separate history storage
  loads without entry validation. Imported projects and undo use the project
  LOAD normalizer. A partial LOAD intentionally preserves existing history.
- The old selected-ID schema accepts only strings although the actual producer
  selects numbers. Preserve both numeric and legacy string IDs.

## Scope

Define explicit entry schemas and types from these shapes. Keep optional older
score fields and additional snapshot/entry metadata. Validate list entries at
load boundaries independently so a malformed entry cannot discard the rest of
a valid project. Preserve the original autosave when recovery removes entries.
No change to the storage keys, ID generation, history limit or snapshot storage.

Restore keeps the current compare list. The installed test revealed that loading
the history stored inside a snapshot removed the clicked entry itself, leaving
its selected ID without a matching row. Restore now loads the song/analyzer and
variation fields while preserving current history, then selects the clicked ID.
New "Generated variations" history entries capture the generated list rather
than the state from before generation, so restoring that entry restores its
variations. Older snapshots retain their existing contents.

Explicit imported history also replaces the separate history storage after
normalizing its entries. The installed reload test exposed stale local history
overwriting the imported list, leaving its selected ID without a matching row.
Partial imports without history preserve the existing list. A failed history
write aborts the import before loading a replacement that could not survive
reload.

The physical app test also found summary-only pipeline references producing an
`undefined` extracted source prompt. Style extraction now reads the actual
analyzer tags separately; the main prompt pipeline keeps its slim summary refs.

## Phase 3F decision

The recovered plan defers cover persistence. Generated image previews remain
runtime objects; image analysis remains part of project snapshots. There is no
new requirement to persist generated cover bytes, so phase 3F requires no code.
