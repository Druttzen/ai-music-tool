import { describe, it, expect, beforeAll } from "vitest";
import { SUNO_CATALOG_SYNC, metaTagTitle } from "../app/lib/suno-catalog-synced.js";
import { loadSunoCatalogSync } from "../app/lib/suno-catalog-loader.js";
import { getSunoLanguageIndex, sunoCatalogSyncMeta } from "../app/lib/suno-language-index.js";

describe("suno-catalog-sync", () => {
  beforeAll(async () => {
    await loadSunoCatalogSync();
  });
  it("loads synced manifest with meta-tags from stayen reference", () => {
    expect(SUNO_CATALOG_SYNC.metaTags.length).toBeGreaterThanOrEqual(180);
    expect(SUNO_CATALOG_SYNC.structureTags.length).toBeGreaterThanOrEqual(25);
    expect(SUNO_CATALOG_SYNC.syncedAt).toBeTruthy();
  });

  it("includes pipe notation and track container guidance", () => {
    expect(SUNO_CATALOG_SYNC.pipeNotation.format).toContain("|");
    expect(SUNO_CATALOG_SYNC.trackContainerTag.example).toContain("[track:");
  });

  it("metaTagTitle resolves known slugs", () => {
    expect(metaTagTitle("verse")).toBe("Verse");
    expect(metaTagTitle("pre-chorus")).toBe("Pre Chorus");
  });

  it("sunoLanguageIndex merges synced structure tags and principles", () => {
    const sunoLanguageIndex = getSunoLanguageIndex();
    expect(sunoLanguageIndex.structureTags).toContain("Post-Chorus");
    expect(sunoLanguageIndex.structureTags).toContain("Bridge-Drop");
    expect(sunoLanguageIndex.principles.some((p) => p.includes("4–8"))).toBe(true);
    expect(sunoCatalogSyncMeta().metaTagCount).toBe(SUNO_CATALOG_SYNC.metaTags.length);
  });
});
