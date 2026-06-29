import type React from "react";
import Link from "next/link";
import {
  Bell,
  ChevronLeft,
  Clock,
  Factory,
  Wifi,
  WifiOff,
} from "lucide-react";
import { glass } from "@/lib/glass";

interface TopBarExecution {
  workOrder: string;
  model: string;
  line: number | null;
}

interface TopBarStep {
  name: string;
  status: string;
  starved: boolean;
  unitsTarget: number;
  unitsCompleted: number;
}

export function IndustrialTopBar({
  execution,
  currentStep,
  operator,
  shift,
  clock,
  socketStatus,
  alerts,
  gloveMode,
  onToggleGlove,
  onBack,
}: {
  execution: TopBarExecution | null;
  currentStep: TopBarStep | null;
  operator: string;
  shift: string;
  clock: string;
  socketStatus: string;
  alerts: number;
  gloveMode: boolean;
  onToggleGlove: () => void;
  onBack: (() => void) | null;
}) {
  const machine =
    currentStep?.status === "blocked"
      ? "Máquina bloqueada"
      : currentStep?.starved
        ? "Esperando flujo"
        : "Lista";
  const quality =
    currentStep?.status === "blocked" ? "Hold calidad" : "Calidad OK";

  return (
    <div
      className={`${glass} sticky top-0 z-40 border-x-0 border-t-0 rounded-none px-4 py-3 shadow-2xl`}
    >
      <div className="flex flex-wrap items-center gap-3">
        {onBack ? (
          <button
            onClick={onBack}
            className="min-h-12 rounded-2xl px-4 font-bold bg-white/10 hover:bg-white/15 active:scale-95 transition-all flex items-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" /> Órdenes
          </button>
        ) : (
          <Link
            href="/dashboard"
            className="min-h-12 rounded-2xl px-4 font-bold bg-white/10 hover:bg-white/15 active:scale-95 transition-all flex items-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" /> Dashboard
          </Link>
        )}
        <div className="flex items-center gap-2 font-black text-lg tracking-tight mr-auto">
          <Factory className="w-6 h-6 text-amber-400" /> AXOS MES Terminal
        </div>
        <StatusPill
          icon={<Clock className="w-4 h-4" />}
          label={clock}
          tone="neutral"
        />
        <StatusPill
          icon={
            socketStatus === "connected" ? (
              <Wifi className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )
          }
          label={
            socketStatus === "connected" ? "Online" : "Offline / cola local"
          }
          tone={socketStatus === "connected" ? "green" : "amber"}
        />
        <StatusPill
          icon={<Bell className="w-4 h-4" />}
          label={`${alerts} alertas`}
          tone={alerts > 0 ? "red" : "green"}
        />
        <button
          onClick={onToggleGlove}
          className={`min-h-12 rounded-2xl px-4 font-black transition-all ${gloveMode ? "bg-amber-400 text-slate-950" : "bg-white/10"}`}
        >
          Guantes {gloveMode ? "ON" : "OFF"}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-9 gap-2 text-xs">
        <InfoCell label="Operador" value={operator} />
        <InfoCell label="Turno" value={shift} />
        <InfoCell
          label="Línea"
          value={execution?.line ? `Línea ${execution.line}` : "—"}
        />
        <InfoCell label="Estación" value={currentStep?.name ?? "Sin montar"} />
        <InfoCell label="WO" value={execution?.workOrder ?? "—"} />
        <InfoCell label="Modelo" value={execution?.model ?? "—"} />
        <InfoCell
          label="Tiempo restante"
          value={
            currentStep
              ? `${Math.max(0, currentStep.unitsTarget - currentStep.unitsCompleted)} u`
              : "—"
          }
        />
        <InfoCell label="Máquina" value={machine} />
        <InfoCell label="Calidad" value={quality} />
      </div>
    </div>
  );
}

function StatusPill({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "green" | "amber" | "red" | "neutral";
}) {
  // Texto con contraste en AMBOS temas: el header usa `glass` (blanco translúcido
  // en claro), así que el texto claro -300/-200 quedaba invisible en modo claro.
  // -700 en claro / -300 en oscuro; el neutral pasa a tokens (`text-foreground`).
  const cls =
    tone === "green"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : tone === "amber"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : tone === "red"
          ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
          : "bg-foreground/5 text-foreground";
  return (
    <span
      className={`min-h-10 px-3 rounded-2xl flex items-center gap-2 text-xs font-black ${cls}`}
    >
      {icon}
      {label}
    </span>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.08] dark:bg-white/5 border border-white/10 px-3 py-2 min-h-14">
      <div className="text-[10px] uppercase tracking-widest text-slate-400">
        {label}
      </div>
      <div className="font-black truncate">{value}</div>
    </div>
  );
}
