import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelSidecarJob,
  pollSidecarJob,
  SidecarJobCancelledError,
} from "../app/lib/sidecar-bridge.ts";

describe("sidecar job cancellation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts a cancellation request for the encoded job id", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ job_id: "job/a", status: "cancellation_requested" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(cancelSidecarJob("job/a")).resolves.toEqual({
      job_id: "job/a",
      status: "cancellation_requested",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/jobs/job%2Fa/cancel"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("reports a cooperatively cancelled job as an expected cancellation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ status: "cancelled", message: "cancelled" }),
      })),
    );

    await expect(pollSidecarJob("job-abc", { timeoutMs: 100 })).rejects.toBeInstanceOf(
      SidecarJobCancelledError,
    );
  });
});
