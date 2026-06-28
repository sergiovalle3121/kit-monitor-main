export type ScanKind =
  | "wo"
  | "serial"
  | "lot"
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
  endpoint?: string;
  method?: "POST";
  createdAt: string;
  attempts: number;
  lastError?: string;
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


export type OperatorReadinessStatus =
  | "READY"
  | "WARNING"
  | "BLOCKED"
  | "OFFLINE_READY"
  | "NO_WORK_ORDER";

export type OperatorReadinessCheckStatus = "pass" | "warn" | "fail" | "unknown";

export interface OperatorReadinessCheck {
  id: string;
  label: string;
  status: OperatorReadinessCheckStatus;
  reason?: string;
  actionLabel?: string;
  actionHref?: string;
}

export interface OperatorReadiness {
  status: OperatorReadinessStatus;
  score: number;
  canConfirm: boolean;
  canRaiseIncident: boolean;
  canRequestMaterial: boolean;
  checks: OperatorReadinessCheck[];
}

export interface OperatorReadinessInput {
  hasWorkOrder: boolean;
  hasCurrentStep: boolean;
  stepStatus?:
    | "pending"
    | "in_process"
    | "blocked"
    | "completed"
    | string
    | null;
  starved?: boolean;
  maxConfirmable?: number;
  materialShortCount?: number;
  openIncidentCount?: number;
  blockingIncidentCount?: number;
  openAndonCount?: number;
  openDowntimeCount?: number;
  hasInstructions?: boolean;
  hasVisualAid?: boolean;
  assignedOperatorNames?: string[];
  operatorName?: string;
  certification?: {
    certified: boolean;
    status: "valid" | "expiring" | "expired" | "none";
    daysToExpiry?: number | null;
    skill?: string | null;
  } | null;
  socketStatus?: string;
  offlineQueueCount?: number;
}

function checkWeight(status: OperatorReadinessCheckStatus): number {
  if (status === "pass") return 1;
  if (status === "warn") return 0.5;
  if (status === "unknown") return 0.25;
  return 0;
}

export function deriveOperatorReadiness(
  input: OperatorReadinessInput,
): OperatorReadiness {
  if (!input.hasWorkOrder) {
    return {
      status: "NO_WORK_ORDER",
      score: 0,
      canConfirm: false,
      canRaiseIncident: false,
      canRequestMaterial: false,
      checks: [
        {
          id: "work-order",
          label: "WO montada",
          status: "fail",
          reason: "Monta o escanea una orden de trabajo para iniciar ejecución.",
        },
      ],
    };
  }

  const operatorAssigned =
    !input.assignedOperatorNames?.length ||
    input.assignedOperatorNames.some(
      (name) =>
        name.trim().toLowerCase() ===
        (input.operatorName ?? "").trim().toLowerCase(),
    );
  const certification = input.certification;
  const certificationFailed = certification?.status === "expired";
  const certificationWarn =
    certification?.status === "expiring" || certification?.status === "none";
  const blockedByStep =
    input.stepStatus === "blocked" || input.stepStatus === "completed";
  const materialShort = (input.materialShortCount ?? 0) > 0;
  const blockingQuality = (input.blockingIncidentCount ?? 0) > 0;
  const hasOpenAndon = (input.openAndonCount ?? 0) > 0;
  const offline = input.socketStatus !== "connected";

  const checks: OperatorReadinessCheck[] = [
    {
      id: "work-order",
      label: "WO montada",
      status: input.hasWorkOrder ? "pass" : "fail",
    },
    {
      id: "station",
      label: "Estación seleccionada",
      status: input.hasCurrentStep ? "pass" : "fail",
      reason: input.hasCurrentStep ? undefined : "Selecciona una estación de la ruta.",
    },
    {
      id: "operator",
      label: "Operador asignado/certificable",
      status: certificationFailed
        ? "fail"
        : !operatorAssigned || certificationWarn
          ? "warn"
          : "pass",
      reason: certificationFailed
        ? "Certificación vencida para esta estación."
        : certification?.status === "expiring"
          ? `Certificación por vencer${
              certification.daysToExpiry != null
                ? ` en ${certification.daysToExpiry} día(s)`
                : ""
            }${certification.skill ? ` · ${certification.skill}` : ""}.`
          : certification?.status === "none"
            ? "Sin certificación vigente encontrada para operador↔estación; requiere validación de supervisor."
            : operatorAssigned
              ? undefined
              : "La asignación actual no coincide con el operador de sesión; requiere revisión de supervisor.",
      actionLabel: certificationFailed ? "Recertificar" : undefined,
    },
    {
      id: "material",
      label: "Material disponible",
      status: materialShort ? "fail" : "pass",
      reason: materialShort
        ? `${input.materialShortCount} material(es) en corto para esta estación.`
        : undefined,
      actionLabel: materialShort ? "Solicitar material" : undefined,
    },
    {
      id: "quality",
      label: "Calidad liberada",
      status: blockingQuality
        ? "fail"
        : (input.openIncidentCount ?? 0) > 0
          ? "warn"
          : "pass",
      reason: blockingQuality
        ? `${input.blockingIncidentCount} incidente(s) bloquean flujo.`
        : (input.openIncidentCount ?? 0) > 0
          ? `${input.openIncidentCount} incidente(s) abiertos requieren seguimiento.`
          : undefined,
      actionLabel: blockingQuality ? "Disposicionar NCR" : undefined,
    },
    {
      id: "instructions",
      label: "Instrucciones vigentes",
      status: input.hasInstructions || input.hasVisualAid ? "pass" : "warn",
      reason: input.hasInstructions || input.hasVisualAid
        ? undefined
        : "No hay instrucciones o ayuda visual embebida para esta estación.",
    },
    {
      id: "flow",
      label: "Flujo listo",
      status: input.starved ? "warn" : blockedByStep ? "fail" : "pass",
      reason: input.starved
        ? "La estación previa aún no libera unidades buenas."
        : blockedByStep
          ? `La estación está ${input.stepStatus}.`
          : undefined,
    },
    {
      id: "andon",
      label: "Andon / paros",
      status: (input.openDowntimeCount ?? 0) > 0
        ? "fail"
        : hasOpenAndon
          ? "warn"
          : "pass",
      reason: (input.openDowntimeCount ?? 0) > 0
        ? `${input.openDowntimeCount} paro(s) abierto(s).`
        : hasOpenAndon
          ? `${input.openAndonCount} Andon activo(s).`
          : undefined,
    },
    {
      id: "connectivity",
      label: "Conectividad / cola offline",
      status: offline
        ? "warn"
        : (input.offlineQueueCount ?? 0) > 0
          ? "warn"
          : "pass",
      reason: offline
        ? `Socket ${input.socketStatus ?? "desconectado"}; las acciones críticas pueden quedar en cola local.`
        : (input.offlineQueueCount ?? 0) > 0
          ? `${input.offlineQueueCount} acción(es) pendientes de replay.`
          : undefined,
    },
  ];

  const score = Math.round(
    (checks.reduce((sum, check) => sum + checkWeight(check.status), 0) /
      checks.length) *
      100,
  );
  const hasFail = checks.some((check) => check.status === "fail");
  const hasWarn = checks.some((check) => check.status === "warn");
  const canConfirm =
    input.hasWorkOrder &&
    input.hasCurrentStep &&
    !blockedByStep &&
    !materialShort &&
    !blockingQuality &&
    !certificationFailed &&
    (input.maxConfirmable ?? 0) > 0;

  return {
    status: hasFail
      ? "BLOCKED"
      : offline
        ? "OFFLINE_READY"
        : hasWarn
          ? "WARNING"
          : "READY",
    score,
    canConfirm,
    canRaiseIncident: input.hasWorkOrder && input.hasCurrentStep,
    canRequestMaterial: input.hasWorkOrder && input.hasCurrentStep,
    checks,
  };
}


export type OperatorTransactionType = "confirm" | "incident" | "andon";

export interface OperatorTransactionValidationInput {
  type: OperatorTransactionType;
  payload: Record<string, unknown>;
  maxConfirmable?: number;
}

export interface OperatorTransactionValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function numericPayloadValue(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringPayloadValue(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

export function validateOperatorTransaction(
  input: OperatorTransactionValidationInput,
): OperatorTransactionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const payload = input.payload;
  const clientRequestId = stringPayloadValue(payload, "clientRequestId");

  if (!clientRequestId) {
    warnings.push("La acción no incluye clientRequestId; el replay puede no ser idempotente.");
  }

  if (input.type === "confirm") {
    const quantity = numericPayloadValue(payload, "quantity");
    const scrap = numericPayloadValue(payload, "scrap");
    const serial = stringPayloadValue(payload, "serial");
    if (quantity + scrap <= 0) {
      errors.push("Confirma al menos una unidad buena o scrap.");
    }
    if (input.maxConfirmable !== undefined && quantity > input.maxConfirmable) {
      errors.push(`Cantidad ${quantity} excede máximo confirmable ${input.maxConfirmable}.`);
    }
    if (serial && serial.length < 4) {
      errors.push("Serial demasiado corto para trazabilidad.");
    }
    if (scrap > 0 && !serial) {
      warnings.push("Scrap sin serial/lote capturado; agrega trazabilidad si aplica.");
    }
  }

  if (input.type === "incident") {
    const incidentType = stringPayloadValue(payload, "type");
    const severity = stringPayloadValue(payload, "severity");
    const qtyAffected = numericPayloadValue(payload, "qtyAffected");
    if (!incidentType) errors.push("Tipo de incidente requerido.");
    if (!severity) errors.push("Severidad requerida.");
    if (qtyAffected < 0) errors.push("Unidades afectadas no puede ser negativo.");
    if (!stringPayloadValue(payload, "description")) {
      warnings.push("Incidente sin descripción/evidencia detallada.");
    }
  }

  if (input.type === "andon") {
    const andonType = stringPayloadValue(payload, "type");
    if (!andonType) errors.push("Tipo de Andon requerido.");
    if (
      ![
        "material",
        "quality",
        "maintenance",
        "stop",
        "supervisor",
        "materialist",
        "engineering",
        "tooling",
      ].includes(andonType)
    ) {
      errors.push(
        `Tipo de Andon no soportado por el contrato MES actual: ${andonType || "—"}.`,
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
