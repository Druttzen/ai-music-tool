import { useState } from "react";

export function Pill({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-2xl border px-3 py-2 text-xs font-semibold transition " +
        (active
          ? "border-cyan-300 bg-cyan-300/20 text-cyan-100 shadow shadow-cyan-500/20"
          : "border-white/10 bg-black/25 text-white/60 hover:bg-white/10 hover:text-white")
      }
    >
      {children}
    </button>
  );
}

export function Panel({ title, hint, children }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.065] p-4 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="mb-3">
        <h2 className="text-lg font-black">{title}</h2>
        {hint && <p className="mt-1 text-xs text-white/45">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function Slider({ label, value, setValue, left, right, min = 0, max = 100 }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="mb-2 flex justify-between text-xs font-bold uppercase tracking-wider text-white/55">
        <span>{label}</span>
        <span className="text-cyan-200">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full accent-cyan-300"
      />
      <div className="mt-1 flex justify-between text-[10px] text-white/35">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

export function TextBox({ label, value, setValue }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-bold uppercase tracking-wider text-white/45">{label}</div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-[72px] w-full resize-y rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-cyan-300"
      />
    </label>
  );
}

export function DropBox({ title, hint, accept, onFile, children }) {
  const [drag, setDrag] = useState(false);

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={
        "block cursor-pointer rounded-3xl border-2 border-dashed p-4 text-center transition " +
        (drag ? "border-orange-300 bg-orange-300/15" : "border-white/15 bg-black/25 hover:bg-white/10")
      }
    >
      <div className="text-sm font-black text-cyan-100">{title}</div>
      <div className="mt-1 text-xs text-white/45">{hint}</div>
      <input
        type="file"
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
        className="hidden"
      />
      {children}
    </label>
  );
}
