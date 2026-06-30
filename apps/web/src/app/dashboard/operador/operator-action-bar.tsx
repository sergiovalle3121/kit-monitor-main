import { AlertTriangle, Bell, CheckCircle2, Package } from "lucide-react";
import { glass } from "@/lib/glass";

type OperatorSheet = "confirm" | "incident" | "andon" | "material";

export function OperatorActionBar({
  blocked,
  currentStepStatus,
  onOpenSheet,
}: {
  blocked: boolean;
  currentStepStatus: string | null;
  onOpenSheet: (sheet: OperatorSheet) => void;
}) {
  const confirmDisabled = blocked || currentStepStatus === "completed";

  return (
    <div
      className={`${glass} fixed bottom-4 left-1/2 -translate-x-1/2 z-30 px-3 py-3 rounded-[2rem] shadow-2xl flex items-center gap-1.5 sm:gap-2 w-[min(920px,94vw)]`}
    >
      <button
        onClick={() => onOpenSheet("confirm")}
        disabled={confirmDisabled}
        className="min-w-0 flex-[1.4] flex items-center justify-center gap-2 bg-emerald-700 text-white text-sm sm:text-xl font-black px-3 sm:px-6 py-5 sm:py-6 rounded-3xl hover:bg-emerald-800 active:scale-[0.98] transition-all disabled:opacity-40"
      >
        <CheckCircle2 className="w-5 h-5 shrink-0" />{" "}
        <span className="truncate">
          <span className="sm:hidden">Avance</span>
          <span className="hidden sm:inline">Confirmar avance</span>
        </span>
      </button>
      <button
        onClick={() => onOpenSheet("material")}
        className="flex items-center justify-center gap-2 bg-amber-500/10 text-amber-700 text-base font-black px-3 sm:px-5 py-5 sm:py-6 rounded-3xl hover:bg-amber-500/20 active:scale-95 transition-all"
      >
        <Package className="w-5 h-5" />{" "}
        <span className="hidden sm:inline">Material</span>
      </button>
      <button
        onClick={() => onOpenSheet("incident")}
        className="flex items-center justify-center gap-2 bg-rose-500/10 text-rose-600 text-base font-black px-3 sm:px-5 py-5 sm:py-6 rounded-3xl hover:bg-rose-500/20 active:scale-95 transition-all"
      >
        <AlertTriangle className="w-5 h-5" />{" "}
        <span className="hidden sm:inline">Incidente</span>
      </button>
      <button
        onClick={() => onOpenSheet("andon")}
        className="flex items-center justify-center gap-2 bg-orange-500/10 text-orange-700 text-base font-black px-3 sm:px-5 py-5 sm:py-6 rounded-3xl hover:bg-orange-500/20 active:scale-95 transition-all"
      >
        <Bell className="w-5 h-5" />{" "}
        <span className="hidden sm:inline">Andon</span>
      </button>
    </div>
  );
}
