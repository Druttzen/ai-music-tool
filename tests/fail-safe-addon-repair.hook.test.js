// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from "vitest";
import { buildRuntimeHealthReport } from "../app/lib/fail-safe-bot.js";
import { remediateRuntimeIssues } from "../app/lib/fail-safe-local-remediate.js";
import { clearLocalFaults, getActiveLocalFaults, recordLocalFault } from "../app/lib/fail-safe-runtime-fault.js";
import { installSidecarExtra, waitForSidecarExtraReady, fetchSidecarHealthAfterExtraInstall, confirmSidecarExtraInstalled, formatSidecarExtraInstallStatus } from "../app/lib/sidecar-extra-install-client.js";

vi.mock("../app/lib/sidecar-extra-install-client.js", async (original) => ({
  ...await original(), installSidecarExtra: vi.fn(), waitForSidecarExtraReady: vi.fn(), fetchSidecarHealthAfterExtraInstall: vi.fn(),
}));
beforeEach(() => { clearLocalFaults(); vi.clearAllMocks(); vi.mocked(fetchSidecarHealthAfterExtraInstall).mockResolvedValue(null); });

function issues() {
  return buildRuntimeHealthReport({ sidecarAiStatus: "ready", sidecarGenerateAvailable: true,
    sidecarHealth: { librosa_available: true }, appSubsystems: { localFaults: getActiveLocalFaults() } }).issues;
}

it("resolves a failed plugin only after the fresh engine readiness check passes", async () => {
  recordLocalFault({ source: "addons.install:stems", message: "Interrupted download" });
  vi.mocked(installSidecarExtra).mockResolvedValue({ ok: true });
  vi.mocked(waitForSidecarExtraReady).mockResolvedValue({ capabilities: [{ id: "stems", dependenciesInstalled: true, runtimeReady: true }] });
  const result = await remediateRuntimeIssues(issues());
  expect(result.ok).toBe(true);
  expect(installSidecarExtra).toHaveBeenCalledWith("stems");
  expect(getActiveLocalFaults()).toHaveLength(0);
});

it("resolves an already recovered plugin without reinstalling working packages", async () => {
  recordLocalFault({ source: "addons.install:stems", message: "Old interrupted download" });
  vi.mocked(fetchSidecarHealthAfterExtraInstall).mockResolvedValue({ capabilities: [{ id: "stems", dependenciesInstalled: true, runtimeReady: true }] });
  expect((await remediateRuntimeIssues(issues())).ok).toBe(true);
  expect(installSidecarExtra).not.toHaveBeenCalled();
  expect(getActiveLocalFaults()).toHaveLength(0);
});

it("keeps the installation failure active when installation claims success but the model is still missing", async () => {
  recordLocalFault({ source: "addons.install:stems", message: "Interrupted download" });
  vi.mocked(installSidecarExtra).mockResolvedValue({ ok: true });
  vi.mocked(waitForSidecarExtraReady).mockResolvedValue({ capabilities: [{ id: "stems", dependenciesInstalled: true, runtimeReady: false, models: { htdemucs: false } }] });
  expect((await remediateRuntimeIssues(issues())).ok).toBe(false);
  expect(getActiveLocalFaults()).toHaveLength(1);
});

it("shows model-access guidance when a retry discovers a gated download", async () => {
  recordLocalFault({ source: "addons.install:cover", message: "Interrupted download" });
  vi.mocked(installSidecarExtra).mockResolvedValue({ ok: false, error: "GatedRepoError: 401 Unauthorized" });
  const result = await remediateRuntimeIssues(issues());
  expect(result.ok).toBe(false);
  expect(result.steps[0].action).toBe("model-access");
  expect(result.steps[0].actionUrl).toBe("https://huggingface.co/black-forest-labs/FLUX.1-schnell");
});

it("clears the access warning after the same plugin is manually installed and verified", () => {
  const error = "GatedRepoError: 401 Unauthorized https://huggingface.co/black-forest-labs/FLUX.1-schnell/resolve/main/model_index.json";
  recordLocalFault({ source: "ui.status", message: formatSidecarExtraInstallStatus({ ok: false, error }) });
  recordLocalFault({ source: "addons.install:cover", message: error, stack: error });
  expect(issues().filter((issue) => issue.id === "sidecar_extra_install")).toHaveLength(1);
  expect(confirmSidecarExtraInstalled("cover", { capabilities: [{ id: "cover", dependenciesInstalled: true, runtimeReady: true }] })).toBe(true);
  expect(getActiveLocalFaults()).toHaveLength(0);
});
