"use client";

// Preventive maintenance (PM). Backed by the real PM-plan API
// (apps/api/.../maintenance pm-plans): recurring plans per asset with a next-due
// date, a VIGENTE/POR VENCER/VENCIDO semaphore, and one-click order generation
// (POST /pm-plans/:id/generate-order) that spawns a PREVENTIVE work order and
// reprograms the next date. Auto-generation via cron is an opt-in follow-up; the
// planner drives it from here today.
import React, { useMemo, useState } from "react";
import {
  CalendarClock,
  Pause,
  Pencil,
  Play,
  Plus,
  User,
  Wrench,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/contexts/ToastContext";
import { Empty, Kpi, Pill, PmStatusPill } from "./maintenance.ui";
import { GeneratePmOrderButton, PmPlanFormModal } from "./maintenance.actions";
import {
  COLORS,
  PM_STATUS_META,
  dueLabel,
  fmtDate,
  pmDueStatus,
  pmFrequencyLabel,
  sortPmPlans,
} from "./maintenance.utils";
import type { PmDueStatus } from "./maintenance.utils";
import type { Asset, MaintenanceKpis, PmPlan } from "./maintenance.types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

const BUCKET_ORDER: PmDueStatus[] = ["OVERDUE", "DUE_SOON", "OK"];

export function PreventiveTab({
  plans,
  assets,
  kpis,
  refresh,
}: {
  plans: PmPlan[];
  assets: Asset[];
  kpis?: MaintenanceKpis;
  /** Refresca planes + órdenes + KPIs (generar una orden toca a las tres). */
  refresh: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PmPlan | null>(null);

  const active = useMemo(() => plans.filter((p) => p.active), [plans]);
  const paused = useMemo(() => plans.filter((p) => !p.active), [plans]);

  const buckets = useMemo(() => {
    const out: Record<PmDueStatus, PmPlan[]> = { OVERDUE: [], DUE_SOON: [], OK: [] };
    for (const p of active) out[pmDueStatus(p.nextDueDate)].push(p);
    for (const k of BUCKET_ORDER) out[k] = sortPmPlans(out[k]);
    return out;
  }, [active]);

  const compliance = kpis?.pmCompliance;

  return (
    <div className="space-y-6">
      {/* KPIs del programa preventivo (vivos, del backend) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Planes activos" value={kpis?.pmPlansActive ?? active.length} sub="preventivos programados" color={COLORS.blue} />
        <Kpi label="Vencidos" value={kpis?.pmOverdue ?? buckets.OVERDUE.length} sub={(kpis?.pmOverdue ?? buckets.OVERDUE.length) > 0 ? "generar orden" : "al día"} color={(kpis?.pmOverdue ?? buckets.OVERDUE.length) > 0 ? COLORS.red : COLORS.green} />
        <Kpi label="Por vencer" value={kpis?.pmDueSoon ?? buckets.DUE_SOON.length} sub="próximos 7 días" color={(kpis?.pmDueSoon ?? buckets.DUE_SOON.length) > 0 ? COLORS.amber : COLORS.green} />
        <Kpi label="% PM cumplido" value={compliance == null ? "—" : `${compliance}%`} sub="órdenes preventivas" color={COLORS.violet} />
      </div>

      {/* Encabezado + alta */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-gray-400" /> Agenda de preventivos
        </h3>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white"
          style={{ background: COLORS.blue }}
        >
          <Plus className="w-4 h-4" /> Programar preventivo
        </button>
      </div>

      {plans.length === 0 ? (
        <div className={`${glass} rounded-2xl`}>
          <Empty
            icon={<CalendarClock className="w-7 h-7" />}
            title="Programa tu primer preventivo"
            body="Define una tarea recurrente por activo (cada N días/semanas/meses). El sistema calcula la próxima fecha, te avisa cuando vence y genera la orden de trabajo con un clic."
            cta={
              <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: COLORS.blue }}>
                <Plus className="w-4 h-4" /> Programar preventivo
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {BUCKET_ORDER.map((key) => {
            const items = buckets[key];
            if (items.length === 0) return null;
            const meta = PM_STATUS_META[key];
            return (
              <section key={key}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />
                  <h4 className="text-sm font-semibold">{meta.label}</h4>
                  <span className="text-[11px] text-gray-400">({items.length})</span>
                </div>
                <div className="space-y-2.5">
                  {items.map((p) => (
                    <PmPlanRow key={p.id} plan={p} onEdit={() => setEditing(p)} onChanged={refresh} />
                  ))}
                </div>
              </section>
            );
          })}

          {paused.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.gray }} />
                <h4 className="text-sm font-semibold text-gray-500">En pausa</h4>
                <span className="text-[11px] text-gray-400">({paused.length})</span>
              </div>
              <div className="space-y-2.5">
                {paused.map((p) => (
                  <PmPlanRow key={p.id} plan={p} onEdit={() => setEditing(p)} onChanged={refresh} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {creating && <PmPlanFormModal assets={assets} onClose={() => setCreating(false)} onSaved={refresh} />}
      {editing && <PmPlanFormModal assets={assets} plan={editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
}

function PmPlanRow({
  plan,
  onEdit,
  onChanged,
}: {
  plan: PmPlan;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const status = pmDueStatus(plan.nextDueDate);
  const dueColor = status === "OVERDUE" ? COLORS.red : status === "DUE_SOON" ? COLORS.amber : COLORS.green;
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{plan.title}</span>
            {plan.active ? <PmStatusPill status={status} /> : <Pill label="En pausa" color={COLORS.gray} dot />}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[12px] text-gray-400 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="w-3 h-3" />
              {pmFrequencyLabel(plan.frequencyType, plan.frequencyValue)}
            </span>
            {plan.assetName && <span className="inline-flex items-center gap-1"><Wrench className="w-3 h-3" />{plan.assetName}</span>}
            {plan.assignedTo && <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{plan.assignedTo}</span>}
            <span className="inline-flex items-center gap-1" style={plan.active ? { color: dueColor } : undefined}>
              {plan.active ? dueLabel(plan.nextDueDate) : `Próxima ${fmtDate(plan.nextDueDate)}`}
            </span>
            {plan.lastDoneDate && <span>Última: {fmtDate(plan.lastDoneDate)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {plan.active && <GeneratePmOrderButton plan={plan} onDone={onChanged} />}
          <PauseToggle plan={plan} onChanged={onChanged} />
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-400" title="Editar preventivo">
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PauseToggle({ plan, onChanged }: { plan: PmPlan; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/maintenance/pm-plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !plan.active }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo actualizar.", "Mantenimiento");
        return;
      }
      toast.success(plan.active ? "Preventivo en pausa." : "Preventivo reactivado.", "Mantenimiento");
      onChanged();
    } catch {
      toast.error("Error de red.", "Mantenimiento");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-60"
      style={{ color: plan.active ? COLORS.gray : COLORS.green }}
      title={plan.active ? "Pausar" : "Reactivar"}
    >
      {plan.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      {plan.active ? "Pausar" : "Reactivar"}
    </button>
  );
}
