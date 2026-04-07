import { MANIFEST_VARIANTS } from "../src/shared/variants";

function params(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

function variantIndex(): number {
  const v = params().get("v");
  if (v === null) return 0;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(MANIFEST_VARIANTS.length - 1, n));
}

function render(): void {
  const row = MANIFEST_VARIANTS[variantIndex()];
  const tbody = document.getElementById("manifest-body");
  const pill = document.getElementById("variant-pill");
  const hints = document.getElementById("hint-list");

  if (pill) pill.textContent = `Variant ${variantIndex() + 1} / ${MANIFEST_VARIANTS.length}`;

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td>${row.orderId}</td>
        <td>${row.sku}</td>
        <td>${row.qty}</td>
        <td>${row.contact}</td>
        <td>${row.priority}</td>
        <td>${row.notes}</td>
      </tr>
    `;
  }

  if (hints) {
    hints.innerHTML = `
      <li><strong>Category</strong> should reflect priority and bulk rules (see form).</li>
      <li><strong>Handling tags</strong> — select all that apply from the notes (fragile, refrigerated, signature).</li>
    `;
  }
}

render();
