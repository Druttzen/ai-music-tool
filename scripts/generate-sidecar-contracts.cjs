#!/usr/bin/env node
/** Generate shared types from FastAPI; the handwritten bridge keeps HTTP behavior. */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function schemaName(name) {
  return name.replace(/[^A-Za-z0-9_]/g, "_").replace(/^(?=\d)/, "_");
}

function schemaType(schema) {
  if (schema === false) return "never";
  if (schema === true) return "unknown";
  if (!schema || typeof schema !== "object") throw new Error("Invalid JSON schema");
  for (const key of ["not", "if", "then", "else", "patternProperties", "unevaluatedProperties"]) {
    if (key in schema) throw new Error(`Unsupported schema construct: ${key}`);
  }
  if (schema.$ref) {
    const prefix = "#/components/schemas/";
    if (!schema.$ref.startsWith(prefix)) throw new Error(`Unsupported reference: ${schema.$ref}`);
    return schemaName(decodeURIComponent(schema.$ref.slice(prefix.length)));
  }
  if ("const" in schema) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join(" | ") || "never";
  for (const key of ["anyOf", "oneOf", "allOf"]) {
    if (schema[key]) {
      const separator = key === "allOf" ? " & " : " | ";
      return schema[key].map((part) => {
        const type = schemaType(part);
        return key === "allOf" && type.includes(" | ") ? `(${type})` : type;
      }).join(separator);
    }
  }
  if (Array.isArray(schema.type)) {
    return schema.type.map((type) => schemaType({ ...schema, type })).join(" | ");
  }
  switch (schema.type) {
    case "null": return "null";
    case "string": return "string";
    case "number":
    case "integer": return "number";
    case "boolean": return "boolean";
    case "array":
      if (schema.prefixItems) {
        return `[${schema.prefixItems.map(schemaType).join(", ")}${schema.items === false ? "" : ", ...unknown[]"}]`;
      }
      return `Array<${schemaType(schema.items ?? {})}>`;
    case "object": {
      const properties = schema.properties ?? {};
      const required = new Set(schema.required ?? []);
      const fields = Object.keys(properties).sort().map((key) =>
        `${JSON.stringify(key)}${required.has(key) ? "" : "?"}: ${schemaType(properties[key])};`,
      );
      const extra = schema.additionalProperties;
      const record = extra === true || (extra && typeof extra === "object")
        ? `Record<string, ${schemaType(extra === true ? {} : extra)}>` : null;
      if (!fields.length) return record ?? "Record<string, unknown>";
      const object = `{\n${fields.map((field) => `  ${field}`).join("\n")}\n}`;
      return record ? `${object} & ${record}` : object;
    }
    case undefined:
      if (!Object.keys(schema).some((key) => !["title", "description", "default", "examples"].includes(key))) {
        return "unknown";
      }
      throw new Error(`Unsupported schema: ${JSON.stringify(schema)}`);
    default: throw new Error(`Unsupported schema type: ${schema.type}`);
  }
}

function renderContracts(openapi) {
  const schemas = openapi.components?.schemas;
  if (!schemas) throw new Error("OpenAPI schemas are missing");
  const names = Object.keys(schemas).sort();
  if (new Set(names.map(schemaName)).size !== names.length) throw new Error("Schema name collision");
  const declarations = names.map((name) => `export type ${schemaName(name)} = ${schemaType(schemas[name])};`);
  return [
    "// Generated from the Python FastAPI OpenAPI contract. Do not edit by hand.",
    "// Regenerate: npm run contracts:sidecar",
    "",
    ...declarations.flatMap((declaration) => [declaration, ""]),
  ].join("\n");
}

function main() {
  const root = path.resolve(__dirname, "..");
  const venv = path.join(root, "ai-sidecar", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const python = process.env.SIDECAR_PYTHON || (fs.existsSync(venv) ? venv : process.platform === "win32" ? "python" : "python3");
  const env = { ...process.env };
  delete env.PYTHONPATH;
  delete env.PYTHONHOME;
  const result = spawnSync(python, [path.join(__dirname, "export-sidecar-openapi.py")], {
    cwd: root, env, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, windowsHide: true,
  });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || "OpenAPI export failed");
  const schema = JSON.parse(result.stdout);
  const snapshot = `${JSON.stringify(schema, null, 2)}\n`;
  const contracts = renderContracts(schema);
  const outputs = [
    [path.join(root, "docs", "sidecar-openapi.json"), snapshot],
    [path.join(root, "app", "lib", "generated", "sidecar-contracts.ts"), contracts],
  ];
  for (const [file, content] of outputs) {
    if (process.argv.includes("--check")) {
      if (!fs.existsSync(file) || fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n") !== content) {
        throw new Error(`Contract drift in ${path.relative(root, file)}; run npm run contracts:sidecar`);
      }
    } else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
  }
  console.log(`Sidecar contracts ${process.argv.includes("--check") ? "verified" : "generated"}: ${Object.keys(schema.components.schemas).length} schemas`);
}

module.exports = { schemaType, renderContracts };
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
