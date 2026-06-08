"use client";

import React, { useMemo, useState } from "react";
import { Loader2, Lock, Inbox, Search, FileText, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/contexts/ToastContext";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

interface VisualAid {
  id: string;
  model: string;
  title: string;
  process?: string | null;
  area?: string | null;
  revision?: string | null;
  pdfUrl: string; // nombre de archivo → /visual-aids/file/:filename
  isActive?: boolean;
}

export default function VisualAidsPage() {
  const toast = useToast();
  const { data, isLoading, forbidden } = useApi<VisualAid[]>("/visual-aids");
  const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [q, setQ] = useState("");
  const [opening, setOpening] = useState<string | null>(null);

  const rows = q
    ? all.filter((a) => `${a.title} ${a.model} ${a.process ?? ""} ${a.area ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    : all;

  // El PDF va con JWT en header → no se puede usar <a href> directo (daría 401).
  // Se abre una pestaña en el gesto (evita bloqueo de popups), se baja el blob
  // autenticado y se navega a su object URL.
  async function viewPdf(aid: VisualAid) {
    if (!aid.pdfUrl) {
      toast.error("Esta ayuda no tiene archivo asociado.", "Ayudas visuales");
      return;
    }
    const win = window.open("", "_blank");
    setOpening(aid.id);
    try {
      const res = await apiFetch(`${API_BASE}/visual-aids/file/${encodeURIComponent(aid.pdfUrl)}`);
      if (!res.ok) {
        win?.close();
        toast.error("No se pudo abrir el PDF.", "Ayudas visuales");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url;
      else window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      win?.close();
      toast.error("Error de red al abrir el PDF.", "Ayudas visuales");
    } finally {
      setOpening(null);
    }
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-4xl mx-auto px-6 pt-10">
        <PageHeader domain="engineering" title="Ayudas visuales" subtitle="Instrucciones de trabajo (PDF) por modelo y proceso" icon={FileText} />

        {!forbidden && !isLoading && all.length > 0 && (
          <div className={`${glass} flex items-center gap-2 px-4 py-2.5 rounded-2xl mb-5`}>
            <Search className="w-4 h-4 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título, modelo o proceso…" className="bg-transparent outline-none text-sm w-full" />
          </div>
        )}

        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
        ) : isLoading ? (
          <div className="flex justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <Empty icon={<Inbox className="w-6 h-6" />} title={all.length === 0 ? "Sin ayudas visuales" : "Sin coincidencias"} body={all.length === 0 ? "Las instrucciones de trabajo (PDF) por modelo aparecerán aquí cuando ingeniería las cargue." : "Ninguna ayuda coincide con la búsqueda."} />
        ) : (
          <div className={`${glass} rounded-2xl p-2`}>
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {rows.map((a) => {
                const inactive = a.isActive === false;
                return (
                  <div key={a.id} className="flex items-center gap-3 px-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{a.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "#5b63e01f", color: "#5b63e0" }}>{a.model}</span>
                        {a.revision && <span className="text-[10px] font-mono text-gray-400">rev {a.revision}</span>}
                        {inactive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-400">inactiva</span>}
                      </div>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">{[a.process, a.area].filter(Boolean).join(" · ") || "—"}</p>
                    </div>
                    <button
                      onClick={() => viewPdf(a)}
                      disabled={opening === a.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium flex-shrink-0 disabled:opacity-50"
                      style={{ background: "rgba(91,99,224,0.12)", color: "#5b63e0" }}
                    >
                      {opening === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />} Ver PDF
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-400 mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{body}</p>
    </div>
  );
}
