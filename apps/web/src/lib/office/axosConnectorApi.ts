"use client";

import { apiFetch } from "@/lib/apiFetch";
import {
  AXOS_SHEET_CONNECTOR_BY_TYPE,
  validateAxosSheetConnectorParams,
} from "@axos/contracts";
import { type AxosConnectorInstance } from "./axosConnectors";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
).replace(/\/$/, "");

export interface AxosConnectorDatasetPayload {
  columns: string[];
  rows: (string | number)[][];
}

export interface AxosConnectorRefreshRequest {
  endpoint: string;
  method: "GET";
  params: Record<string, string>;
  valid: boolean;
  errors: string[];
}

export function buildAxosConnectorRefreshRequest(
  instance: AxosConnectorInstance,
): AxosConnectorRefreshRequest {
  const def = AXOS_SHEET_CONNECTOR_BY_TYPE[instance.type];
  const validation = validateAxosSheetConnectorParams(
    instance.type,
    instance.params ?? {},
  );
  return {
    endpoint: def?.endpoint ?? "/office-documents/sheets/connectors/unknown",
    method: "GET",
    params: validation.params,
    valid: !!def && validation.ok,
    errors: validation.errors,
  };
}

export interface AxosConnectorApiPayload extends AxosConnectorDatasetPayload {
  type: string;
  label: string;
  domain: string;
  tenantId: string | null;
  asOf: string;
  params: Record<string, string>;
  source: string;
  readOnly: true;
  warnings?: string[];
}

export async function fetchAxosConnectorDataset(
  instance: AxosConnectorInstance,
): Promise<AxosConnectorApiPayload> {
  const request = buildAxosConnectorRefreshRequest(instance);
  if (!request.valid)
    throw new Error(request.errors.join(" ") || "Conector AXOS inválido.");
  const query = new URLSearchParams(request.params);
  const url = `${API_BASE}${request.endpoint}${query.size ? `?${query.toString()}` : ""}`;
  const response = await apiFetch(url, {
    method: request.method,
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Refresh AXOS falló con HTTP ${response.status}.`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload?.columns) || !Array.isArray(payload?.rows)) {
    throw new Error("Respuesta AXOS inválida: se esperaban columns y rows.");
  }
  return payload as AxosConnectorApiPayload;
}
