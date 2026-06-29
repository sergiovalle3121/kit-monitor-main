import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Loader2,
  PackagePlus,
} from "lucide-react";
import { glass } from "@/lib/glass";

export function OperatorActionBar({
  blocked,
  currentStepStatus,
  onOpenSheet,
  onRequestMaterial,
  materialRequestBusy = false,
  materialRequestDisabled = false,
}: {
  blocked: boolean;
  currentStepStatus: string | null;
  onOpenSheet: (sheet: "confirm" | "incident" | "andon") => void;
  onRequestMaterial: () => void;
  materialRequestBusy?: boolean;
  materialRequestDisabled?: boolean;
}) {
  const confirmDisabled = blocked || currentStepStatus === "completed";

  return (
    <div
      className={`${glass} fixed bottom-4 left-1/2 -translate-x-1/2 z-30 px-3 py-3 rounded-[2rem] shadow-2xl flex items-center gap-2 w-[min(920px,94vw)]`}
    >
      <button
        onClick={() => onOpenSheet("confirm")}
        disabled={confirmDisabled}
        className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 text-white text-xl font-black px-6 py-6 rounded-3xl hover:bg-emerald-600 active:scale-[0.98] transition-all disabled:opacity-40"
      >
        <CheckCircle2 className="w-5 h-5" /> Confirmar avance
      </button>
      <button
        onClick={() => onOpenSheet("incident")}
        className="flex items-center justify-center gap-2 bg-rose-500/10 text-rose-600 text-base font-black px-5 py-6 rounded-3xl hover:bg-rose-500/20 active:scale-95 transition-all"
      >
        <AlertTriangle className="w-5 h-5" />{" "}
        <span className="hidden sm:inline">Incidente</span>
      </button>
      <button
        onClick={onRequestMaterial}
        disabled={materialRequestBusy || materialRequestDisabled}
        className="flex items-center justify-center gap-2 bg-sky-500/10 text-sky-700 text-base font-black px-5 py-6 rounded-3xl hover:bg-sky-500/20 active:scale-95 transition-all disabled:opacity-40"
      >
        {materialRequestBusy ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <PackagePlus className="w-5 h-5" />
        )}{" "}
        <span className="hidden sm:inline">Material</span>
      </button>
      <button
        onClick={() => onOpenSheet("andon")}
        className="flex items-center justify-center gap-2 bg-amber-500/10 text-amber-700 text-base font-black px-5 py-6 rounded-3xl hover:bg-amber-500/20 active:scale-95 transition-all"
      >
        <Bell className="w-5 h-5" />{" "}
        <span className="hidden sm:inline">Andon</span>
      </button>
    </div>
  );
}
