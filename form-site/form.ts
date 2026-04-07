import {
  BEAT_THE_BOT_INTAKE_SUBMITTED,
  BEAT_THE_BOT_VALIDATION_RESULT,
} from "../src/shared/messages";
import { VARIANT_COUNT, validateIntake, type IntakePayload } from "../src/shared/variants";

const form = document.getElementById("intake-form") as HTMLFormElement | null;
const toast = document.getElementById("fd-toast");
const progressLabel = document.getElementById("fd-progress-label");

const STEP_COPY = [
  "Step 1 of 3 — Manifest line",
  "Step 2 of 3 — Shipment rules",
  "Step 3 of 3 — Review & submit",
] as const;

const stepEls = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>(".fd-step[data-step]"));

let currentStep = 0;

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

function validateStep(stepIndex: number): boolean {
  const steps = stepEls();
  const stepEl = steps[stepIndex];
  if (!stepEl) return false;

  const fields = stepEl.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "input, textarea, select",
  );

  for (const el of fields) {
    if (el.willValidate && !el.checkValidity()) {
      el.reportValidity();
      return false;
    }
  }
  return true;
}

function updateProgressUi(): void {
  if (progressLabel) {
    progressLabel.textContent = STEP_COPY[currentStep] ?? "";
  }
  document.querySelectorAll(".fd-dot").forEach((dot, i) => {
    dot.classList.toggle("fd-dot--on", i === currentStep);
  });
}

function showStep(index: number): void {
  const steps = stepEls();
  currentStep = Math.max(0, Math.min(steps.length - 1, index));

  steps.forEach((el, i) => {
    const active = i === currentStep;
    el.hidden = !active;
    el.classList.toggle("fd-step--active", active);
  });

  updateProgressUi();

  const active = steps[currentStep];
  const focusable = active?.querySelector<HTMLElement>(
    'input:not([type="hidden"]), textarea, button:not([disabled])',
  );
  window.requestAnimationFrame(() => focusable?.focus());
}

function wireSteps(): void {
  document.getElementById("fd-next-0")?.addEventListener("click", () => {
    if (!validateStep(0)) return;
    showStep(1);
  });

  document.getElementById("fd-back-1")?.addEventListener("click", () => {
    showStep(0);
  });

  document.getElementById("fd-next-1")?.addEventListener("click", () => {
    if (!validateStep(1)) return;
    showStep(2);
  });

  document.getElementById("fd-back-2")?.addEventListener("click", () => {
    showStep(1);
  });
}

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (currentStep !== 2) {
    showStep(2);
    return;
  }

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

wireSteps();
showStep(0);
