// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { SidecarModelAccess } from "../app/components/sidecar-model-access";
import { connectHuggingFace } from "../app/lib/sidecar-extra-install-client";

vi.mock("../app/lib/sidecar-extra-install-client", () => ({ connectHuggingFace: vi.fn() }));
afterEach(cleanup);

it("connects through the native bridge and clears the password field without displaying the token", async () => {
  vi.mocked(connectHuggingFace).mockResolvedValue("Hugging Face connected");
  render(createElement(SidecarModelAccess));
  fireEvent.click(screen.getByText("Model download access"));
  const field = screen.getByLabelText("Hugging Face read token");
  fireEvent.change(field, { target: { value: "hf_test_only" } });
  fireEvent.click(screen.getByRole("button", { name: "Connect Hugging Face" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Hugging Face connected"));
  expect(connectHuggingFace).toHaveBeenCalledWith("hf_test_only");
  expect(field.value).toBe("");
  expect(screen.queryByText("hf_test_only")).toBeNull();
});

it("keeps an unsuccessful connection visibly unresolved", async () => {
  vi.mocked(connectHuggingFace).mockRejectedValue(new Error("Token not accepted"));
  render(createElement(SidecarModelAccess));
  fireEvent.click(screen.getByText("Model download access"));
  fireEvent.change(screen.getByLabelText("Hugging Face read token"), { target: { value: "hf_test_only" } });
  fireEvent.click(screen.getByRole("button", { name: "Connect Hugging Face" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Token not accepted"));
});
