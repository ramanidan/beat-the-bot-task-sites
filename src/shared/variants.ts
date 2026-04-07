/** Single source of truth for manifest rows — keep in sync with booth copy. */
export type ManifestRow = {
  orderId: string;
  sku: string;
  qty: number;
  contact: string;
  priority: string;
  notes: string;
};

export const VARIANT_COUNT = 5;

export const MANIFEST_VARIANTS: ManifestRow[] = [
  {
    orderId: "ORD-88291",
    sku: "WB-GL-04",
    qty: 12,
    contact: "fulfillment@bluecrate.io",
    priority: "High",
    notes: "Glass panels — treat as fragile; route as expedited if priority is High.",
  },
  {
    orderId: "ORD-44102",
    sku: "ST-BLK-88",
    qty: 240,
    contact: "bulk@midwestmills.test",
    priority: "Low",
    notes: "Standard steel stock; bulk lane if qty ≥ 100.",
  },
  {
    orderId: "ORD-77301",
    sku: "RF-CHZ-02",
    qty: 8,
    contact: "coldchain@freshroute.demo",
    priority: "Normal",
    notes: "Temperature-controlled; needs refrigerated handling tag.",
  },
  {
    orderId: "ORD-11998",
    sku: "WB-GL-04",
    qty: 3,
    contact: "studio@glasshaus.design",
    priority: "Normal",
    notes: "Small glass order; still fragile. Signature on delivery requested.",
  },
  {
    orderId: "ORD-22001",
    sku: "PX-OVR-91",
    qty: 1,
    contact: "exec@priorityfreight.io",
    priority: "High",
    notes: "Single high-value parcel — expedited + signature.",
  },
];

export type IntakePayload = {
  order_id: string;
  sku: string;
  qty: string;
  contact: string;
  category: string;
  tags: string[];
};

/** Deterministic answers derived from manifest + booth rules. */
function expectedCategoryAndTags(variantIndex: number): { category: string; tags: string[] } {
  switch (variantIndex) {
    case 0:
      return { category: "expedited", tags: ["fragile"] };
    case 1:
      return { category: "bulk", tags: [] };
    case 2:
      return { category: "standard", tags: ["refrigerated"] };
    case 3:
      return { category: "standard", tags: ["fragile", "signature"] };
    case 4:
      return { category: "expedited", tags: ["signature"] };
    default:
      return { category: "standard", tags: [] };
  }
}

function tagSetsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}

export function validateIntake(
  variantIndex: number,
  payload: IntakePayload,
): { ok: boolean; errors: string[] } {
  const row = MANIFEST_VARIANTS[variantIndex];
  if (!row) return { ok: false, errors: ["Unknown variant"] };

  const errors: string[] = [];

  if (payload.order_id.trim() !== row.orderId) errors.push("Order ID");
  if (payload.sku.trim() !== row.sku) errors.push("SKU");

  const qtyNum = Number(String(payload.qty).trim());
  if (!Number.isFinite(qtyNum) || qtyNum !== row.qty) errors.push("Quantity");

  if (payload.contact.trim() !== row.contact) errors.push("Contact email");

  const exp = expectedCategoryAndTags(variantIndex);
  if (payload.category !== exp.category) errors.push("Shipment category");

  if (!tagSetsEqual(payload.tags, exp.tags)) errors.push("Handling tags");

  return { ok: errors.length === 0, errors };
}
