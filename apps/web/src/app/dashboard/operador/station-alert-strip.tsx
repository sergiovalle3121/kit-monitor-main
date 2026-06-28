"use client";

import { useState } from "react";
import { Bell, Loader2, Package } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/contexts/ToastContext";

interface StripAndon {
  id: number;
  type: string;
  status: string;
  responseRole?: string | null;
}

interface StripMaterialRequest {
  id: number;
  status: string;
}

export function StationAlertStrip({
  andons,
  materialRequests,
  apiBase,
  refresh,
}: {
  andons: StripAndon[];
  materialRequests: StripMaterialRequest[];
  apiBase: string;
  refresh: () => void;
}) {
  const activeAndons = andons.filter((andon) => andon.status !== "resolved");
  const [busyAndon, setBusyAndon] = useState<string | null>(null);
  const toast = useToast();

  async function updateAndon(id: number, action: "ack" | "resolve") {
    setBusyAndon(`${id}:${action}`);
    try {
      const res = await apiFetch(`${apiBase}/mes/andon/${id}/${action}`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(
          typeof j.message === "string"
            ? j.message
            : "No se pudo actualizar el Andon.",
          "Andon",
        );
        return;
      }
      refresh();
    } catch {
      toast.error("No se pudo contactar el backend para actualizar Andon.", "Andon");
    } finally {
      setBusyAndon(null);
    }
  }

  if (activeAndons.length === 0 && materialRequests.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {activeAndons.map((andon) => {
        const ackBusy = busyAndon === `${andon.id}:ack`;
        const resolveBusy = busyAndon === `${andon.id}:resolve`;
        return (
          <span
            key={andon.id}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-rose-500/10 text-rose-600 flex items-center gap-1.5"
          >
            <Bell className="w-3.5 h-3.5" /> Andon {andon.type} · {andon.status}
            {andon.responseRole ? ` · ${andon.responseRole}` : ""}
            {andon.status === "open" && (
              <button
                onClick={() => updateAndon(andon.id, "ack")}
                disabled={!!busyAndon}
                className="ml-1 rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-black text-rose-700 disabled:opacity-50"
              >
                {ackBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : "ACK"}
              </button>
            )}
            <button
              onClick={() => updateAndon(andon.id, "resolve")}
              disabled={!!busyAndon}
              className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-black text-rose-700 disabled:opacity-50"
            >
              {resolveBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cerrar"}
            </button>
          </span>
        );
      })}
      {materialRequests.map((request) => (
        <span
          key={request.id}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-700 flex items-center gap-1.5"
        >
          <Package className="w-3.5 h-3.5" /> Surtido #{request.id} ·{" "}
          {request.status}
        </span>
      ))}
    </div>
  );
}
