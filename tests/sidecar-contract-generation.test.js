import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { schemaType, renderContracts } = require("../scripts/generate-sidecar-contracts.cjs");

describe("Python OpenAPI to TypeScript contracts", () => {
  it("preserves nullable values, literals, references and arrays", () => {
    expect(schemaType({ anyOf: [{ $ref: "#/components/schemas/PublicJobStatus" }, { type: "null" }] }))
      .toBe("PublicJobStatus | null");
    expect(schemaType({ enum: ["queued", "cancellation_requested", "done"] }))
      .toBe('"queued" | "cancellation_requested" | "done"');
    expect(schemaType({ type: "array", items: { type: "integer" } })).toBe("Array<number>");
  });

  it("preserves required fields and arbitrary metadata without using any", () => {
    const type = schemaType({ type: "object", required: ["id"], properties: {
      id: { type: "string" }, note: { anyOf: [{ type: "string" }, { type: "null" }] },
    } });
    expect(type).toContain('"id": string');
    expect(type).toContain('"note"?: string | null');
    expect(schemaType({ type: "object", additionalProperties: true })).toBe("Record<string, unknown>");
  });

  it("rejects unsupported schema constructs instead of silently weakening types", () => {
    expect(() => schemaType({ not: { type: "string" } })).toThrow();
    expect(() => schemaType({ $ref: "https://example.com/schema" })).toThrow();
  });

  it("preserves union precedence inside intersections", () => {
    expect(schemaType({ allOf: [{ anyOf: [{ type: "string" }, { type: "null" }] }, { type: "number" }] }))
      .toBe("(string | null) & number");
  });

  it("uses generated response types in the handwritten bridge", () => {
    const bridge = readFileSync(new URL("../app/lib/sidecar-bridge.ts", import.meta.url), "utf8");
    expect(bridge).toContain('import type * as SidecarContracts from "./generated/sidecar-contracts"');
    expect(bridge).toContain("SidecarContracts.PublicJobStatus");
    expect(bridge).toContain("SidecarContracts.JobCancelResponse");
    expect(bridge).toContain("SidecarHealth = SidecarContracts.Health");
  });

  it("has no drift between the OpenAPI snapshot and generated frontend types", () => {
    const schema = JSON.parse(readFileSync(new URL("../docs/sidecar-openapi.json", import.meta.url), "utf8"));
    const generated = readFileSync(new URL("../app/lib/generated/sidecar-contracts.ts", import.meta.url), "utf8");
    expect(generated).toBe(renderContracts(schema));
    expect(generated).toContain('"cancellation_requested"');
  });
});
