/** Classify recorded installer output without treating account access as a retryable download. */
export function describeSidecarInstallFailure(error) {
  const text = String(error || "");
  if (/GatedRepoError|401 Unauthorized|403 Forbidden|Cannot access gated repo/i.test(text)) {
    const model = text.match(/huggingface\.co\/([\w.-]+\/[\w.-]+)\/(?:resolve|tree)/)?.[1];
    return {
      kind: "model-access", retryable: false,
      actionUrl: `https://huggingface.co/${model || "black-forest-labs/FLUX.1-schnell"}`,
      message: "Model access required: sign in to Hugging Face, accept the model's access conditions and connect that account before retrying. Auto Fail-Safe cannot grant account access.",
    };
  }
  if (/Python\.h|Failed building wheel for fairseq|fairseq.*engine verification failed/i.test(text)) {
    return { kind: "rvc-runtime", retryable: true,
      message: "RVC requires its separate Python 3.10 environment. Repair will install it inside Studio without changing the shared AI runtime." };
  }
  return { kind: "install", retryable: true, message: text || "Sidecar installation failed" };
}
