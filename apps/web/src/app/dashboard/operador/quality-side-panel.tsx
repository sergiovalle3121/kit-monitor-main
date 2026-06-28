import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { glass } from "@/lib/glass";

interface QualityPanelIncident {
  blocksFlow: boolean;
  description: string | null;
  ncrId?: string | null;
}

interface QualityPanelStep {
  scrapQty: number;
  segregatedQty: number;
}

interface QualityPanelBoard {
  steps: QualityPanelStep[];
  currentStepDetail: { openIncidents: QualityPanelIncident[] } | null;
}

const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const GRAY = "#6b7280";

export function QualitySidePanel({
  board,
  onOpenIncident,
}: {
  board: QualityPanelBoard;
  onOpenIncident: () => void;
}) {
  const incidents = board.currentStepDetail?.openIncidents ?? [];
  const scrap = board.steps.reduce((sum, step) => sum + step.scrapQty, 0);
  const rework = board.steps.reduce((sum, step) => sum + step.segregatedQty, 0);
  const blocking = incidents.filter((incident) => incident.blocksFlow).length;
  const evidenceReady = incidents.filter(
    (incident) => !!incident.description,
  ).length;
  const ncrOpen = incidents.filter((incident) => incident.ncrId).length;
  return (
    <aside className={`${glass} mt-5 rounded-3xl p-5`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-500 grid place-items-center">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="mr-auto">
          <h3 className="text-lg font-black tracking-tight">
            Calidad en línea
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Defectos, scrap, retrabajo, evidencia, firma y NCR rápido desde la
            estación.
          </p>
        </div>
        <button
          onClick={onOpenIncident}
          className="min-h-14 rounded-2xl bg-rose-500 px-5 text-sm font-black text-white hover:bg-rose-600 active:scale-95 transition-all"
        >
          + Defecto / NCR
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <QualityMetric
          label="Defectos abiertos"
          value={incidents.length}
          tone={incidents.length ? "red" : "green"}
        />
        <QualityMetric
          label="Bloqueos"
          value={blocking}
          tone={blocking ? "red" : "green"}
        />
        <QualityMetric
          label="Scrap"
          value={scrap}
          tone={scrap ? "amber" : "green"}
        />
        <QualityMetric
          label="Retrabajo"
          value={rework}
          tone={rework ? "amber" : "green"}
        />
        <QualityMetric
          label="NCR abiertos"
          value={ncrOpen}
          tone={ncrOpen ? "red" : "green"}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <QualityChecklistItem
          done={incidents.length > 0}
          label="Defecto clasificado"
        />
        <QualityChecklistItem
          done={evidenceReady > 0}
          label="Comentario / evidencia capturada"
        />
        <QualityChecklistItem
          done={ncrOpen > 0 || blocking === 0}
          label="NCR/hold visible para contención"
        />
      </div>
    </aside>
  );
}

function QualityMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "amber" | "red" | "neutral";
}) {
  const color =
    tone === "green"
      ? GREEN
      : tone === "amber"
        ? AMBER
        : tone === "red"
          ? RED
          : GRAY;
  return (
    <div className="rounded-3xl bg-white/5 p-4 border border-white/10">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-black tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function QualityChecklistItem({
  done,
  label,
}: {
  done: boolean;
  label: string;
}) {
  return (
    <div
      className={`rounded-2xl px-3 py-2 font-bold flex items-center gap-2 ${done ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}
    >
      {done ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <AlertTriangle className="w-4 h-4" />
      )}
      {label}
    </div>
  );
}
