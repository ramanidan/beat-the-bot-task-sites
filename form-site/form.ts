import {
  BEAT_THE_BOT_INTAKE_SUBMITTED,
  BEAT_THE_BOT_VALIDATION_RESULT,
} from "../src/shared/messages";
import { VARIANT_COUNT, validateIntake, type IntakePayload } from "../src/shared/variants";

const form = document.getElementById("intake-form") as HTMLFormElement | null;
const toast = document.getElementById("fd-toast");

function variantFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get("v");
  if (raw === null) return 0;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(VARIANT_COUNT - 1, n));
}

function showToast(ok: boolean, message: string): void {
  if (!toast) return;
  toast.hidden = false;
  toast.classList.toggle("fd-toast-err", !ok);
  toast.textContent = message;
  window.setTimeout(() => {
    toast.hidden = true;
  }, 6000);
}

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const tags = data.getAll("tag") as string[];
  const payload: IntakePayload = {
    order_id: String(data.get("order_id") ?? ""),
    sku: String(data.get("sku") ?? ""),
    qty: String(data.get("qty") ?? ""),
    contact: String(data.get("contact") ?? ""),
    category: String(data.get("category") ?? ""),
    tags,
  };

  const inIframe = window.parent !== window;

  if (toast) {
    toast.hidden = false;
    toast.textContent = "Checking answers…";
    toast.classList.remove("fd-toast-err");
  }

  // Opened directly (e.g. Anchor navigating only to form URL): no parent to answer — validate here.
  if (!inIframe) {
    const result = validateIntake(variantFromUrl(), payload);
    showToast(
      result.ok,
      result.ok ? "Correct — intake matches the manifest." : `Not quite — fix: ${result.errors.join(", ")}`,
    );
    return;
  }

  window.parent.postMessage(
    { type: BEAT_THE_BOT_INTAKE_SUBMITTED, payload },
    window.location.origin,
  );
});

window.addEventListener("message", (ev: MessageEvent) => {
  if (ev.origin !== window.location.origin) return;
  if (ev.data?.type !== BEAT_THE_BOT_VALIDATION_RESULT) return;
  if (!toast) return;

  toast.hidden = false;
  toast.classList.toggle("fd-toast-err", !ev.data.ok);
  if (ev.data.ok) {
    toast.textContent = "Correct — your time is recorded.";
  } else {
    const list = Array.isArray(ev.data.errors) ? ev.data.errors.join(", ") : "Check fields";
    toast.textContent = `Not quite — fix: ${list}`;
  }
  window.setTimeout(() => {
    toast.hidden = true;
  }, 6000);
});
