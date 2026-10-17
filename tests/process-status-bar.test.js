/** @vitest-environment happy-dom */
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ProcessStatusBar } from "../app/components/process-status-bar";
import { beginProcess, dismissProcess, getProcesses } from "../app/lib/process-status";

afterEach(() => { cleanup(); for (const p of getProcesses()) dismissProcess(p.id); });

it("shows all running jobs, actual progress, failures and retained completion", () => {
  render(createElement(ProcessStatusBar));
  let master, addon;
  act(() => {
    master = beginProcess("Mastering track");
    addon = beginProcess("Install RVC");
    master.progress({ phase: "mastering", pct: 37, completed: 37, total: 100, unit: "audio frames" });
  });
  expect(screen.getByText("2 running")).toBeTruthy();
  expect(screen.getByRole("progressbar", { name: "Mastering track: mastering" }).getAttribute("aria-valuenow")).toBe("37");
  expect(screen.getByRole("progressbar", { name: "Install RVC: Starting" }).hasAttribute("aria-valuenow")).toBe(false);
  act(() => { master.finish(); addon.finish("error", "Python.h missing"); });
  fireEvent.click(screen.getByRole("button", { name: "Activity (2)" }));
  expect(screen.getByText("Completed · 100%")).toBeTruthy();
  expect(screen.getByText("Failed · Python.h missing")).toBeTruthy();
});
