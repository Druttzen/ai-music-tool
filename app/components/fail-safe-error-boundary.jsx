"use client";

import { Component } from "react";
import { captureRuntimeFault } from "../lib/fail-safe-runtime-capture";

/**
 * Isolates a studio region so a render crash does not blank the whole app.
 */
export class FailSafeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    const name = this.props.name || "ui";
    const stack = [error instanceof Error ? error.stack : "", info?.componentStack]
      .filter(Boolean)
      .join("\n");
    captureRuntimeFault({
      source: `react:${name}`,
      message: error instanceof Error ? error.message : String(error || "render error"),
      stack,
    });
  }

  render() {
    if (this.state.error) {
      const name = this.props.name || "this panel";
      const message =
        this.state.error instanceof Error
          ? this.state.error.message
          : String(this.state.error);
      return (
        this.props.fallback || (
          <div
            className="rounded-2xl border border-red-400/35 bg-red-500/10 px-3 py-3 text-[11px] leading-relaxed text-red-50"
            data-testid="fail-safe-error-boundary"
            data-fail-safe-region={name}
          >
            <p className="font-bold text-red-100">{name} recovered from an error</p>
            <p className="mt-1 text-white/70">
              The rest of the studio is still running. Retry this panel, or reload if it keeps
              failing.
            </p>
            {message ? (
              <pre className="mt-2 max-h-24 overflow-auto rounded-xl border border-white/10 bg-black/40 p-2 text-[10px] text-white/45">
                {message}
              </pre>
            ) : null}
            <button
              type="button"
              className="mt-2 rounded-lg border border-cyan-400/35 bg-cyan-500/15 px-2 py-1 text-[10px] font-bold text-cyan-50 hover:bg-cyan-500/25"
              onClick={() => this.setState({ error: null })}
            >
              Retry {name}
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
