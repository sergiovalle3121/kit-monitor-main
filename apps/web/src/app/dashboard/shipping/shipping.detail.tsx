"use client";

// Detail drawer for one shipment. Reads GET /shipping/:id (the only endpoint that
// returns items + packing lists; the list endpoint omits them) and surfaces the
// full operating surface: manifest, staged material, packing lists, a timeline,
// the valid state-machine action, discrepancy reporting, and an HONEST
// labels/ASN panel for the capabilities the backend does not yet expose.
import React from "react";
import {
  Boxes,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Hash,
  Loader2,
  MapPin,
  Package,
  ScanLine,
  Send,
  Truck,
  X,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { DetailRow, Pill, SectionLabel, StatusPill } from "./shipping.ui";
import {
  AddItemButton,
  CloseButton,
  DispatchButton,
  GeneratePackingListButton,
  LabelAsnActions,
  ReportDiscrepancyButton,
  StartLoadingButton,
} from "./shipping.actions";
import {
  COLORS,
  STATUS_META,
  canGeneratePackingList,
  canReportDiscrepancy,
  canStage,
  fmtDateTime,
  isLate,
  scheduledLabel,
} from "./shipping.utils";
import type { ShipmentDetail } from "./shipping.types";

export function ShipmentDrawer({
  shipmentId,
  onClose,
  onListChanged,
}: {
  shipmentId: number;
  onClose: () => void;
  onListChanged: () => void;
}) {
  const { data, isLoading, mutate } = useApi<ShipmentDetail>(`/shipping/${shipmentId}`);
  const refresh = () => {
    mutate();
    onListChanged();
  };

  const statusColor = data ? STATUS_META[data.status].color : COLORS.gray;
  const items = data?.items ?? [];
  const packingLists = data?.packingLists ?? [];
  const totalQty = items.reduce((acc, i) => acc + (i.quantity || 0), 0);

  return (
    <div className="fixed inset-0 z-[110]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`${glass} absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto`}>
        {/* Header */}
        <div className="sticky top-0 z-10 px-5 py-4 flex items-center gap-3 border-b border-black/5 dark:border-white/10 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl">
          <span className="w-9 h-9 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${statusColor}1f` }}>
            <Truck className="w-5 h-5" style={{ color: statusColor }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {data && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{data.shipmentNumber}</span>}
              {data && <StatusPill status={data.status} />}
            </div>
            <h3 className="font-semibold truncate mt-0.5">{data ? data.customer : "Cargando…"}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        {isLoading && !data ? (
          <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" /></div>
        ) : !data ? (
          <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">No se encontró el embarque.</div>
        ) : (
          <div className="p-5 space-y-6">
            {/* Manifiesto / logística */}
            <section>
              <SectionLabel>Logística</SectionLabel>
              <dl className="space-y-2.5 text-sm">
                <DetailRow icon={<Truck className="w-4 h-4" />} label="Transportista" value={data.carrier || "Sin asignar"} />
                <DetailRow
                  icon={<Hash className="w-4 h-4" />}
                  label="Camión / chofer"
                  value={[data.truckPlate, data.driverName].filter(Boolean).join(" · ") || "—"}
                />
                <DetailRow icon={<MapPin className="w-4 h-4" />} label="Andén / ruta" value={[data.dockNumber, data.route].filter(Boolean).join(" · ") || "—"} />
                <DetailRow
                  icon={<Calendar className="w-4 h-4" />}
                  label="Cita de embarque"
                  value={data.scheduledAt ? `${scheduledLabel(data.scheduledAt)} · ${fmtDateTime(data.scheduledAt)}` : "Sin cita"}
                  valueColor={isLate(data) ? COLORS.red : undefined}
                />
              </dl>
            </section>

            {/* Material surtido */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Material surtido</SectionLabel>
                {items.length > 0 && (
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">{items.length} líneas · {totalQty} pzs</span>
                )}
              </div>
              {items.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 py-2">
                  <Boxes className="w-4 h-4" /> Aún sin material surtido.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {items.map((it) => (
                    <div key={it.id} className="flex items-center gap-3 rounded-xl px-3 py-2 bg-black/[0.03] dark:bg-white/[0.04]">
                      <Package className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{it.partNumber}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          {[it.lotNumber && `Lote ${it.lotNumber}`, it.workOrder && `WO ${it.workOrder}`, it.fromLocation].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{it.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Listas de empaque */}
            <section>
              <SectionLabel>Listas de empaque</SectionLabel>
              {packingLists.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 py-2">
                  <ClipboardList className="w-4 h-4" /> Sin listas generadas.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {packingLists.map((pl) => (
                    <div key={pl.id} className="flex items-center gap-3 rounded-xl px-3 py-2 bg-black/[0.03] dark:bg-white/[0.04]">
                      <ClipboardList className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium font-mono truncate">{pl.packingListNumber}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          {[`${pl.items?.length ?? 0} líneas`, pl.generatedBy, fmtDateTime(pl.createdAt)].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <Pill label={pl.status} color={COLORS.cyan} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Línea de tiempo */}
            <section>
              <SectionLabel>Línea de tiempo</SectionLabel>
              <div className="space-y-2">
                <TimelineRow icon={<Package className="w-3.5 h-3.5" />} label="Creado" at={data.createdAt} done />
                <TimelineRow icon={<Truck className="w-3.5 h-3.5" />} label="Carga iniciada" at={data.loadingStartedAt} done={!!data.loadingStartedAt} />
                <TimelineRow
                  icon={<Send className="w-3.5 h-3.5" />}
                  label={data.dispatchedBy ? `Despachado · ${data.dispatchedBy}` : "Despachado"}
                  at={data.dispatchedAt}
                  done={!!data.dispatchedAt}
                />
              </div>
            </section>

            {/* Preparar */}
            {(canStage(data.status) || canGeneratePackingList(data.status)) && (
              <section className="pt-1">
                <SectionLabel>Preparar</SectionLabel>
                <div className="flex flex-col gap-2">
                  {canStage(data.status) && <AddItemButton shipment={data} onChanged={refresh} full />}
                  {canGeneratePackingList(data.status) && <GeneratePackingListButton shipment={data} onChanged={refresh} full />}
                </div>
              </section>
            )}

            {/* Avanzar (máquina de estados) */}
            <section className="pt-1">
              <SectionLabel>Avanzar embarque</SectionLabel>
              <div className="flex flex-col gap-2">
                {data.status === "staged" && <StartLoadingButton shipment={data} onChanged={refresh} full />}
                {data.status === "loading" && <DispatchButton shipment={data} onChanged={refresh} full />}
                {data.status === "dispatched" && <CloseButton shipment={data} onChanged={refresh} full />}
                {data.status === "planning" && (
                  <p className="text-[12px] text-gray-500 dark:text-gray-400">Surte material para mover el embarque a <strong>Surtido</strong>.</p>
                )}
                {data.status === "closed" && (
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Estado final — sin más transiciones.
                  </p>
                )}
              </div>
            </section>

            {/* Discrepancia */}
            {canReportDiscrepancy(data.status) && (
              <section className="pt-1">
                <SectionLabel>Calidad de embarque</SectionLabel>
                <ReportDiscrepancyButton shipment={data} onChanged={refresh} full />
              </section>
            )}

            {/* Etiquetas y ASN — honesto: el módulo shipping no expone estos endpoints */}
            <LabelsAsnPanel shipmentId={data.id} trackingNumber={data.trackingNumber} />
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineRow({
  icon,
  label,
  at,
  done,
}: {
  icon: React.ReactNode;
  label: string;
  at?: string | null;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-6 h-6 rounded-full grid place-items-center flex-shrink-0"
        style={done ? { background: `${COLORS.blue}1f`, color: COLORS.blue } : { background: "rgba(107,114,128,0.12)", color: COLORS.gray }}
      >
        {icon}
      </span>
      <span className="text-sm flex-1">{label}</span>
      <span className="text-[12px] text-gray-500 dark:text-gray-400">{at ? fmtDateTime(at) : "—"}</span>
    </div>
  );
}

// ── Etiquetas / ASN ──────────────────────────────────────────────────────────
// El módulo `shipping` ya genera la etiqueta GS1 (SSCC/ZPL) y el ASN (EDI 856) a
// partir de los renglones reales del embarque (header + líneas planas). El
// `trackingNumber` se captura en el manifiesto de carga.
function LabelsAsnPanel({ shipmentId, trackingNumber }: { shipmentId: number; trackingNumber?: string | null }) {
  return (
    <section className="pt-1">
      <SectionLabel>Etiquetas y ASN</SectionLabel>
      <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-3 space-y-3">
        <DetailRow
          icon={<ScanLine className="w-4 h-4" />}
          label="Guía / tracking"
          value={trackingNumber || "Sin capturar"}
          sub={trackingNumber ? "Capturado en el manifiesto de carga" : "Se captura al iniciar la carga"}
        />
        <LabelAsnActions shipmentId={shipmentId} />
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          La etiqueta usa el prefijo GS1 de la empresa (configurable con
          <code> GS1_COMPANY_PREFIX</code>); hasta entonces el SSCC sale con un
          prefijo de marcador, pero el ZPL y el ASN son reales.
        </p>
      </div>
    </section>
  );
}
