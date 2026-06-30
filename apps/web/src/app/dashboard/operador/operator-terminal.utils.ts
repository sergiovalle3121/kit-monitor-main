export type ScanKind =
  | "wo"
  | "serial"
  | "lot"
  | "reel"
  | "material"
  | "qr"
  | "datamatrix"
  | "code128";

export type ScanState = "idle" | "reading" | "valid" | "invalid";

export interface ScanResult {
  raw: string;
  normalized: string;
  kind: ScanKind;
  valid: boolean;
  message: string;
  at: string;
}

export interface OfflineAction {
  id: string;
  type: "confirm" | "incident" | "andon" | "material";
  label: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
}

export interface MaterialRequestReadiness {
  canRequest: boolean;
  status: "ready" | "pending" | "no-kit";
  primaryLabel: string;
  message: string;
  pendingId?: number;
}

export function deriveMaterialRequestReadiness({
  kitId,
  requests,
}: {
  kitId?: number | null;
  requests: { id: number; status: string }[];
}): MaterialRequestReadiness {
  if (!kitId) {
    return {
      canRequest: false,
      status: "no-kit",
      primaryLabel: "Kit no disponible",
      message:
        "Esta WO todavia no tiene un kit publicado; solicita a planeacion generar el PickList antes de pedir surtido.",
    };
  }

  const pending = requests.find(
    (request) => request.status.toLowerCase() === "pending",
  );
  if (pending) {
    return {
      canRequest: false,
      status: "pending",
      primaryLabel: `Solicitud #${pending.id} pendiente`,
      message:
        "Ya existe una solicitud pendiente para este kit; espera la respuesta de materiales antes de levantar otra.",
      pendingId: pending.id,
    };
  }

  return {
    canRequest: true,
    status: "ready",
    primaryLabel: "Solicitar material",
    message:
      "Se creara una solicitud real contra el kit de esta WO y quedara visible para materiales.",
  };
}

export type OperatorCriticalAction = "confirm-advance" | "line-stop";

export interface OperatorActionSignatureInput {
  action: OperatorCriticalAction;
  workOrder: string;
  stepId?: number | string | null;
  quantity?: number;
  scrap?: number;
  serial?: string | null;
  downtimeReason?: string | null;
  note?: string | null;
}

export interface OperatorConfirmationSummary {
  title: string;
  primaryLabel: string;
  consequence: string;
  details: string[];
  tone: "emerald" | "rose";
}

function normalizeSignatureValue(value: unknown): string {
  if (typeof value === "number") return String(Math.max(0, Math.floor(value)));
  if (typeof value === "string") return value.trim().toUpperCase();
  return "";
}

export function buildOperatorActionSignature({
  action,
  workOrder,
  stepId,
  quantity,
  scrap,
  serial,
  downtimeReason,
  note,
}: OperatorActionSignatureInput): string {
  return [
    action,
    normalizeSignatureValue(workOrder),
    normalizeSignatureValue(stepId),
    normalizeSignatureValue(quantity),
    normalizeSignatureValue(scrap),
    normalizeSignatureValue(serial),
    normalizeSignatureValue(downtimeReason),
    normalizeSignatureValue(note),
  ].join(":");
}

export function buildOperatorConfirmationSummary({
  action,
  workOrder,
  stepName,
  quantity,
  scrap,
  operator,
}: {
  action: OperatorCriticalAction;
  workOrder: string;
  stepName?: string | null;
  quantity?: number;
  scrap?: number;
  operator?: string | null;
}): OperatorConfirmationSummary {
  if (action === "line-stop") {
    return {
      title: "Confirmar paro de línea",
      primaryLabel: "Detener línea y levantar Andon",
      consequence:
        "Abrirá un paro de línea, notificará al supervisor y empezará a medir downtime.",
      details: [
        `WO ${workOrder}`,
        stepName ? `Estación ${stepName}` : "Estación actual",
        operator ? `Operador ${operator}` : "Operador no identificado",
      ],
      tone: "rose",
    };
  }

  const goodUnits = Math.max(0, Math.floor(quantity ?? 0));
  const scrapUnits = Math.max(0, Math.floor(scrap ?? 0));
  return {
    title: "Confirmar avance de unidad",
    primaryLabel: "Confirmar y descontar material",
    consequence:
      "Registrará avance MES, consumirá material del paso y puede iniciar la WO si es la primera confirmación.",
    details: [
      `WO ${workOrder}`,
      stepName ? `Estación ${stepName}` : "Estación actual",
      `${goodUnits} buenas`,
      scrapUnits > 0 ? `${scrapUnits} scrap` : "Sin scrap",
    ],
    tone: "emerald",
  };
}

export function classifyScan(raw: string): Omit<ScanResult, "at"> {
  const normalized = raw.trim();
  const upper = normalized.toUpperCase();
  if (!normalized) {
    return {
      raw,
      normalized,
      kind: "code128",
      valid: false,
      message: "Escaneo vacío. Intenta de nuevo.",
    };
  }
  if (/^WO[-_:\s]?[A-Z0-9-]{3,}$/i.test(upper) || /^[0-9]{5,}$/.test(upper)) {
    return {
      raw,
      normalized: upper.replace(/^WO[-_:\s]?/i, ""),
      kind: "wo",
      valid: true,
      message: "WO detectada y lista para montar.",
    };
  }
  if (/^(SN|SERIAL)[-_:\s]?[A-Z0-9-]{4,}$/i.test(upper)) {
    return {
      raw,
      normalized: upper.replace(/^(SN|SERIAL)[-_:\s]?/i, "SN-"),
      kind: "serial",
      valid: true,
      message: "Número de serie capturado.",
    };
  }
  if (/^(LOT|LOTE)[-_:\s]?[A-Z0-9-]{3,}$/i.test(upper)) {
    return {
      raw,
      normalized: upper.replace(/^(LOT|LOTE)[-_:\s]?/i, "LOT-"),
      kind: "lot",
      valid: true,
      message: "Lote detectado para trazabilidad.",
    };
  }
  if (/^(REEL|R)[-_:\s]?[A-Z0-9-]{3,}$/i.test(upper)) {
    return {
      raw,
      normalized: upper.replace(/^(REEL|R)[-_:\s]?/i, "REEL-"),
      kind: "reel",
      valid: true,
      message: "Reel detectado para trazabilidad.",
    };
  }
  if (/^(MAT|PN|MPN)[-_:\s]?[A-Z0-9_.-]{3,}$/i.test(upper)) {
    return {
      raw,
      normalized: upper.replace(/^(MAT|PN|MPN)[-_:\s]?/i, ""),
      kind: "material",
      valid: true,
      message: "Material detectado.",
    };
  }
  if (/^\]C1/.test(normalized)) {
    return {
      raw,
      normalized: normalized.slice(3),
      kind: "code128",
      valid: true,
      message: "Code128 GS1 capturado.",
    };
  }
  if (
    /^\]D2/.test(normalized) ||
    normalized.includes(String.fromCharCode(29))
  ) {
    return {
      raw,
      normalized: normalized
        .replace(/^\]D2/, "")
        .replaceAll(String.fromCharCode(29), "|"),
      kind: "datamatrix",
      valid: true,
      message: "DataMatrix capturado.",
    };
  }
  if (/^https?:\/\//i.test(normalized) || /^[A-Z0-9]{12,}$/.test(upper)) {
    return {
      raw,
      normalized,
      kind: "qr",
      valid: true,
      message: "QR capturado.",
    };
  }
  return {
    raw,
    normalized,
    kind: "code128",
    valid: normalized.length >= 3,
    message:
      normalized.length >= 3
        ? "Código capturado; valida que corresponda al campo activo."
        : "Código demasiado corto para validación industrial.",
  };
}

export interface ProductionMetricStep {
  unitsCompleted: number;
  scrapQty: number;
  segregatedQty: number;
}

export interface ProductionMetricsInput {
  quantity: number;
  steps: ProductionMetricStep[];
  overall: number;
  downtimeSummarySec: number;
  openDowntimeDurationsSec: number[];
}

export interface ProductionMetrics {
  target: number;
  real: number;
  remaining: number;
  oeePercent: number;
  yieldPercent: number;
  scrap: number;
  rework: number;
  downtimeSec: number;
  wip: number;
}

export function deriveProductionMetrics(
  input: ProductionMetricsInput,
): ProductionMetrics {
  const target = Math.max(0, input.quantity);
  const real = input.steps.length
    ? Math.max(...input.steps.map((step) => step.unitsCompleted), 0)
    : 0;
  const scrap = input.steps.reduce((sum, step) => sum + step.scrapQty, 0);
  const rework = input.steps.reduce((sum, step) => sum + step.segregatedQty, 0);
  const downtimeSec =
    input.downtimeSummarySec +
    input.openDowntimeDurationsSec.reduce((sum, duration) => sum + duration, 0);
  const yieldPct = real + scrap > 0 ? real / (real + scrap) : 1;
  const wip = input.steps.reduce(
    (sum, step) => sum + Math.max(0, step.unitsCompleted - real),
    0,
  );
  return {
    target,
    real,
    remaining: Math.max(0, target - real),
    oeePercent: Math.round(input.overall * 100),
    yieldPercent: Math.round(yieldPct * 100),
    scrap,
    rework,
    downtimeSec,
    wip,
  };
}
