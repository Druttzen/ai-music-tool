import { z } from "zod";

// Current producers use Date.now(); string IDs remain valid in older imports.
export const ProjectEntryIdSchema = z.union([z.number().finite(), z.string().min(1)]);

export const HistoryEntrySchema = z.object({
  id: ProjectEntryIdSchema,
  label: z.string(),
  time: z.string(),
  prompt: z.string(),
  // Snapshots include analyzer/extension fields and previous history. Do not
  // recursively reinterpret those snapshots or strip data during migration.
  state: z.record(z.string(), z.unknown()),
  avgScore: z.union([z.string(), z.number().finite()]).optional(),
}).passthrough();

export const VariationEntrySchema = z.object({
  id: ProjectEntryIdSchema,
  title: z.string(),
  prompt: z.string(),
}).passthrough();

export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;
export type VariationEntry = z.infer<typeof VariationEntrySchema>;

export function normalizeHistoryEntries(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = HistoryEntrySchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export function normalizeVariationEntries(value: unknown): VariationEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = VariationEntrySchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Recover list entries without changing missing fields or unrelated project data. */
export function normalizeProjectEntryCollections<T>(value: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const source = value as Record<string, unknown>;
  return {
    ...source,
    ...(Array.isArray(source.history) ? { history: normalizeHistoryEntries(source.history) } : {}),
    ...(Array.isArray(source.variations) ? { variations: normalizeVariationEntries(source.variations) } : {}),
  } as T;
}
