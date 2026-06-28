"use client";

import { useState } from "react";
import {
  BookOpenCheck,
  ExternalLink,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  PlaySquare,
} from "lucide-react";

export interface VisualAid {
  kind: "image" | "pdf" | "office" | "video" | "cad";
  id: string;
  title?: string;
  fileUrl?: string;
  documentUrl?: string;
  version?: string;
  revision?: string;
  updatedAt?: string;
}

function resolveAidUrl(aid: VisualAid | null, apiBase: string) {
  if (!aid) return null;
  const url = aid.fileUrl || aid.documentUrl || null;
  if (!url) return null;
  return url.startsWith("http") ? url : `${apiBase}${url}`;
}

function visualAidMode(aid: VisualAid | null, href: string | null) {
  const url = href?.toLowerCase() ?? "";
  if (!aid) return "empty" as const;
  if (aid.kind === "video" || /\.(mp4|webm|mov)(\?|$)/.test(url))
    return "video" as const;
  if (aid.kind === "image" || /\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(url))
    return "image" as const;
  if (aid.kind === "pdf" || /\.pdf(\?|$)/.test(url)) return "pdf" as const;
  if (
    aid.kind === "cad" ||
    /\.(step|stp|iges|igs|dxf|dwg|stl|obj)(\?|$)/.test(url)
  )
    return "cad" as const;
  return "office" as const;
}

export function WorkInstructionPanel({
  aid,
  instructions,
  stepName,
  apiBase,
}: {
  aid: VisualAid | null;
  instructions: string | null;
  stepName: string;
  apiBase: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const href = resolveAidUrl(aid, apiBase);
  const mode = visualAidMode(aid, href);
  const version = aid?.version || aid?.revision || "versión vigente";
  const container = expanded
    ? "fixed inset-4 z-[60] rounded-[2rem] bg-slate-950/95 p-4 shadow-2xl"
    : "";
  return (
    <div className={container}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 text-sm font-black">
          <BookOpenCheck className="w-4 h-4 text-amber-400" /> Instrucción de
          trabajo
        </span>
        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-300">
          {mode === "empty" ? "sin archivo" : mode}
        </span>
        <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
          {version}
        </span>
        <span className="ml-auto text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          {stepName}
        </span>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="min-h-10 rounded-2xl bg-white/10 px-3 text-xs font-black flex items-center gap-1.5 hover:bg-white/15 transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Respaldo
          </a>
        )}
        <button
          onClick={() => setExpanded((value) => !value)}
          className="min-h-10 rounded-2xl bg-white/10 px-3 text-xs font-black flex items-center gap-1.5 hover:bg-white/15 active:scale-95 transition-all"
        >
          {expanded ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
          {expanded ? "Compactar" : "Ampliar"}
        </button>
      </div>

      <div
        className={
          expanded
            ? "grid h-[calc(100%-3.5rem)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4"
            : "space-y-3"
        }
      >
        <EmbeddedAid aid={aid} href={href} mode={mode} expanded={expanded} />
        <div
          className={`${expanded ? "overflow-y-auto rounded-3xl bg-white/5 p-4" : ""}`}
        >
          {instructions ? (
            <div className="rounded-2xl bg-amber-500/10 p-4 text-sm leading-6 text-gray-700 dark:text-gray-200 whitespace-pre-line">
              {instructions}
            </div>
          ) : (
            <div className="rounded-2xl bg-white/5 p-4 text-sm text-gray-500">
              No hay instrucciones textuales para este paso. Usa la ayuda visual
              embebida o solicita ingeniería si falta el documento controlado.
            </div>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-widest text-gray-500">
            <div className="rounded-2xl bg-white/5 p-2">Controlado</div>
            <div className="rounded-2xl bg-white/5 p-2">Embebido</div>
            <div className="rounded-2xl bg-white/5 p-2">
              Sin cambio de pantalla
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmbeddedAid({
  aid,
  href,
  mode,
  expanded,
}: {
  aid: VisualAid | null;
  href: string | null;
  mode: ReturnType<typeof visualAidMode>;
  expanded: boolean;
}) {
  const frameClass = expanded
    ? "h-full min-h-[480px]"
    : "aspect-video max-h-[420px]";
  if (!aid || !href) {
    return (
      <div
        className={`${frameClass} rounded-2xl bg-gray-100 dark:bg-white/5 grid place-items-center text-gray-400 text-sm`}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <ImageIcon className="w-7 h-7" />
          Sin ayuda visual ligada a este paso
        </div>
      </div>
    );
  }
  if (mode === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={href}
        alt={aid.title || "Ayuda visual"}
        className={`${frameClass} w-full object-contain rounded-2xl bg-gray-50 dark:bg-white/5`}
      />
    );
  }
  if (mode === "video") {
    return (
      <video
        src={href}
        controls
        playsInline
        className={`${frameClass} w-full rounded-2xl bg-black object-contain`}
      />
    );
  }
  if (mode === "cad") {
    return (
      <div
        className={`${frameClass} rounded-2xl bg-slate-900 grid place-items-center p-6 text-center text-slate-200`}
      >
        <div className="max-w-md space-y-3">
          <PlaySquare className="mx-auto w-9 h-9 text-amber-400" />
          <div className="text-lg font-black">CAD / modelo técnico ligado</div>
          <p className="text-sm text-slate-400">
            El visor 3D embebido requiere el contrato de CAD del siguiente
            slice; el archivo queda disponible aquí sin abandonar la terminal.
          </p>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-2xl bg-amber-400 px-4 text-sm font-black text-slate-950"
          >
            Abrir archivo controlado
          </a>
        </div>
      </div>
    );
  }
  return (
    <iframe
      title={aid.title || "Ayuda visual embebida"}
      src={href}
      className={`${frameClass} w-full rounded-2xl border border-white/10 bg-white`}
      loading="lazy"
    />
  );
}
