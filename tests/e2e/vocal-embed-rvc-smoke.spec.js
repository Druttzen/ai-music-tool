import { test, expect } from "@playwright/test";

test.describe("vocal embed RVC smoke", () => {
  test.skip(
    !process.env.AIMC_RVC_MODEL && !process.env.AIMC_RVC_API_URL,
    "requires AIMC_RVC_MODEL or AIMC_RVC_API_URL",
  );

  test("sidecar reports RVC ready when configured", async ({ request }) => {
    const res = await request.get("http://127.0.0.1:8723/vocal-embed/models");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.rvc_ready).toBeTruthy();
  });
});
