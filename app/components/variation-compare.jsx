"use client";

import { useMemo, useState } from "react";

/**
 * Side-by-side A/B for generated variation prompts.
 * @param {{ variations: { id: number|string, title: string, prompt: string }[], onCopy: (text: string, label: string) => void, onApplyWinner?: (prompt: string) => void }} props
 */
export function VariationCompare({ variations, onCopy, onApplyWinner }) {
  const [idA, setIdA] = useState(variations[0]?.id ?? "");
  const [idB, setIdB] = useState(variations[1]?.id ?? "");

  const varA = useMemo(() => variations.find((v) => v.id === idA), [variations, idA]);
  const varB = useMemo(() => variations.find((v) => v.id === idB), [variations, idB]);

  const diffLines = useMemo(() => {
    if (!varA || !varB) return [];
    const aLines = varA.prompt.split("\n");
    const bLines = varB.prompt.split("\n");
    const max = Math.max(aLines.length, bLines.length);
    const out = [];
    for (let i = 0; i < max; i++) {
      const a = aLines[i] ?? "";
      const b = bLines[i] ?? "";
      if (a !== b) out.push({ i: i + 1, a, b });
    }
    return out.slice(0, 24);
  }, [varA, varB]);

  if (variations.length < 2) return null;

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/10 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-200/90">
        A / B compare
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-[10px] text-white/50">
          Variation A
          <select
            value={idA}
            onChange={(e) => setIdA(Number(e.target.value) || e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/35 p-2 text-xs text-white"
          >
            {variations.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] text-white/50">
          Variation B
          <select
            value={idB}
            onChange={(e) => setIdB(Number(e.target.value) || e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/35 p-2 text-xs text-white"
          >
            {variations.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/40 p-2 text-[10px] text-white/75">
          {varA?.prompt ?? "—"}
        </pre>
        <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/40 p-2 text-[10px] text-white/75">
          {varB?.prompt ?? "—"}
        </pre>
      </div>

      {diffLines.length > 0 ? (
        <div className="rounded-xl border border-amber-400/20 bg-black/30 p-2 text-[10px] text-amber-100/90">
          <div className="mb-1 font-bold text-amber-200/80">Changed lines ({diffLines.length})</div>
          <ul className="max-h-32 space-y-1 overflow-auto">
            {diffLines.map((d) => (
              <li key={d.i}>
                <span className="text-white/40">L{d.i}</span> A: {d.a.slice(0, 80) || "∅"} · B: {d.b.slice(0, 80) || "∅"}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[10px] text-white/40">Selected variations are identical.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {varA ? (
          <button
            type="button"
            onClick={() => onCopy(varA.prompt, `${varA.title} copied`)}
            className="rounded-xl bg-white px-3 py-1 text-xs font-bold text-black hover:bg-cyan-100"
          >
            Copy A
          </button>
        ) : null}
        {varB ? (
          <button
            type="button"
            onClick={() => onCopy(varB.prompt, `${varB.title} copied`)}
            className="rounded-xl bg-white px-3 py-1 text-xs font-bold text-black hover:bg-cyan-100"
          >
            Copy B
          </button>
        ) : null}
        {onApplyWinner && varA ? (
          <button
            type="button"
            onClick={() => onApplyWinner(varA.prompt)}
            className="rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-100"
          >
            Use A as notes seed
          </button>
        ) : null}
      </div>
    </div>
  );
}
