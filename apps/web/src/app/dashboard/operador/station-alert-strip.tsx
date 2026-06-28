import { Bell, Package } from "lucide-react";

interface StripAndon {
  id: number;
  type: string;
  status: string;
}

interface StripMaterialRequest {
  id: number;
  status: string;
}

export function StationAlertStrip({
  andons,
  materialRequests,
}: {
  andons: StripAndon[];
  materialRequests: StripMaterialRequest[];
}) {
  const activeAndons = andons.filter((andon) => andon.status !== "resolved");

  if (activeAndons.length === 0 && materialRequests.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {activeAndons.map((andon) => (
        <span
          key={andon.id}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-rose-500/10 text-rose-600 flex items-center gap-1.5"
        >
          <Bell className="w-3.5 h-3.5" /> Andon {andon.type} · {andon.status}
        </span>
      ))}
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
