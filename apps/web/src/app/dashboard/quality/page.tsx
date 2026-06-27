"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Lock,
  Inbox,
  Plus,
  X,
  Search,
  ShieldAlert,
  ShieldX,
  BarChart3,
  PackageCheck,
  ChevronRight,
  Crosshair,
  Ruler,
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  Factory,
  Gauge,
  GitBranch,
  PackageSearch,
  Radar,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Empty, Field, Kpi, QInputStyle } from "./quality.ui";
import type {
  CreateNcrInput,
  FloorQualityKpis,
  ModelOption,
  Ncr,
  NcrSeverity,
  NcrSourceType,
  NcrStatus,
  QualityAnalytics,
} from "./quality.types";
import {
  deriveNcrKpis,
  NCR_SEVERITY_META,
  NCR_SEVERITY_ORDER,
  NCR_SOURCE_META,
  NCR_SOURCE_ORDER,
  NCR_STATUS_META,
  NCR_STATUS_ORDER,
} from "./quality.utils";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

export default function QualityPage() {
  const { user } = useAuth();
  const { data, isLoading, forbidden, mutate } = useApi<Ncr[]>("/ncr");
  const { data: analyticsData } = useApi<QualityAnalytics>("/quality/analytics?days=30");
  const { data: floorKpis } = useApi<FloorQualityKpis>("/floor-quality/kpis");
  const { data: modelsData } = useApi<ModelOption[]>("/product-models");

  const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const models = Array.isArray(modelsData) ? modelsData : [];
  const kpis = useMemo(() => deriveNcrKpis(all), [all]);

  // Filtros (client-side; la lista de NCR es chica y ya viene completa).
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<NcrStatus | "">("");
  const [severity, setSeverity] = useState<NcrSeverity | "">("");
  const [source, setSource] = useState<NcrSourceType | "">("");
  const [model, setModel] = useState("");

  const modelsInUse = useMemo(
    () => Array.from(new Set(all.map((n) => n.model).filter(Boolean) as string[])).sort(),
    [all],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((n) => {
      if (status && n.status !== status) return false;
      if (severity && n.severity !== severity) return false;
      if (source && n.sourceType !== source) return false;
      if (model && (n.model ?? "") !== model) return false;
      if (needle) {
        const hay = `${n.ncrNumber} ${n.partNumber} ${n.description} ${n.category}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [all, q, status, severity, source, model]);

  const [showForm, setShowForm] = useState(false);
  const anyFilter = !!(q || status || severity || source || model);

  const criticalOpen = useMemo(
    () => all.filter((n) => n.severity === "critical" && n.status !== "closed"),
    [all],
  );
  const uncontainedOpen = useMemo(
    () => all.filter((n) => n.status === "open" || n.status === "under_review"),
    [all],
  );
  const repeatDefects = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of all) counts.set(n.category || "Sin categoría", (counts.get(n.category || "Sin categoría") ?? 0) + 1);
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .filter((r) => r.count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [all]);
  const topSupplier = analyticsData?.ppm.supplier?.[0];
  const topModelRisk = analyticsData?.cuts.byModel?.[0];
  const capaOverdueList = analyticsData?.capa.overdueList ?? [];
  const attentionItems = [
    ...criticalOpen.slice(0, 2).map((n) => ({
      key: `ncr-${n.id}`,
      tone: "danger" as const,
      title: `${n.ncrNumber} crítica abierta`,
      body: `${n.partNumber} · ${n.category} · ${n.quantityAffected} u afectadas`,
      href: `/dashboard/quality/ncr/${n.id}`,
      cta: "Abrir NCR",
    })),
    ...capaOverdueList.slice(0, 2).map((c) => ({
      key: `capa-${c.capaNumber}`,
      tone: "warning" as const,
      title: `${c.capaNumber} vencida`,
      body: `${c.partNumber} · ${c.daysOverdue} días overdue · ${c.status}`,
      href: "/dashboard/quality/analytics",
      cta: "Ver CAPA",
    })),
    ...(floorKpis?.openHolds ? [{
      key: "mrb-holds",
      tone: "warning" as const,
      title: `${floorKpis.openHolds} holds MRB bloqueando flujo`,
      body: `${floorKpis.overdue ?? 0} overdue · ${floorKpis.scrapQty ?? 0} u scrap`,
      href: "/dashboard/floor-quality",
      cta: "Ir a MRB",
    }] : []),
    ...uncontainedOpen.slice(0, 2).map((n) => ({
      key: `contain-${n.id}`,
      tone: "neutral" as const,
      title: `${n.ncrNumber} requiere contención`,
      body: `${NCR_SOURCE_META[n.sourceType] ?? n.sourceType} · ${n.line ?? n.model ?? n.workOrder ?? "sin contexto"}`,
      href: `/dashboard/quality/ncr/${n.id}`,
      cta: "Contener",
    })),
  ].slice(0, 5);

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-5xl mx-auto px-6 pt-10">
        <PageHeader
          domain="quality"
          title="Quality Command Center"
          subtitle="Inspección, contención, MRB, CTQ, yield, CAPA y trazabilidad de punta a punta."
          right={
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/quality/inspections"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium hover:bg-black/5 dark:hover:bg-white/10"
                title="Inspecciones de recibo (IQC) y salida (OQC)"
              >
                <PackageCheck className="w-4 h-4" /> Inspecciones
              </Link>
              <Link
                href="/dashboard/quality/characteristics"
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium hover:bg-black/5 dark:hover:bg-white/10"
                title="Catálogo de características críticas (CTQ) — cimiento de SPC"
              >
                <Crosshair className="w-4 h-4" /> CTQ
              </Link>
              <Link
                href="/dashboard/quality/measurements"
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium hover:bg-black/5 dark:hover:bg-white/10"
                title="Mediciones variables contra características CTQ"
              >
                <Ruler className="w-4 h-4" /> Mediciones
              </Link>
              <Link
                href="/dashboard/quality/analytics"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium hover:bg-black/5 dark:hover:bg-white/10"
                title="Yield, FPY y Pareto de defectos"
              >
                <BarChart3 className="w-4 h-4" /> Analítica
              </Link>
              <Link
                href="/dashboard/quality/holds"
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium hover:bg-black/5 dark:hover:bg-white/10"
                title="Holds de inventario y disposición (nivel inventario)"
              >
                <ShieldX className="w-4 h-4" /> Holds inv.
              </Link>
              <Link
                href="/dashboard/floor-quality"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium hover:bg-black/5 dark:hover:bg-white/10"
                title="Material en hold / MRB / disposición de piso"
              >
                <ShieldAlert className="w-4 h-4" /> MRB / Piso
              </Link>
              {!forbidden && (
                <button
                  data-testid="ncr-new-trigger"
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white"
                  style={{ background: NCR_SEVERITY_META.critical.color }}
                >
                  <Plus className="w-4 h-4" /> Nueva NCR
                </button>
              )}
            </div>
          }
        />

        {forbidden ? (
          <Empty
            icon={<Lock className="w-6 h-6" />}
            title="Sin acceso al backend"
            body="Verifica que el servicio de API esté conectado y tu sesión sea válida."
          />
        ) : (
          <>
            <section className={`${glass} rounded-3xl p-5 md:p-6 mb-5 overflow-hidden relative`}>
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-5 items-stretch">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Radar className="h-3.5 w-3.5 text-primary" /> Torre EMS · últimos 30 días cuando aplica
                  </div>
                  <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">Control operativo de calidad, no solo lista de NCR.</h2>
                  <p className="mt-3 max-w-2xl text-sm md:text-base text-muted-foreground">
                    Prioriza lo que bloquea producción o embarques: defectos repetidos, proveedores con riesgo, holds MRB, CTQ fuera de especificación y CAPAs vencidas.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <CommandLink href="/dashboard/quality/inspections" icon={<ClipboardCheck className="h-4 w-4" />} label="IQC / OQC" />
                    <CommandLink href="/dashboard/floor-quality" icon={<Factory className="h-4 w-4" />} label="MRB piso" />
                    <CommandLink href="/dashboard/quality/characteristics" icon={<Crosshair className="h-4 w-4" />} label="CTQ" />
                    <CommandLink href="/dashboard/quality/analytics" icon={<TrendingUp className="h-4 w-4" />} label="Analytics" />
                    <CommandLink href="/dashboard/genealogy" icon={<GitBranch className="h-4 w-4" />} label="Genealogía" />
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-background/55 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Señales críticas</div>
                  <div className="space-y-3">
                    <Signal label="Contención pendiente" value={uncontainedOpen.length} hint="NCR abiertas/en revisión" />
                    <Signal label="Top defecto" value={repeatDefects[0]?.label ?? "—"} hint={repeatDefects[0] ? `${repeatDefects[0].count} recurrencias` : "sin patrón repetido"} />
                    <Signal label="Proveedor riesgo" value={topSupplier?.supplierName ?? "—"} hint={topSupplier?.ppm != null ? `${topSupplier.ppm.toLocaleString()} PPM` : "analytics pendiente"} />
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <Kpi label="NCR abiertas" value={kpis.open} color={NCR_STATUS_META.open.color} sub={`${kpis.total} total`} />
              <Kpi label="Críticas" value={kpis.critical} color={NCR_SEVERITY_META.critical.color} sub="abiertas" />
              <Kpi label="Holds MRB" value={floorKpis?.openHolds ?? "—"} color="#f59e0b" sub={floorKpis ? `${floorKpis.overdue} overdue` : "endpoint pendiente"} />
              <Kpi label="FPY" value={formatPct(analyticsData?.yield.fpyOverall)} color="#2563eb" sub="quality analytics" />
              <Kpi label="PPM proveedor" value={formatNumber(analyticsData?.ppm.supplierOverall)} color="#0f766e" sub="incoming quality" />
              <Kpi label="CAPAs vencidas" value={analyticsData?.capa.overdue ?? "—"} color="#dc2626" sub="efectividad / 8D" />
              <Kpi label="NCR sin clasificar" value={analyticsData?.meta.unclassifiedNcrs ?? "—"} color="#6b7280" sub="defect codes" />
              <Kpi label="Scrap qty" value={floorKpis?.scrapQty ?? "—"} color="#b45309" sub="MRB dispositions" />
            </section>

            <QualityFlowRail />

            <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4 mb-5">
              <AttentionQueue items={attentionItems} />
              <RiskPanels repeatDefects={repeatDefects} topSupplier={topSupplier} topModelRisk={topModelRisk} analyticsReady={!!analyticsData} />
            </section>

            <ModuleGrid />

            {/* Filtros */}
            <div className={`${glass} rounded-2xl p-3 mb-5 flex flex-wrap items-center gap-2`}>
              <div className="flex items-center gap-2 flex-1 min-w-[180px] px-2">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar NCR, NP, defecto…"
                  className="bg-transparent outline-none text-sm w-full"
                />
              </div>
              <Select value={status} onChange={(v) => setStatus(v as NcrStatus | "")} label="Estado">
                <option value="">Todos</option>
                {NCR_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{NCR_STATUS_META[s].label}</option>
                ))}
              </Select>
              <Select value={severity} onChange={(v) => setSeverity(v as NcrSeverity | "")} label="Severidad">
                <option value="">Todas</option>
                {NCR_SEVERITY_ORDER.map((s) => (
                  <option key={s} value={s}>{NCR_SEVERITY_META[s].label}</option>
                ))}
              </Select>
              <Select value={source} onChange={(v) => setSource(v as NcrSourceType | "")} label="Origen">
                <option value="">Todos</option>
                {NCR_SOURCE_ORDER.map((s) => (
                  <option key={s} value={s}>{NCR_SOURCE_META[s]}</option>
                ))}
              </Select>
              {modelsInUse.length > 0 && (
                <Select value={model} onChange={setModel} label="Modelo">
                  <option value="">Todos</option>
                  {modelsInUse.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-20 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : all.length === 0 ? (
              <Empty
                icon={<Inbox className="w-6 h-6" />}
                title="Sin NCRs"
                body="No hay no-conformidades registradas. Levanta la primera para iniciar el ciclo de contención y disposición."
                cta={
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
                    style={{ background: NCR_SEVERITY_META.critical.color }}
                  >
                    <Plus className="w-4 h-4" /> Levantar NCR
                  </button>
                }
              />
            ) : rows.length === 0 ? (
              <Empty
                icon={<Search className="w-6 h-6" />}
                title="Sin resultados"
                body="Ninguna NCR coincide con los filtros."
                cta={
                  anyFilter ? (
                    <button
                      onClick={() => { setQ(""); setStatus(""); setSeverity(""); setSource(""); setModel(""); }}
                      className="text-sm font-medium px-4 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      Limpiar filtros
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-2.5">
                {rows.map((n) => (
                  <NcrRow key={n.id} ncr={n} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {showForm && (
        <NewNcrModal
          models={models}
          createdBy={user?.email || "QA"}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); mutate(); }}
        />
      )}
    </div>
  );
}


function formatPct(value?: number | null) {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

function formatNumber(value?: number | null) {
  return value == null ? "—" : Math.round(value).toLocaleString();
}

function CommandLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-medium hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/30">
      {icon}{label}
    </Link>
  );
}

function Signal({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/45 px-3 py-2">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold truncate max-w-[12rem]">{value}</div>
      </div>
      <div className="text-right text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function QualityFlowRail() {
  const steps = [
    { label: "IQC", body: "Recibo · proveedor · SCAR", href: "/dashboard/quality/inspections" },
    { label: "IPQC", body: "Línea · FPY · scrap", href: "/dashboard/quality/analytics" },
    { label: "MRB", body: "Hold · cuarentena · disposición", href: "/dashboard/floor-quality" },
    { label: "CAPA", body: "Root cause · 8D · efectividad", href: "/dashboard/quality/analytics" },
    { label: "OQC", body: "Final inspection · embarque", href: "/dashboard/quality/inspections" },
    { label: "RMA / Genealogía", body: "Cliente · serial · where-used", href: "/dashboard/genealogy" },
  ];
  return (
    <section className={`${glass} rounded-2xl p-4 mb-5`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quality flow rail</h2>
        <span className="text-[11px] text-muted-foreground">IQC → IPQC → MRB → CAPA → OQC → RMA/Genealogía</span>
      </div>
      <div className="grid md:grid-cols-6 gap-2">
        {steps.map((step, idx) => (
          <Link key={step.label} href={step.href} className="group rounded-xl border border-border bg-background/55 p-3 hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/30">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{step.label}</span>
              {idx < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{step.body}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function AttentionQueue({ items }: { items: { key: string; tone: "danger" | "warning" | "neutral"; title: string; body: string; href: string; cta: string }[] }) {
  const toneClass = { danger: "text-red-600 bg-red-500/10", warning: "text-amber-600 bg-amber-500/10", neutral: "text-slate-600 bg-slate-500/10" };
  return (
    <section className={`${glass} rounded-2xl p-4`}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Attention queue · hoy</h2>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Sin bloqueos críticos detectados con los endpoints disponibles.</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link key={item.key} href={item.href} className="flex items-center gap-3 rounded-xl border border-border bg-background/55 p-3 hover:bg-muted/70">
              <span className={`rounded-xl p-2 ${toneClass[item.tone]}`}><AlertTriangle className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold truncate">{item.title}</span><span className="block text-xs text-muted-foreground truncate">{item.body}</span></span>
              <span className="text-xs font-medium text-primary">{item.cta}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function RiskPanels({ repeatDefects, topSupplier, topModelRisk, analyticsReady }: { repeatDefects: { label: string; count: number }[]; topSupplier?: { supplierName: string; ppm: number | null }; topModelRisk?: { label: string; count: number }; analyticsReady: boolean }) {
  return (
    <section className={`${glass} rounded-2xl p-4`}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Risk panels</h2>
      <div className="grid gap-3">
        <RiskCard icon={<PackageSearch className="h-4 w-4" />} title="Defecto repetido" value={repeatDefects[0]?.label ?? "—"} meta={repeatDefects[0] ? `${repeatDefects[0].count} NCR` : "sin recurrencia local"} />
        <RiskCard icon={<Gauge className="h-4 w-4" />} title="Proveedor" value={topSupplier?.supplierName ?? "—"} meta={topSupplier?.ppm != null ? `${topSupplier.ppm.toLocaleString()} PPM` : analyticsReady ? "sin datos PPM" : "analytics pendiente"} />
        <RiskCard icon={<Activity className="h-4 w-4" />} title="Modelo / línea" value={topModelRisk?.label ?? "—"} meta={topModelRisk ? `${topModelRisk.count} NCR` : "sin corte dominante"} />
      </div>
    </section>
  );
}

function RiskCard({ icon, title, value, meta }: { icon: React.ReactNode; title: string; value: React.ReactNode; meta: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border bg-background/55 p-3"><span className="rounded-xl bg-muted p-2 text-muted-foreground">{icon}</span><div className="min-w-0"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</div><div className="text-sm font-semibold truncate">{value}</div><div className="text-xs text-muted-foreground">{meta}</div></div></div>;
}

function ModuleGrid() {
  const modules = [
    { label: "Inspecciones IQC/OQC", href: "/dashboard/quality/inspections", icon: <ClipboardCheck className="h-4 w-4" />, body: "Recibo, backlog OQC e historial final." },
    { label: "MRB / piso", href: "/dashboard/floor-quality", icon: <Factory className="h-4 w-4" />, body: "Holds, disposición, where-used operativo." },
    { label: "Holds inventario", href: "/dashboard/quality/holds", icon: <ShieldX className="h-4 w-4" />, body: "Hold granular, transferencias y disposición." },
    { label: "CTQ characteristics", href: "/dashboard/quality/characteristics", icon: <Crosshair className="h-4 w-4" />, body: "Catálogo LSL/Nominal/USL." },
    { label: "Mediciones CTQ", href: "/dashboard/quality/measurements", icon: <Ruler className="h-4 w-4" />, body: "Lecturas y out-of-spec foundation." },
    { label: "Analytics", href: "/dashboard/quality/analytics", icon: <BarChart3 className="h-4 w-4" />, body: "FPY, PPM, Pareto, CAPA." },
    { label: "RMA", href: "/dashboard/rma", icon: <RotateCcw className="h-4 w-4" />, body: "Calidad de cliente y retornos." },
    { label: "Genealogía", href: "/dashboard/genealogy", icon: <GitBranch className="h-4 w-4" />, body: "Seriales, lotes, WOs, where-used." },
  ];
  return (
    <section className="mb-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Módulos de calidad existentes</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {modules.map((m) => <Link key={m.href} href={m.href} className={`${glass} rounded-2xl p-4 hover:shadow-sm transition`}><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><span className="rounded-lg bg-muted p-1.5 text-muted-foreground">{m.icon}</span>{m.label}</div><p className="text-xs text-muted-foreground leading-relaxed">{m.body}</p></Link>)}
      </div>
    </section>
  );
}

// ── Row ─────────────────────────────────────────────────────────────────────
function NcrRow({ ncr }: { ncr: Ncr }) {
  const st = NCR_STATUS_META[ncr.status] ?? { label: ncr.status, color: "#6b7280" };
  const sev = NCR_SEVERITY_META[ncr.severity];
  return (
    <Link
      data-testid="ncr-row"
      data-ncr-number={ncr.ncrNumber}
      href={`/dashboard/quality/ncr/${ncr.id}`}
      className={`${glass} rounded-2xl p-4 flex items-center gap-3 group hover:shadow-sm transition`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: st.color }}
        title={st.label}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-[11px] font-mono text-gray-400">{ncr.ncrNumber}</span>
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: `${st.color}1f`, color: st.color }}
          >
            {st.label}
          </span>
          {sev && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: `${sev.color}1f`, color: sev.color }}
            >
              {sev.label}
            </span>
          )}
          {ncr.model && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "#2ec27e1f", color: "#2ec27e" }}>
              {ncr.model}
            </span>
          )}
        </div>
        <h3 className="font-semibold truncate">
          <span className="font-mono">{ncr.partNumber}</span>
          <span className="text-gray-400 font-normal"> · {ncr.category}</span>
        </h3>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate">{ncr.description}</p>
      </div>
      <div className="text-right shrink-0 hidden sm:block">
        <div className="text-[12px] text-gray-400">{ncr.quantityAffected} u</div>
        <div className="text-[11px] text-gray-400">{NCR_SOURCE_META[ncr.sourceType] ?? ncr.sourceType}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0" />
    </Link>
  );
}

// ── Create modal ──────────────────────────────────────────────────────────────
function NewNcrModal({
  models,
  createdBy,
  onClose,
  onCreated,
}: {
  models: ModelOption[];
  createdBy: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    partNumber: "",
    category: "",
    description: "",
    severity: "major" as NcrSeverity,
    sourceType: "in-process" as NcrSourceType,
    quantityAffected: 1,
    model: "",
    workOrder: "",
    lotNumber: "",
    serialNumber: "",
    line: "",
    customer: "",
    program: "",
  });

  async function submit() {
    if (!form.partNumber.trim()) { toast.error("El número de parte es obligatorio.", "Calidad"); return; }
    if (!form.category.trim()) { toast.error("La categoría del defecto es obligatoria.", "Calidad"); return; }
    if (!form.description.trim()) { toast.error("Describe la no-conformidad.", "Calidad"); return; }
    setBusy(true);
    try {
      const payload: CreateNcrInput = {
        partNumber: form.partNumber.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        severity: form.severity,
        sourceType: form.sourceType,
        quantityAffected: Number(form.quantityAffected) || 0,
        createdBy,
        ...(form.model ? { model: form.model } : {}),
        ...(form.workOrder ? { workOrder: form.workOrder.trim() } : {}),
        ...(form.lotNumber ? { lotNumber: form.lotNumber.trim() } : {}),
        ...(form.serialNumber ? { serialNumber: form.serialNumber.trim() } : {}),
        ...(form.line ? { line: form.line.trim() } : {}),
        ...(form.customer ? { customer: form.customer.trim() } : {}),
        ...(form.program ? { program: form.program.trim() } : {}),
      };
      const res = await apiFetch(`${API_BASE}/ncr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo crear la NCR.", "Calidad");
        return;
      }
      const created = await res.json().catch(() => null);
      toast.success(`NCR creada${created?.ncrNumber ? ` · ${created.ncrNumber}` : ""}.`, "Calidad");
      onCreated();
    } catch {
      toast.error("Error de red.", "Calidad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" style={{ color: NCR_SEVERITY_META.critical.color }} /> Nueva no-conformidad
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Número de parte *">
            <input data-testid="ncr-field-partNumber" value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} className="q-input" placeholder="PCB-2024-A" />
          </Field>
          <Field label="Categoría de defecto *">
            <input data-testid="ncr-field-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="q-input" placeholder="Mecánico / Cosmético / Componente" />
          </Field>
          <Field label="Severidad">
            <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as NcrSeverity })} className="q-input">
              {NCR_SEVERITY_ORDER.map((s) => <option key={s} value={s}>{NCR_SEVERITY_META[s].label}</option>)}
            </select>
          </Field>
          <Field label="Origen">
            <select value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value as NcrSourceType })} className="q-input">
              {NCR_SOURCE_ORDER.map((s) => <option key={s} value={s}>{NCR_SOURCE_META[s]}</option>)}
            </select>
          </Field>
          <Field label="Cantidad afectada">
            <input type="number" min={0} value={form.quantityAffected} onChange={(e) => setForm({ ...form, quantityAffected: Number(e.target.value) })} className="q-input" />
          </Field>
          <Field label="Modelo">
            {models.length > 0 ? (
              <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="q-input">
                <option value="">(opcional)</option>
                {models.map((m) => <option key={m.id} value={m.modelNumber}>{m.modelNumber} · {m.name}</option>)}
              </select>
            ) : (
              <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="q-input" placeholder="(opcional)" />
            )}
          </Field>
          <Field label="Descripción del defecto *" full>
            <textarea data-testid="ncr-field-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="q-input min-h-[68px] resize-y" placeholder="Componente desalineado en posición J3 del board…" />
          </Field>
          <Field label="Orden de trabajo"><input value={form.workOrder} onChange={(e) => setForm({ ...form, workOrder: e.target.value })} className="q-input" placeholder="WO-2024-0042" /></Field>
          <Field label="Lote"><input value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} className="q-input" /></Field>
          <Field label="Serial"><input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} className="q-input" /></Field>
          <Field label="Línea"><input value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })} className="q-input" /></Field>
          <Field label="Cliente"><input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} className="q-input" /></Field>
          <Field label="Programa"><input value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} className="q-input" /></Field>
        </div>
        <div className="mt-5 flex items-center justify-between gap-2">
          <span className="text-[11px] text-gray-400">Levantada por {createdBy}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
            <button data-testid="ncr-create-submit" onClick={submit} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: NCR_SEVERITY_META.critical.color }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Crear NCR
            </button>
          </div>
        </div>
      </div>
      <QInputStyle />
    </div>
  );
}

// ── Lane-specific atom ────────────────────────────────────────────────────────
function Select({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: React.ReactNode }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-sm">
      <span className="text-[11px] font-medium text-gray-400">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent outline-none text-sm rounded-lg px-1.5 py-1 hover:bg-black/5 dark:hover:bg-white/10">
        {children}
      </select>
    </label>
  );
}
