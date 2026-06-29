"use client";

// Packing (Empaque) — build handling units (pallets/cartons) for outbound
// shipments, each with a GS1 SSCC, and print the GS1-128 ZPL label the warehouse
// scans. Self-contained screen over the real `packing` module + `/outbound`.
import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  Download,
  Inbox,
  Loader2,
  Lock,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  ScanLine,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/contexts/ToastContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");
const ACCENT = "#6366f1";
const AMBER = "#f59e0b";
const GREEN = "#10b981";
const GRAY = "#6b7280";

interface ContentLine {
  partNumber: string;
  quantity: number;
  serials?: string[];
}
interface HandlingUnit {
  id: string;
  shipmentId: string | null;
  shipmentFolio: string | null;
  sscc: string | null;
  ssccPlaceholder: boolean;
  type: "PALLET" | "CARTON" | "BOX";
  status: "OPEN" | "PACKED" | "LOADED";
  weightKg: number | null;
  contents: ContentLine[] | null;
  shipToName: string | null;
  shipToAddress: string | null;
  fromName: string | null;
  poNumber: string | null;
}
interface ShipmentLite {
  id: string;
  folio: string | null;
  title: string;
  customerName: string | null;
  destination: string | null;
}
interface PackingReadiness {
  totals: {
    totalSerials: number;
    readyForPacking: number;
    available: number;
    packed: number;
    awaitingTest: number;
    blocked: number;
  };
  availableSerials: string[];
  units: Array<{
    serialNumber: string;
    workOrder: string | null;
    model: string | null;
    status: "AVAILABLE" | "PACKED" | "AWAITING_TEST" | "BLOCKED";
    packedIn: { sscc: string | null; shipmentFolio: string | null } | null;
  }>;
}

const TYPE_LABEL: Record<HandlingUnit["type"], string> = { PALLET: "Tarima", CARTON: "Caja", BOX: "Bulto" };
const STATUS_META: Record<HandlingUnit["status"], { label: string; color: string }> = {
  OPEN: { label: "Abierta", color: GRAY },
  PACKED: { label: "Empacada", color: ACCENT },
  LOADED: { label: "Cargada", color: GREEN },
};

async function call(path: string, method: string, body?: unknown) {
  return apiFetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export default function PackingPage() {
  const { data, isLoading, forbidden, mutate } = useApi<HandlingUnit[]>("/packing/handling-units");
  const { data: shipmentsData } = useApi<ShipmentLite[]>("/outbound/shipments");
  const [q, setQ] = useState("");
  const [shipmentFilter, setShipmentFilter] = useState("");
  const readinessPath = shipmentFilter
    ? `/packing/readiness?shipmentId=${encodeURIComponent(shipmentFilter)}`
    : "/packing/readiness";
  const { data: readiness, isLoading: readinessLoading, mutate: mutateReadiness } = useApi<PackingReadiness>(readinessPath);
  const units = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const shipments = useMemo(() => (Array.isArray(shipmentsData) ? shipmentsData : []), [shipmentsData]);

  const [form, setForm] = useState<HandlingUnit | "new" | null>(null);
  const [label, setLabel] = useState<{ hu: HandlingUnit; zpl: string } | null>(null);

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return units.filter((h) => {
      if (shipmentFilter && h.shipmentId !== shipmentFilter) return false;
      if (n && !`${h.sscc ?? ""} ${h.shipmentFolio ?? ""} ${(h.contents ?? []).map((c) => c.partNumber).join(" ")}`.toLowerCase().includes(n)) return false;
      return true;
    });
  }, [units, q, shipmentFilter]);

  const refreshPacking = () => {
    void mutate();
    void mutateReadiness();
  };

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Necesitas permiso de logística para ver empaque.</p>
        </div>
      </div>
    );
  }

  const firstLoad = isLoading && data === undefined;

  return (
    <div className="min-h-screen text-foreground">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${ACCENT}1f` }}>
            <Boxes className="w-5 h-5" style={{ color: ACCENT }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Logística · Empaque</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Unidades de manejo (tarima/caja) · SSCC · etiqueta ZPL</p>
          </div>
          <button onClick={() => setForm("new")} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: ACCENT }}>
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nueva unidad</span>
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 pt-8 pb-28">
        <ReadinessPanel readiness={readiness} isLoading={readinessLoading} onRefresh={refreshPacking} />

        <div className="flex flex-wrap items-center gap-2 mb-5">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar SSCC, folio, parte…" className="pk-input flex-1 min-w-[200px]" />
          <select value={shipmentFilter} onChange={(e) => setShipmentFilter(e.target.value)} className="pk-input w-auto">
            <option value="">Todos los embarques</option>
            {shipments.map((s) => <option key={s.id} value={s.id}>{s.folio ?? s.title}</option>)}
          </select>
        </div>

        {firstLoad ? (
          <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : units.length === 0 ? (
          <div className={`${glass} rounded-2xl p-12 text-center`}>
            <Boxes className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Sin unidades de manejo</h3>
            <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">Crea la primera tarima/caja: genera su SSCC y su etiqueta GS1-128 para el check de embarque.</p>
            <button onClick={() => setForm("new")} className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: ACCENT }}>
              <Plus className="w-4 h-4" /> Nueva unidad
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className={`${glass} rounded-2xl p-10 text-center`}>
            <Inbox className="w-7 h-7 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-400">Nada coincide con el filtro.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {rows.map((h) => (
              <HuRow key={h.id} hu={h} onEdit={() => setForm(h)} onLabel={() => openLabel(h, setLabel)} onChanged={refreshPacking} />
            ))}
          </div>
        )}
      </main>

      {form && (
        <HuFormModal
          initial={form === "new" ? null : form}
          shipments={shipments}
          readiness={readiness}
          onClose={() => setForm(null)}
          onSaved={refreshPacking}
        />
      )}
      {label && <LabelModal hu={label.hu} zpl={label.zpl} onClose={() => setLabel(null)} />}

      <style jsx global>{`
        .pk-input { width: 100%; border-radius: .75rem; padding: .55rem .75rem; background: rgba(0,0,0,.03); border: 1px solid rgba(0,0,0,.08); outline: none; font-size: .875rem; color: inherit; }
        .pk-input:focus { border-color: ${ACCENT}; }
        :global(.dark) .pk-input { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.1); }
      `}</style>
    </div>
  );
}

async function openLabel(hu: HandlingUnit, setLabel: (v: { hu: HandlingUnit; zpl: string }) => void) {
  try {
    const res = await apiFetch(`${API_BASE}/packing/handling-units/${hu.id}/label`);
    const d = await res.json().catch(() => ({}));
    setLabel({ hu, zpl: d?.zpl ?? "" });
  } catch {
    setLabel({ hu, zpl: "" });
  }
}

function ReadinessPanel({
  readiness,
  isLoading,
  onRefresh,
}: {
  readiness?: PackingReadiness;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const totals = readiness?.totals;
  const sample = readiness?.availableSerials.slice(0, 8) ?? [];

  return (
    <section className={`${glass} rounded-2xl p-4 mb-5`}>
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${GREEN}1f` }}>
          <CheckCircle2 className="w-5 h-5" style={{ color: GREEN }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Readiness de empaque por serial PASS</h2>
              <p className="text-[12px] text-gray-400">
                Fuente: test-flow. Solo los seriales en READY_FOR_PACKAGING pueden empacarse como evidencia serializada.
              </p>
            </div>
            <button onClick={onRefresh} title="Actualizar readiness" className="p-1.5 rounded-lg text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
            <ReadinessKpi label="Disponibles" value={totals?.available ?? 0} color={GREEN} />
            <ReadinessKpi label="Ya empacadas" value={totals?.packed ?? 0} color={ACCENT} />
            <ReadinessKpi label="Pend. prueba" value={totals?.awaitingTest ?? 0} color={AMBER} />
            <ReadinessKpi label="Bloqueadas" value={totals?.blocked ?? 0} color="#ef4444" />
            <ReadinessKpi label="Seriales" value={totals?.totalSerials ?? 0} color={GRAY} />
          </div>

          {sample.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sample.map((serial) => (
                <span key={serial} className="font-mono text-[11px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                  {serial}
                </span>
              ))}
              {(readiness?.availableSerials.length ?? 0) > sample.length && (
                <span className="text-[11px] px-2 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-gray-400">
                  +{(readiness?.availableSerials.length ?? 0) - sample.length}
                </span>
              )}
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-gray-400">
              Sin seriales liberados para empaque. Captura PASS en pruebas o revisa unidades en disposicion.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function ReadinessKpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-black/5 dark:border-white/10 px-3 py-2">
      <div className="text-lg font-semibold leading-tight" style={{ color }}>{value.toLocaleString()}</div>
      <div className="text-[11px] text-gray-400 truncate">{label}</div>
    </div>
  );
}

function HuRow({ hu, onEdit, onLabel, onChanged }: { hu: HandlingUnit; onEdit: () => void; onLabel: () => void; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const summary = (hu.contents ?? [])
    .map((c) => `${c.partNumber}x${c.quantity}${c.serials?.length ? ` / ${c.serials.length} seriales` : ""}`)
    .join(" · ");

  async function regen() {
    setBusy("regen");
    try {
      const res = await call(`/packing/handling-units/${hu.id}/regenerate-sscc`, "POST");
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || "No se pudo.", "SSCC"); return; }
      toast.success("SSCC regenerado.", "SSCC"); onChanged();
    } catch { toast.error("Error de red.", "SSCC"); } finally { setBusy(null); }
  }
  async function del() {
    if (!(await confirm({ message: "¿Eliminar esta unidad de manejo?", tone: 'danger', confirmLabel: 'Eliminar' }))) return;
    setBusy("del");
    try {
      const res = await call(`/packing/handling-units/${hu.id}`, "DELETE");
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || "No se pudo.", "Empaque"); return; }
      toast.success("Eliminada.", "Empaque"); onChanged();
    } catch { toast.error("Error de red.", "Empaque"); } finally { setBusy(null); }
  }

  const sm = STATUS_META[hu.status];
  return (
    <div className={`${glass} rounded-2xl p-4 flex items-start gap-3`}>
      <span className="w-9 h-9 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${ACCENT}1f` }}>
        <Package className="w-5 h-5" style={{ color: ACCENT }} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[13px] font-semibold truncate">{hu.sscc ?? "—"}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${ACCENT}1f`, color: ACCENT }}>{TYPE_LABEL[hu.type]}</span>
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${sm.color}1f`, color: sm.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sm.color }} />{sm.label}
          </span>
          {hu.ssccPlaceholder && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${AMBER}1f`, color: AMBER }} title="Configura GS1_COMPANY_PREFIX para un SSCC real">
              <AlertTriangle className="w-3 h-3" /> SSCC placeholder
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[12px] text-gray-400 flex-wrap">
          {hu.shipmentFolio && <span>{hu.shipmentFolio}</span>}
          {hu.shipToName && <span>→ {hu.shipToName}</span>}
          {summary ? <span className="truncate">{summary}</span> : <span className="italic">sin contenido</span>}
          {hu.weightKg != null && <span>{hu.weightKg} kg</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onLabel} title="Etiqueta ZPL" className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-500/10"><Tag className="w-4 h-4" /></button>
        <button onClick={regen} disabled={busy !== null} title="Regenerar SSCC" className="p-1.5 rounded-lg text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10">{busy === "regen" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}</button>
        <button onClick={onEdit} title="Editar" className="p-1.5 rounded-lg text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
        <button onClick={del} disabled={busy !== null} title="Eliminar" className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10">{busy === "del" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</button>
      </div>
    </div>
  );
}

function HuFormModal({
  initial,
  shipments,
  readiness,
  onClose,
  onSaved,
}: {
  initial: HandlingUnit | null;
  shipments: ShipmentLite[];
  readiness?: PackingReadiness;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const editing = !!initial;
  const [busy, setBusy] = useState(false);
  const [shipmentId, setShipmentId] = useState(initial?.shipmentId ?? "");
  const [type, setType] = useState<HandlingUnit["type"]>(initial?.type ?? "CARTON");
  const [weightKg, setWeightKg] = useState(initial?.weightKg != null ? String(initial.weightKg) : "");
  const [poNumber, setPoNumber] = useState(initial?.poNumber ?? "");
  const [shipToName, setShipToName] = useState(initial?.shipToName ?? "");
  const [shipToAddress, setShipToAddress] = useState(initial?.shipToAddress ?? "");
  const [fromName, setFromName] = useState(initial?.fromName ?? "");
  const [lines, setLines] = useState<ContentLine[]>(initial?.contents?.length ? initial.contents : [{ partNumber: "", quantity: 0 }]);

  function pickShipment(id: string) {
    setShipmentId(id);
    const s = shipments.find((x) => x.id === id);
    if (s && !editing) {
      if (!shipToName) setShipToName(s.customerName ?? "");
      if (!shipToAddress) setShipToAddress(s.destination ?? "");
    }
  }

  function parseSerials(value: string) {
    return value
      .split(/[\s,;]+/)
      .map((serial) => serial.trim())
      .filter(Boolean);
  }

  async function submit() {
    const contents = lines
      .map((l) => {
        const serials = (l.serials ?? [])
          .map((serial) => serial.trim())
          .filter(Boolean);
        const quantity = Number(l.quantity) || serials.length;
        return {
          partNumber: l.partNumber.trim(),
          quantity,
          ...(serials.length ? { serials } : {}),
        };
      })
      .filter((l) => l.partNumber && l.quantity > 0);
    const s = shipments.find((x) => x.id === shipmentId);
    const body = {
      shipmentId: shipmentId || undefined,
      shipmentFolio: s?.folio ?? undefined,
      type,
      weightKg: weightKg ? Number(weightKg) : undefined,
      poNumber: poNumber.trim() || undefined,
      shipToName: shipToName.trim() || undefined,
      shipToAddress: shipToAddress.trim() || undefined,
      fromName: fromName.trim() || undefined,
      contents,
    };
    setBusy(true);
    try {
      const res = editing
        ? await call(`/packing/handling-units/${initial!.id}`, "PATCH", body)
        : await call(`/packing/handling-units`, "POST", body);
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || "No se pudo guardar.", "Empaque"); return; }
      toast.success(editing ? "Unidad actualizada." : "Unidad creada (SSCC generado).", "Empaque");
      onSaved(); onClose();
    } catch { toast.error("Error de red.", "Empaque"); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><Boxes className="w-4 h-4" style={{ color: ACCENT }} /> {editing ? "Editar unidad" : "Nueva unidad de manejo"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block md:col-span-2"><span className="block text-[12px] font-medium text-gray-500 mb-1">Embarque</span>
            <select value={shipmentId} onChange={(e) => pickShipment(e.target.value)} className="pk-input">
              <option value="">— sin embarque —</option>
              {shipments.map((s) => <option key={s.id} value={s.id}>{(s.folio ?? s.title)}{s.customerName ? ` · ${s.customerName}` : ""}</option>)}
            </select>
          </label>
          <label className="block"><span className="block text-[12px] font-medium text-gray-500 mb-1">Tipo</span>
            <select value={type} onChange={(e) => setType(e.target.value as HandlingUnit["type"])} className="pk-input">
              <option value="PALLET">Tarima</option><option value="CARTON">Caja</option><option value="BOX">Bulto</option>
            </select>
          </label>
          <label className="block"><span className="block text-[12px] font-medium text-gray-500 mb-1">Peso (kg)</span>
            <input type="number" min={0} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className="pk-input" />
          </label>
          <label className="block"><span className="block text-[12px] font-medium text-gray-500 mb-1">Destinatario</span>
            <input value={shipToName} onChange={(e) => setShipToName(e.target.value)} className="pk-input" />
          </label>
          <label className="block"><span className="block text-[12px] font-medium text-gray-500 mb-1">Destino</span>
            <input value={shipToAddress} onChange={(e) => setShipToAddress(e.target.value)} className="pk-input" />
          </label>
          <label className="block"><span className="block text-[12px] font-medium text-gray-500 mb-1">Remitente</span>
            <input value={fromName} onChange={(e) => setFromName(e.target.value)} className="pk-input" />
          </label>
          <label className="block"><span className="block text-[12px] font-medium text-gray-500 mb-1">P.O.</span>
            <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="pk-input" />
          </label>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-medium text-gray-500">Contenido</span>
            <button onClick={() => setLines([...lines, { partNumber: "", quantity: 0 }])} className="text-[12px] inline-flex items-center gap-1" style={{ color: ACCENT }}><Plus className="w-3.5 h-3.5" /> Línea</button>
          </div>
          {readiness?.availableSerials.length ? (
            <div className="mb-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-700 dark:text-emerald-300">
              {readiness.availableSerials.length.toLocaleString()} seriales PASS disponibles. Puedes pegar seriales separados por coma, espacio o salto de linea.
            </div>
          ) : null}
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_6rem_auto] gap-2 rounded-xl border border-black/5 dark:border-white/10 p-2">
                <input value={l.partNumber} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, partNumber: e.target.value } : x))} placeholder="Número de parte" className="pk-input flex-1" />
                <input type="number" min={0} value={l.quantity || ""} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} placeholder="Cant." className="pk-input w-24" />
                <button onClick={() => setLines(lines.filter((_, j) => j !== i))} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500"><X className="w-4 h-4" /></button>
                <textarea
                  value={(l.serials ?? []).join("\n")}
                  onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, serials: parseSerials(e.target.value) } : x))}
                  placeholder="Seriales PASS opcionales"
                  rows={2}
                  className="pk-input col-span-3 resize-none font-mono text-[12px]"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
          <button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: ACCENT }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />} {editing ? "Guardar" : "Crear unidad"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LabelModal({ hu, zpl, onClose }: { hu: HandlingUnit; zpl: string; onClose: () => void }) {
  function download() {
    const blob = new Blob([zpl], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${hu.sscc ?? "label"}.zpl`; a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-xl max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><ScanLine className="w-4 h-4" style={{ color: ACCENT }} /> Etiqueta GS1-128 (SSCC)</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        <p className="font-mono text-[13px] mb-2">{hu.sscc}</p>
        <pre className="text-[11px] leading-snug bg-black/5 dark:bg-white/5 rounded-xl p-3 overflow-x-auto max-h-64 whitespace-pre-wrap">{zpl || "—"}</pre>
        <p className="text-[11px] text-gray-400 mt-2 inline-flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Formato ZPL para impresoras Zebra. Descárgala y envíala a la impresora; para previsualizar puedes pegarla en labelary.com.</span>
        </p>
        <div className="mt-4 flex justify-end">
          <button onClick={download} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: ACCENT }}>
            <Download className="w-4 h-4" /> Descargar .zpl
          </button>
        </div>
      </div>
    </div>
  );
}
