"use strict";

const path = require("node:path");
const { globSync: tinyGlobSync } = require("tinyglobby");

// Next 16.4.0 only calls globSync(string, { onlyDirectories: true }).
// This adapter deliberately implements that contract, not the entire fast-glob API.
function globSync(pattern, options) {
  if (typeof pattern !== "string" || options?.onlyDirectories !== true ||
      Object.keys(options).some((key) => key !== "onlyDirectories")) {
    throw new TypeError("Unsupported Next ESLint directory glob call");
  }
  if (pattern.length > 65536) throw new SyntaxError("Next ESLint root pattern is too long");
  const nesting = [];
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "\\") { i++; continue; }
    if (char === "{" || char === "(") {
      nesting.push(char);
      if (nesting.length > 128) throw new SyntaxError("Next ESLint root pattern is nested too deeply");
    } else if ((char === "}" && nesting.at(-1) === "{") || (char === ")" && nesting.at(-1) === "(")) {
      nesting.pop();
    }
  }
  const absolute = path.isAbsolute(pattern);
  return tinyGlobSync(pattern, {
    onlyDirectories: true,
    // fast-glob matches the directory itself; tinyglobby otherwise adds /**.
    expandDirectories: false,
    absolute,
    // Avoid POSIX relative-path calculations between different Windows drives.
    cwd: absolute ? path.parse(pattern).root : process.cwd(),
  });
}

module.exports = { globSync };
