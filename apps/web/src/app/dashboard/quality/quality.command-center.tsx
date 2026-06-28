"use client";

import type React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Factory,
  GitBranch,
  Lock,
  PackageCheck,
  PackageSearch,
  Route,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Siren,
  TimerReset,
  Wrench,
} from "lucide-react";
import { glass } from "@/lib/glass";
import type { QualityCommandCenterSummary } from "./quality.types";

export function BattleRhythmPanel({ commandCenter }: { commandCenter?: QualityCommandCenterSummary }) {
  const rhythm = commandCenter?.battleRhythm;
  const groups = [
    {
      key: "production",
      title: "Production blockers",
      subtitle: "WIP, línea o WO que puede frenar producción hoy.",
      icon: <Factory className="h-4 w-4" />,
      items: rhythm?.productionBlockers ?? [],
    },
    {
      key: "shipment",
      title: "Shipment blockers",
      subtitle: "Riesgos OQC/customer antes de liberar embarques.",
      icon: <PackageCheck className="h-4 w-4" />,
      items: rhythm?.shipmentBlockers ?? [],
    },
    {
      key: "supplier",
      title: "Supplier containment",
      subtitle: "Material recibido que requiere hold, sort o SCAR.",
      icon: <PackageSearch className="h-4 w-4" />,
      items: rhythm?.supplierContainment ?? [],
    },
    {
      key: "release",
      title: "Release candidates",
      subtitle: "NCR contenidas/dispuestas que pueden destrabar flujo.",
      icon: <ShieldCheck className="h-4 w-4" />,
      items: rhythm?.releaseCandidates ?? [],
    },
    {
      key: "owner",
      title: "Owner load",
      subtitle: "Carga operativa por owner, línea o modelo.",
      icon: <TimerReset className="h-4 w-4" />,
      items: rhythm?.ownerLoad ?? [],
    },
  ];
  const nowCount = groups.flatMap((group) => group.items).filter((item) => item.priority === "now").length;
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section className={`${glass} mb-5 rounded-2xl p-4`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today&apos;s quality battle rhythm</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Handoff operativo para el daily de Calidad: qué bloquea producción, embarques, proveedor, liberación y owners.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right">
          <CommandCenterMiniStat label="Acciones" value={total || "—"} />
          <CommandCenterMiniStat label="Ahora" value={nowCount || "—"} />
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/45 p-6 text-sm text-muted-foreground">
          Sin handoff activo para el scope seleccionado. Cuando existan NCR abiertas, el command center separará bloqueos de producción, embarque, proveedor, liberación y carga por owner.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-5">
          {groups.map((group) => (
            <div key={group.key} className="rounded-2xl border border-border bg-background/50 p-3">
              <div className="mb-3 flex items-start gap-2">
                <span className="rounded-xl bg-muted p-2 text-muted-foreground">{group.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{group.title}</div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{group.subtitle}</p>
                </div>
              </div>
              <div className="space-y-2">
                {group.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">Sin bloqueo.</div>
                ) : group.items.slice(0, 2).map((item) => (
                  <Link key={item.key} href={item.route} className="block rounded-xl border border-border bg-card/70 p-3 transition hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{item.title}</div>
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.detail}</div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${priorityClass(item.priority)}`}>
                        {item.priority}
                      </span>
                    </div>
                    <div className="mb-2 flex items-end justify-between gap-2 rounded-lg bg-muted/55 px-2.5 py-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.metricLabel}</span>
                      <span className="text-lg font-semibold tabular-nums">{formatNumber(item.metric)}</span>
                    </div>
                    {item.blockers.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {item.blockers.slice(0, 3).map((blocker) => (
                          <span key={blocker} className="rounded-lg bg-muted px-2 py-1 text-[10px] text-muted-foreground">{blocker}</span>
                        ))}
                      </div>
                    )}
                    <div className="text-[11px] leading-relaxed text-muted-foreground">{item.actions[0]}</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function priorityClass(priority: "now" | "today" | "watch") {
  if (priority === "now") return "bg-red-500/10 text-red-600 dark:text-red-300";
  if (priority === "today") return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "bg-muted text-muted-foreground";
}

export function AgingEscalationPanel({ commandCenter }: { commandCenter?: QualityCommandCenterSummary }) {
  const aging = commandCenter?.aging;
  const stale = aging?.staleNcrs ?? [];
  const owners = aging?.ownerEscalations ?? [];
  const buckets = aging?.buckets ?? [];
  const breaches = aging?.slaBreaches ?? [];
  const policies = aging?.slaPolicies ?? [];

  return (
    <section className={`${glass} mb-5 rounded-2xl p-4`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aging & escalation control</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Control de envejecimiento para evitar que NCR críticas, holds y acciones correctivas se queden sin dueño o sin fecha.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right">
          <CommandCenterMiniStat label="Stale" value={stale.length || "—"} />
          <CommandCenterMiniStat label="SLA late" value={breaches.length || "—"} />
        </div>
      </div>

      {!aging ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/45 p-6 text-sm text-muted-foreground">
          Aging pendiente del endpoint command-center.
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-4">
          <div className="rounded-2xl border border-border bg-background/50 p-3">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-xl bg-muted p-2 text-muted-foreground"><TimerReset className="h-4 w-4" /></span>
              <div>
                <div className="text-sm font-semibold">Age buckets</div>
                <div className="text-[11px] text-muted-foreground">Abiertas por días</div>
              </div>
            </div>
            <div className="space-y-2">
              {buckets.map((bucket) => (
                <div key={bucket.label} className="rounded-xl bg-muted/55 px-3 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{bucket.label}</span>
                    <span className="font-semibold tabular-nums">{bucket.count}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{bucket.critical} críticas · {bucket.units} unidades</div>
                </div>
              ))}
            </div>
            {policies.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {policies.slice(0, 3).map((policy) => (
                  <span key={policy.key} className="rounded-lg bg-background/70 px-2 py-1 text-[10px] text-muted-foreground">{policy.severity}: {policy.dueDays}d</span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-background/50 p-3">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-xl bg-muted p-2 text-muted-foreground"><ShieldAlert className="h-4 w-4" /></span>
              <div>
                <div className="text-sm font-semibold">SLA breaches</div>
                <div className="text-[11px] text-muted-foreground">Fuera de política</div>
              </div>
            </div>
            <div className="space-y-2">
              {breaches.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">Sin breaches SLA.</div>
              ) : breaches.slice(0, 4).map((item) => (
                <Link key={item.id} href={item.route} className="block rounded-xl border border-border bg-card/70 p-3 hover:bg-muted/70">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold">{item.ncrNumber}</span>
                    <span className="rounded-full bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-600 dark:text-red-300">+{item.daysLate}d</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{item.partNumber} · due {item.dueDays}d · {item.owner ?? "sin owner"}</div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/50 p-3">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-xl bg-muted p-2 text-muted-foreground"><TimerReset className="h-4 w-4" /></span>
              <div>
                <div className="text-sm font-semibold">Stale NCRs</div>
                <div className="text-[11px] text-muted-foreground">Críticas o 8+ días abiertas</div>
              </div>
            </div>
            <div className="space-y-2">
              {stale.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">Sin NCR envejecidas.</div>
              ) : stale.slice(0, 4).map((item) => (
                <Link key={item.id} href={item.route} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/70 p-3 hover:bg-muted/70">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{item.ncrNumber} · {item.partNumber}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{item.status} · {item.owner ?? "sin owner"}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">{item.daysOpen}d</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/50 p-3">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-xl bg-muted p-2 text-muted-foreground"><Wrench className="h-4 w-4" /></span>
              <div>
                <div className="text-sm font-semibold">Owner escalations</div>
                <div className="text-[11px] text-muted-foreground">Carga crítica o envejecida</div>
              </div>
            </div>
            <div className="space-y-2">
              {owners.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">Sin escalaciones por owner.</div>
              ) : owners.slice(0, 4).map((owner) => (
                <Link key={owner.owner} href={owner.route} className="block rounded-xl border border-border bg-card/70 p-3 hover:bg-muted/70">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold">{owner.owner}</span>
                    <span className="text-sm font-semibold tabular-nums">{owner.count}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{owner.critical} críticas · max {owner.maxDaysOpen} días</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function ActionPlanPanel({ commandCenter }: { commandCenter?: QualityCommandCenterSummary }) {
  const plan = commandCenter?.actionPlan;
  const groups = [
    {
      key: "hold",
      title: "Hold launcher",
      subtitle: "Candidatos listos para hold de inventario/calidad.",
      icon: <Lock className="h-4 w-4" />,
      items: plan?.holdCandidates ?? [],
    },
    {
      key: "mrb",
      title: "MRB package",
      subtitle: "Casos que necesitan paquete de disposición.",
      icon: <ClipboardCheck className="h-4 w-4" />,
      items: plan?.mrbCandidates ?? [],
    },
    {
      key: "scar",
      title: "SCAR prep",
      subtitle: "Proveedor: evidencia, lote y respuesta correctiva.",
      icon: <ShieldX className="h-4 w-4" />,
      items: plan?.scarCandidates ?? [],
    },
    {
      key: "recall",
      title: "Recall scope",
      subtitle: "Trazabilidad para lotes, seriales, WOs y clientes.",
      icon: <GitBranch className="h-4 w-4" />,
      items: plan?.recallCandidates ?? [],
    },
    {
      key: "8d",
      title: "Customer 8D",
      subtitle: "Preparación de 8D/RMA cuando hay impacto externo.",
      icon: <Route className="h-4 w-4" />,
      items: plan?.customer8dCandidates ?? [],
    },
  ];
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section className={`${glass} mb-5 rounded-2xl p-4`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action launcher plan</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Plan de ejecución sin escritura automática: prepara payloads, permisos, prechecks y trazabilidad para convertir señales en acciones auditables.
          </p>
        </div>
        <CommandCenterMiniStat label="Acciones listas" value={total || "—"} />
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/45 p-6 text-sm text-muted-foreground">
          Sin acciones sugeridas para el scope actual. Cuando haya NCR abiertas, se propondrán holds, MRB, SCAR, recall scope o 8D cliente.
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-5">
          {groups.map((group) => (
            <div key={group.key} className="rounded-2xl border border-border bg-background/50 p-3">
              <div className="mb-3 flex items-start gap-2">
                <span className="rounded-xl bg-muted p-2 text-muted-foreground">{group.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{group.title}</div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{group.subtitle}</p>
                </div>
              </div>
              <div className="space-y-2">
                {group.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">Sin candidato.</div>
                ) : group.items.slice(0, 2).map((item) => (
                  <Link key={item.key} href={item.route} className="block rounded-xl border border-border bg-card/70 p-3 transition hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <div className="mb-2 min-w-0">
                      <div className="truncate text-sm font-semibold">{item.title}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {item.method} {item.endpoint ?? "workflow pendiente"}
                      </div>
                    </div>
                    <div className="mb-2 rounded-lg bg-muted/55 px-2.5 py-2 text-[11px] text-muted-foreground">
                      Permiso: <span className="font-medium text-foreground">{item.permission ?? "por definir"}</span>
                    </div>
                    <div className="mb-2 flex flex-wrap gap-1">
                      {Object.entries(item.payloadTemplate).slice(0, 3).map(([key, value]) => (
                        <span key={key} className="rounded-lg bg-muted px-2 py-1 text-[10px] text-muted-foreground">{key}: {value ?? "—"}</span>
                      ))}
                    </div>
                    <ul className="space-y-1">
                      {item.prechecks.slice(0, 2).map((check) => (
                        <li key={check} className="flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/70" />
                          <span>{check}</span>
                        </li>
                      ))}
                    </ul>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function OperationalDrilldownBoard({ commandCenter }: { commandCenter?: QualityCommandCenterSummary }) {
  const drilldowns = commandCenter?.drilldowns;
  const groups = [
    {
      key: "supplier",
      title: "Supplier risk / SCAR",
      subtitle: "Proveedores que pueden requerir contención, sort o acción correctiva.",
      icon: <PackageSearch className="h-4 w-4" />,
      items: drilldowns?.supplierRisks ?? [],
    },
    {
      key: "line",
      title: "Line / model risk",
      subtitle: "Líneas, estaciones o modelos que concentran escapes o FPY bajo.",
      icon: <Factory className="h-4 w-4" />,
      items: drilldowns?.lineRisks ?? [],
    },
    {
      key: "containment",
      title: "Containment candidates",
      subtitle: "NCR abiertas que deben convertirse en hold, where-used o MRB.",
      icon: <ShieldAlert className="h-4 w-4" />,
      items: drilldowns?.containmentCandidates ?? [],
    },
    {
      key: "customer",
      title: "Customer / shipment exposure",
      subtitle: "Clientes con riesgo potencial de RMA, 8D o bloqueo de embarque.",
      icon: <Siren className="h-4 w-4" />,
      items: drilldowns?.customerImpacts ?? [],
    },
    {
      key: "capa",
      title: "CAPA aging watch",
      subtitle: "Acciones correctivas vencidas que sostienen defectos repetidos.",
      icon: <Wrench className="h-4 w-4" />,
      items: drilldowns?.capaWatch ?? [],
    },
  ];
  const hasData = groups.some((group) => group.items.length > 0);

  return (
    <section className={`${glass} mb-5 rounded-2xl p-4`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operational drilldowns</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Capa accionable del command center: convierte señales de PPM, línea, contención, cliente y CAPA en trabajo diario de calidad.
          </p>
        </div>
        <Link href="/dashboard/quality/analytics" className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs font-medium hover:bg-muted/70">
          Ver analytics <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {!hasData ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/45 p-6 text-sm text-muted-foreground">
          Aún no hay drilldowns accionables para el scope seleccionado. Ajusta ventana/modelo/línea/proveedor o espera a que el endpoint de command center responda.
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-5">
          {groups.map((group) => (
            <div key={group.key} className="rounded-2xl border border-border bg-background/50 p-3">
              <div className="mb-3 flex items-start gap-2">
                <span className="rounded-xl bg-muted p-2 text-muted-foreground">{group.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{group.title}</div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{group.subtitle}</p>
                </div>
              </div>
              <div className="space-y-2">
                {group.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">Sin señal activa.</div>
                ) : group.items.slice(0, 3).map((item) => (
                  <Link key={item.key} href={item.route} className="block rounded-xl border border-border bg-card/70 p-3 transition hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{item.title}</div>
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.detail}</div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${drilldownToneClass(item.tone)}`}>
                        {item.tone}
                      </span>
                    </div>
                    <div className="mb-2 flex items-end justify-between gap-2 rounded-lg bg-muted/55 px-2.5 py-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.metricLabel}</span>
                      <span className="text-lg font-semibold tabular-nums">{item.metric == null ? "—" : formatNumber(item.metric)}</span>
                    </div>
                    {item.blockers.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {item.blockers.slice(0, 3).map((blocker) => (
                          <span key={blocker} className="rounded-lg bg-muted px-2 py-1 text-[10px] text-muted-foreground">{blocker}</span>
                        ))}
                      </div>
                    )}
                    <ul className="space-y-1">
                      {item.actions.slice(0, 2).map((action) => (
                        <li key={action} className="flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/70" />
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function drilldownToneClass(tone: "danger" | "warning" | "neutral") {
  if (tone === "danger") return "bg-red-500/10 text-red-600 dark:text-red-300";
  if (tone === "warning") return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "bg-muted text-muted-foreground";
}


function CommandCenterMiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background/55 px-3 py-2">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Math.round(value).toLocaleString();
}
