import {
  BEAT_THE_BOT_INTAKE_SUBMITTED,
  BEAT_THE_BOT_VALIDATION_RESULT,
} from "../src/shared/messages";

const form = document.getElementById("intake-form") as HTMLFormElement | null;
const toast = document.getElementById("fd-toast");

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const tags = data.getAll("tag") as string[];
  const payload = {
    order_id: String(data.get("order_id") ?? ""),
    sku: String(data.get("sku") ?? ""),
    qty: String(data.get("qty") ?? ""),
    contact: String(data.get("contact") ?? ""),
    category: String(data.get("category") ?? ""),
    tags,
    comment: String(data.get("comment") ?? ""),
  };

  if (window.parent !== window) {
    window.parent.postMessage(
      { type: BEAT_THE_BOT_INTAKE_SUBMITTED, payload },
      window.location.origin,
    );
  }

  if (toast) {
    toast.hidden = false;
    toast.textContent = "Checking answers…";
    toast.classList.remove("fd-toast-err");
  }
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
