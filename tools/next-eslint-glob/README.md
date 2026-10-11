# Next ESLint directory glob adapter

The override in the root package manifest is scoped to `@next/eslint-plugin-next@16.4.0`.
That release's only use of `fast-glob` is `globSync(rootDir, { onlyDirectories: true })`
in `dist/utils/get-root-dirs.js`. This private package implements precisely that call
using the published `tinyglobby@0.2.17`, preserving literal-directory matching and
absolute Windows paths across drives. It does not implement other fast-glob APIs.

The replacement removes `fast-glob`, `micromatch` and `braces` from the dependency
graph. Braces 3.0.3 has no published fix for
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
No advisory is suppressed and no third-party version is relabeled.

Inputs longer than 65,536 characters or nested beyond 128 levels fail with an explicit
`SyntaxError` before glob parsing or filesystem traversal. Next root settings do not
need deeply nested expressions.

`tests/next-eslint-glob-dependency.test.js` exercises the real Next plugin, Windows
paths, wildcard/brace/extglob roots, directory-only results, the internal-link ESLint
rule, and adversarial nesting. Reassess this narrowly scoped override when upgrading
Next or when upstream removes or fixes the vulnerable dependency. Install from the
repository root with `npm ci`; this package is internal development tooling.
