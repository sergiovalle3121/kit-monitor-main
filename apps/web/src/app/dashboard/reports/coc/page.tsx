"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, Lock, MousePointerClick, Ship, ClipboardList } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

/** Hash de contenido no-criptográfico (djb2) → huella estable del documento. */
function contentFingerprint(content: unknown): string {
  const s = JSON.stringify(content ?? {});
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

export interface CocCert {
  folio: string;
  certifiedBy: string;
  certifiedAt: string;
  contentHash: string | null;
}

/**
 * Certifica (firma electrónica) un CoC: emite folio oficial COC-, lo firma con la
 * identidad de la sesión y lo registra inmutablemente en el Event Ledger. Se
 * dispara con un gesto explícito (consume un consecutivo y deja rastro).
 */
function useCocCertification() {
  const [cert, setCert] = useState<CocCert | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState(false);
  async function certify(subjectType: "WO" | "SHIPMENT", subject: string, content: unknown) {
    setIssuing(true);
    setError(false);
    try {
      const contentHash = contentFingerprint(content);
      const res = await apiFetch(`${API_BASE}/quality/coc/certify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType, subject, contentHash }),
      });
      const d = res.ok ? await res.json().catch(() => null) : null;
      if (d?.folio) {
        setCert({
          folio: d.folio as string,
          certifiedBy: (d.certifiedBy as string) || "—",
          certifiedAt: (d.certifiedAt as string) || new Date().toISOString(),
          contentHash: (d.contentHash as string) ?? contentHash,
        });
      } else setError(true);
    } catch {
      setError(true);
    } finally {
      setIssuing(false);
    }
  }
  return { cert, issuing, error, certify };
}

function CertifyButton({
  cert,
  issuing,
  error,
  onCertify,
}: {
  cert: CocCert | null;
  issuing: boolean;
  error: boolean;
  onCertify: () => void;
}) {
  if (cert) return null;
  return (
    <div className="print:hidden mb-4 flex flex-wrap items-center gap-2">
      <button
        onClick={onCertify}
        disabled={issuing}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        <BadgeCheck className="h-4 w-4" /> {issuing ? "Certificando…" : "Certificar y firmar"}
      </button>
      <span className="text-[12px] text-gray-400">
        Emite folio oficial COC-, firma con tu identidad y lo registra en la bitácora inmutable.
      </span>
      {error && <span className="text-[12px] text-rose-500">No se pudo certificar. Reintenta.</span>}
    </div>
  );
}

interface ShipLine {
  id: string;
  partNumber: string;
  description?: string | null;
  quantity: number;
  uom?: string;
  lotNumber?: string | null;
}
import { ReportChrome } from "../_components/ReportChrome";
import { DocLetterhead } from "../_components/DocLetterhead";
import { DocSection } from "../_components/DocSection";
import { DocTable, type DocColumn } from "../_components/DocTable";
import { SignatureBlock } from "../_components/SignatureBlock";
import { BackendNote } from "../_components/BackendNote";
import { ConformanceBanner } from "../_components/ConformanceBanner";
import { EmptyState } from "../_components/EmptyState";
import { Picker, type PickerItem } from "../_components/Picker";
import type { FinalInspection, Ncr, Shipment, TestingKpis, WorkOrder } from "../reports.types";
import {
  assessConformance,
  draftDocNumber,
  fmtDate,
  fmtDay,
  ncrsForWorkOrder,
  orDash,
} from "../reports.utils";

type Mode = "wo" | "shipment";

const OQC_RESULT_LABEL: Record<string, string> = {
  PASS: "APROBADO",
  FAIL: "RECHAZADO",
  CONDITIONAL: "CONDICIONAL",
};

export default function CocPage() {
  const { user } = useAuth();
  const generatedBy = user?.email || "—";

  const { data: plansData, isLoading: plansLoading, forbidden: plansForbidden } =
    useApi<WorkOrder[]>("/plans", { refreshInterval: 60000 });
  const { data: shipData, forbidden: shipForbidden } = useApi<Shipment[]>("/outbound/shipments", {
    refreshInterval: 60000,
  });
  const { data: oqcData } = useApi<FinalInspection[]>("/quality/oqc/history", { refreshInterval: 60000 });
  const { data: ncrData } = useApi<Ncr[]>("/ncr", { refreshInterval: 60000 });
  const { data: kpis } = useApi<TestingKpis>("/testing/kpis", { refreshInterval: 60000 });

  const plans = useMemo(() => (Array.isArray(plansData) ? plansData : []), [plansData]);
  const shipments = useMemo(() => (Array.isArray(shipData) ? shipData : []), [shipData]);
  const oqc = useMemo(() => (Array.isArray(oqcData) ? oqcData : []), [oqcData]);
  const ncrs = useMemo(() => (Array.isArray(ncrData) ? ncrData : []), [ncrData]);

  const [mode, setMode] = useState<Mode>("wo");
  const [woId, setWoId] = useState<string | null>(null);
  const [shipId, setShipId] = useState<string | null>(null);

  const woItems: PickerItem[] = useMemo(
    () =>
      plans.map((p) => ({
        value: p.workOrder,
        label: `WO ${p.workOrder}`,
        sub: `${p.model} · ${p.quantity} u · Turno ${orDash(p.shift)}`,
      })),
    [plans],
  );
  const shipItems: PickerItem[] = useMemo(
    () =>
      shipments.map((s) => ({
        value: s.id,
        label: s.folio ? `${s.folio} · ${s.title}` : s.title,
        sub: `${orDash(s.customerName)} · ${s.status}`,
      })),
    [shipments],
  );

  const selectedWo = useMemo(() => plans.find((p) => p.workOrder === woId) ?? null, [plans, woId]);
  const selectedShip = useMemo(() => shipments.find((s) => s.id === shipId) ?? null, [shipments, shipId]);

  const hasSelection = mode === "wo" ? !!selectedWo : !!selectedShip;

  const controls = (
    <div className="space-y-3">
      <div className="inline-flex gap-1 rounded-xl bg-black/5 p-1 dark:bg-white/10">
        <ModeTab active={mode === "wo"} onClick={() => setMode("wo")} icon={<ClipboardList className="h-4 w-4" />}>
          Por orden de trabajo
        </ModeTab>
        <ModeTab active={mode === "shipment"} onClick={() => setMode("shipment")} icon={<Ship className="h-4 w-4" />}>
          Por embarque
        </ModeTab>
      </div>
      {mode === "wo" ? (
        plansForbidden ? (
          <ForbiddenHint what="órdenes de trabajo" />
        ) : plansLoading ? (
          <p className="text-sm text-gray-400">Cargando órdenes…</p>
        ) : woItems.length === 0 ? (
          <p className="text-sm text-gray-400">No hay órdenes de trabajo publicadas todavía.</p>
        ) : (
          <Picker items={woItems} value={woId} onChange={setWoId} placeholder="Buscar WO o modelo…" />
        )
      ) : shipForbidden ? (
        <ForbiddenHint what="embarques" />
      ) : shipItems.length === 0 ? (
        <p className="text-sm text-gray-400">No hay embarques registrados todavía.</p>
      ) : (
        <Picker items={shipItems} value={shipId} onChange={setShipId} placeholder="Buscar folio, cliente…" />
      )}
    </div>
  );

  return (
    <ReportChrome
      title="Certificado de Conformancia (CoC)"
      subtitle="Declaración de conformidad por orden de trabajo o por embarque, sobre datos reales de planta"
      controls={controls}
      canPrint={hasSelection}
    >
      {!hasSelection ? (
        <EmptyState
          icon={<MousePointerClick className="h-6 w-6" />}
          title="Selecciona qué certificar"
          body={
            mode === "wo"
              ? "Elige una orden de trabajo arriba para generar su Certificado de Conformancia con el resultado OQC y las NCR vigentes."
              : "Elige un embarque arriba para generar su Certificado de Conformancia de salida."
          }
        />
      ) : mode === "wo" && selectedWo ? (
        <WoCoc
          wo={selectedWo}
          oqcHistory={oqc}
          ncrs={ncrs}
          kpis={kpis ?? null}
          generatedBy={generatedBy}
        />
      ) : selectedShip ? (
        <ShipmentCoc ship={selectedShip} generatedBy={generatedBy} />
      ) : null}
    </ReportChrome>
  );
}

// ── Atoms locales / CoC por orden de trabajo ─────────────────────────────────
function WoCoc({
  wo,
  oqcHistory,
  ncrs,
  kpis,
  generatedBy,
}: {
  wo: WorkOrder;
  oqcHistory: FinalInspection[];
  ncrs: Ncr[];
  kpis: TestingKpis | null;
  generatedBy: string;
}) {
  const woOqc = oqcHistory.filter((o) => (o.workOrder ?? "").trim() === wo.workOrder.trim());
  const latestOqc = woOqc[0] ?? null; // history llega ordenado DESC
  const woNcrs = ncrsForWorkOrder(ncrs, wo.workOrder);
  const openNcrs = woNcrs.filter((n) => n.status !== "closed");
  const { verdict, reasons } = assessConformance(latestOqc, woNcrs);
  const coc = useCocCertification();

  // Cliente/programa NO viven en la entidad Plan → se intentan derivar de una NCR
  // de la misma WO; si no hay, se muestra el hueco honesto.
  const enrich = woNcrs.find((n) => n.customer || n.program);
  const customer = enrich?.customer ?? null;
  const program = enrich?.program ?? null;

  const ncrCols: DocColumn<Ncr>[] = [
    { key: "n", header: "NCR", cell: (n) => n.ncrNumber, mono: true },
    { key: "sev", header: "Sev.", cell: (n) => n.severity },
    { key: "st", header: "Estado", cell: (n) => n.status },
    { key: "cat", header: "Categoría", cell: (n) => orDash(n.category) },
    { key: "qty", header: "Cant.", cell: (n) => n.quantityAffected, align: "right" },
  ];

  return (
    <>
      <CertifyButton
        cert={coc.cert}
        issuing={coc.issuing}
        error={coc.error}
        onCertify={() => coc.certify("WO", wo.workOrder, { wo: wo.workOrder, model: wo.model, qty: wo.quantity, verdict, oqc: latestOqc?.result ?? null, ncrs: woNcrs.length })}
      />
      <DocLetterhead
        domain="quality"
        title="Certificado de Conformancia"
        subtitle="Certificate of Conformance (CoC) — por orden de trabajo"
        docNumber={coc.cert?.folio ?? draftDocNumber("COC-WO", wo.workOrder)}
        official={!!coc.cert}
        attestation={coc.cert ? { by: coc.cert.certifiedBy, at: coc.cert.certifiedAt, hash: coc.cert.contentHash } : undefined}
        meta={[
          { label: "Orden de trabajo", value: orDash(wo.workOrder), mono: true },
          { label: "Modelo / Parte", value: orDash(wo.model), mono: true },
          { label: "Cantidad", value: `${wo.quantity} u` },
          { label: "Cliente", value: orDash(customer) },
          { label: "Programa", value: orDash(program) },
          { label: "Edificio", value: orDash(wo.buildingId) },
          { label: "Línea / Turno", value: `${orDash(wo.line)} · ${orDash(wo.shift)}` },
          { label: "Estado WO", value: orDash(wo.status) },
          { label: "Generado por", value: orDash(generatedBy) },
        ]}
      />

      <DocSection title="Declaración de conformidad">
        <p className="text-[13px] leading-relaxed text-gray-700">
          Se certifica que los productos de la orden de trabajo{" "}
          <span className="font-mono font-semibold">{wo.workOrder}</span> (modelo{" "}
          <span className="font-mono font-semibold">{wo.model}</span>, {wo.quantity} unidades) fueron
          fabricados conforme a la revisión de ingeniería aplicable y al plan de control vigente. El
          veredicto siguiente se deriva exclusivamente de la evidencia registrada en el sistema (OQC y
          no-conformidades) — sin evidencia suficiente, el certificado no declara conformidad.
        </p>
      </DocSection>

      <ConformanceBanner verdict={verdict} reasons={reasons} />

      <DocSection
        title="Inspección final de salida (OQC)"
        right={latestOqc ? OQC_RESULT_LABEL[latestOqc.result] ?? latestOqc.result : "Sin registro"}
      >
        {latestOqc ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-4">
            <Kv label="Inspeccionadas" value={`${latestOqc.quantityInspected} u`} />
            <Kv label="Aprobadas" value={`${latestOqc.quantityPassed} u`} />
            <Kv label="Rechazadas" value={`${latestOqc.quantityFailed} u`} />
            <Kv label="Inspector" value={orDash(latestOqc.inspector)} />
            <Kv label="Defecto" value={orDash(latestOqc.defectType)} />
            <Kv label="Fecha" value={fmtDate(latestOqc.createdAt)} />
            {woOqc.length > 1 && <Kv label="Inspecciones" value={`${woOqc.length} registradas`} />}
          </div>
        ) : (
          <p className="text-[13px] text-gray-500">
            Sin inspección OQC final registrada para esta orden de trabajo. La conformidad de salida
            no puede sustentarse documentalmente hasta capturar la inspección.
          </p>
        )}
      </DocSection>

      <DocSection
        title="No-conformidades de la WO"
        right={`${openNcrs.length} abierta(s) · ${woNcrs.length} total`}
      >
        {woNcrs.length === 0 ? (
          <p className="text-[13px] text-gray-500">
            Sin no-conformidades registradas contra esta orden de trabajo.
          </p>
        ) : (
          <DocTable columns={ncrCols} rows={woNcrs} rowKey={(n) => n.id} />
        )}
      </DocSection>

      {kpis && (kpis.firstPassYieldPct != null || kpis.yieldPct != null) && (
        <DocSection title="Rendimiento de prueba (referencia de planta)">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
            <Kv label="First-Pass Yield" value={kpis.firstPassYieldPct != null ? `${kpis.firstPassYieldPct}%` : "—"} />
            <Kv label="Yield total" value={kpis.yieldPct != null ? `${kpis.yieldPct}%` : "—"} />
            <Kv label="Pruebas / Series" value={`${kpis.totalTests} / ${kpis.distinctSerials}`} />
          </div>
          <p className="mt-1.5 text-[11px] text-gray-400">
            Nota: el yield proviene del servicio de pruebas a nivel planta; no está filtrado a esta WO
            (no existe endpoint de yield por WO).
          </p>
        </DocSection>
      )}

      <SignatureBlock
        roles={[
          { label: "Ingeniería de calidad", hint: "QA Engineer" },
          { label: "Supervisión de producción", hint: "Production" },
          { label: "Aprobación final", hint: "Plant Manager" },
        ]}
      />

      <BackendNote
        items={[
          "Endpoint de conformidad por WO que agregue OQC + NCR + yield del lado servidor (hoy se agrega en cliente sobre /plans, /quality/oqc/history, /ncr).",
        ]}
      />
    </>
  );
}

// ── CoC por embarque ─────────────────────────────────────────────────────────
function ShipmentCoc({ ship, generatedBy }: { ship: Shipment; generatedBy: string }) {
  const shipped = ship.status === "SHIPPED" || ship.status === "DELIVERED";
  const coc = useCocCertification();
  // Contenido real del embarque: líneas (parte/cantidad/lote) del módulo outbound.
  const { data: linesData } = useApi<ShipLine[]>(`/outbound/shipments/${ship.id}/lines`, {
    refreshInterval: 60000,
  });
  const lines = useMemo(() => (Array.isArray(linesData) ? linesData : []), [linesData]);
  const lineCols: DocColumn<ShipLine>[] = [
    { key: "p", header: "Parte", cell: (l) => l.partNumber, mono: true },
    { key: "d", header: "Descripción", cell: (l) => orDash(l.description) },
    { key: "q", header: "Cantidad", cell: (l) => `${l.quantity} ${l.uom ?? "EA"}`, align: "right" },
    { key: "lot", header: "Lote", cell: (l) => orDash(l.lotNumber), mono: true },
  ];
  return (
    <>
      <CertifyButton
        cert={coc.cert}
        issuing={coc.issuing}
        error={coc.error}
        onCertify={() => coc.certify("SHIPMENT", ship.folio || ship.id, { folio: ship.folio, id: ship.id, customer: ship.customerName, status: ship.status, lines: lines.length })}
      />
      <DocLetterhead
        domain="quality"
        title="Certificado de Conformancia"
        subtitle="Certificate of Conformance (CoC) — por embarque"
        docNumber={coc.cert?.folio ?? draftDocNumber("COC-SHP", ship.folio || ship.id.slice(0, 8))}
        official={!!coc.cert}
        attestation={coc.cert ? { by: coc.cert.certifiedBy, at: coc.cert.certifiedAt, hash: coc.cert.contentHash } : undefined}
        meta={[
          { label: "Folio embarque", value: orDash(ship.folio), mono: true },
          { label: "ASN", value: orDash(ship.asn), mono: true },
          { label: "Cliente", value: orDash(ship.customerName) },
          { label: "Destino", value: orDash(ship.destination) },
          { label: "Incoterm", value: orDash(ship.incoterm) },
          { label: "Transportista", value: orDash(ship.carrier) },
          { label: "Guía / Tracking", value: orDash(ship.trackingNumber), mono: true },
          { label: "Bultos", value: orDash(ship.packageCount) },
          { label: "Programa", value: orDash(ship.programId) },
          { label: "Estado", value: orDash(ship.status) },
          { label: "Generado por", value: orDash(generatedBy) },
        ]}
      />

      <DocSection title="Declaración de conformidad de salida">
        <p className="text-[13px] leading-relaxed text-gray-700">
          Se certifica que el embarque{" "}
          <span className="font-mono font-semibold">{orDash(ship.folio)}</span> dirigido a{" "}
          <span className="font-semibold">{orDash(ship.customerName)}</span> contiene producto liberado
          conforme a los requisitos del cliente y a los controles de calidad de salida aplicables.
        </p>
      </DocSection>

      <DocSection title="Contenido del embarque" right={`${lines.length} línea(s)`}>
        {lines.length === 0 ? (
          <p className="text-[13px] text-gray-500">
            Sin líneas de contenido registradas para este embarque. Captura el contenido en Embarques
            para detallar parte, cantidad y lote.
          </p>
        ) : (
          <DocTable columns={lineCols} rows={lines} rowKey={(l) => l.id} />
        )}
      </DocSection>

      <DocSection title="Fechas del embarque">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
          <Kv label="Prometido" value={fmtDay(ship.promisedDate)} />
          <Kv label="Embarcado" value={fmtDate(ship.shippedDate)} />
          <Kv label="Entregado" value={fmtDate(ship.deliveredDate)} />
        </div>
        {!shipped && (
          <p className="mt-2 text-[12px] text-amber-700">
            Este embarque aún no sale (estado {ship.status}). El CoC de salida debería emitirse al
            transicionar a SHIPPED.
          </p>
        )}
        {ship.notes && (
          <p className="mt-2 text-[12px] text-gray-500">
            <span className="font-semibold">Notas:</span> {ship.notes}
          </p>
        )}
      </DocSection>

      <SignatureBlock
        roles={[
          { label: "Calidad de salida", hint: "OQC / QA" },
          { label: "Embarques", hint: "Logistics" },
          { label: "Aprobación final", hint: "Plant Manager" },
        ]}
      />

      <BackendNote
        items={[
          "Enlace embarque ⇄ inspección OQC ⇄ genealogía por serie para certificar conformidad unidad por unidad.",
        ]}
      />
    </>
  );
}

// ── Atoms locales ────────────────────────────────────────────────────────────
function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
        active ? "bg-white shadow-sm dark:bg-white/15" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function ForbiddenHint({ what }: { what: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl bg-black/5 px-3 py-2 text-sm text-gray-500 dark:bg-white/10">
      <Lock className="h-4 w-4 text-gray-400" /> Sin acceso a {what}. Verifica tus permisos y la
      conexión al backend.
    </div>
  );
}
