import { beforeEach, expect, it, vi } from "vitest";
import { exportSunoDraft } from "../app/lib/suno-draft-export";
import { buildSunoUploadBrief, SUNO_CURRENT } from "../app/lib/suno-current";
import { saveOrDownloadBlob } from "../app/lib/studio-file-save";

vi.mock("../app/lib/studio-file-save", () => ({ saveOrDownloadBlob: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); saveOrDownloadBlob.mockResolvedValue({ mode: "studio", path: "B:/exports/draft.wav" }); });

it("saves original audio bytes and a separate v6 brief with the chosen style and seed", async () => {
  const blob = new Blob(["original waveform bytes"], { type: "audio/wav" });
  await exportSunoDraft({ blob, analysis: { musicGenSettings: { seed: 123 }, musicGenModel: "facebook/musicgen-stereo-small", duration: 30 }, style: "French house, 121 bpm", lyrics: "Instrumental" });
  expect(saveOrDownloadBlob.mock.calls[0][0]).toBe(blob);
  expect(saveOrDownloadBlob.mock.calls[0][1]).toMatch(/\.wav$/);
  const brief = await saveOrDownloadBlob.mock.calls[1][0].text();
  expect(brief).toContain("French house, 121 bpm");
  expect(brief).toContain('"seed":123');
  expect(brief).toContain("Suno v6");
});

it("does not label an MP3 as WAV", async () => {
  await exportSunoDraft({ blob: new Blob(["mp3"], { type: "audio/mpeg" }), analysis: {} });
  expect(saveOrDownloadBlob.mock.calls[0][1]).toMatch(/\.mp3$/);
});

it("does not report a completed export when the brief write fails", async () => {
  saveOrDownloadBlob.mockResolvedValueOnce({ mode: "studio", path: "B:/draft.wav" }).mockRejectedValueOnce(new Error("disk full"));
  await expect(exportSunoDraft({ blob: new Blob(["wav"], { type: "audio/wav" }) })).rejects.toThrow("Audio was saved to B:/draft.wav");
});

it("rejects missing audio before saving a misleading brief", async () => {
  await expect(exportSunoDraft({ blob: null })).rejects.toThrow("Load or generate");
  expect(saveOrDownloadBlob).not.toHaveBeenCalled();
});

it("keeps verified product facts separate from unconfirmed copy limits", () => {
  expect(SUNO_CURRENT.models.map(m => m.id)).toEqual(["v6", "v6-wild", "v6-mini"]);
  expect(SUNO_CURRENT.copyBudgets.officialV6LimitVerified).toBe(false);
  expect(SUNO_CURRENT.audioUploadMaxSeconds.Pro).toBe(1800);
  expect(buildSunoUploadBrief({})).not.toMatch(/Suno v5/);
});

it("includes the learned composition plan in the portable handoff", () => {
  const plan = { original_prompt: "Heroic trance", caption: "Expanded arrangement", planner_model: "acestep-5Hz-lm-1.7B", duration_sec: 30 };
  const brief = buildSunoUploadBrief({ analysis: { compositionPlan: plan } });
  expect(brief).toContain(`Local AI composition plan: ${JSON.stringify(plan)}`);
});
