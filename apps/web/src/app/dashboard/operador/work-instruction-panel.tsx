"use client";

import { useEffect, useState } from "react";
import {
  BookOpenCheck,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Minimize2,
  PlaySquare,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import {
  isProtectedVisualAidUrl,
  resolveAidUrl,
  visualAidMode,
  type VisualAid,
  type VisualAidMode,
} from "./work-instruction-panel.utils";

export type { VisualAid } from "./work-instruction-panel.utils";

function useRenderableAidUrl(sourceHref: string | null) {
  const [href, setHref] = useState<string | null>(() =>
    sourceHref && isProtectedVisualAidUrl(sourceHref) ? null : sourceHref,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setHref(sourceHref);
    setLoading(false);
    setError(false);

    if (!sourceHref || !isProtectedVisualAidUrl(sourceHref)) {
      return () => undefined;
    }

    setHref(null);
    setLoading(true);

    apiFetch(sourceHref)
      .then(async (response) => {
        if (!response.ok) throw new Error("visual-aid-fetch");
        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setHref(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sourceHref]);

  return { href, loading, error };
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
  const sourceHref = resolveAidUrl(aid, apiBase);
  const { href, loading, error } = useRenderableAidUrl(sourceHref);
  const mode = visualAidMode(aid, href ?? sourceHref);
  const version = aid?.version || aid?.revision || "versión vigente";
  const backupHref =
    href ?? (sourceHref && !isProtectedVisualAidUrl(sourceHref) ? sourceHref : null);
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
        {backupHref ? (
          <a
            href={backupHref}
            target="_blank"
            rel="noreferrer"
            className="min-h-10 rounded-2xl bg-white/10 px-3 text-xs font-black flex items-center gap-1.5 hover:bg-white/15 transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Respaldo
          </a>
        ) : sourceHref ? (
          <button
            disabled
            className="min-h-10 rounded-2xl bg-white/10 px-3 text-xs font-black flex items-center gap-1.5 opacity-60"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4" />
            )}
            Respaldo
          </button>
        ) : null}
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
        <EmbeddedAid
          aid={aid}
          href={href}
          mode={mode}
          expanded={expanded}
          loading={loading}
          error={error}
        />
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
  loading,
  error,
}: {
  aid: VisualAid | null;
  href: string | null;
  mode: VisualAidMode;
  expanded: boolean;
  loading: boolean;
  error: boolean;
}) {
  const frameClass = expanded
    ? "h-full min-h-[480px]"
    : "aspect-video max-h-[420px]";
  if (loading) {
    return (
      <div
        className={`${frameClass} rounded-2xl bg-gray-100 dark:bg-white/5 grid place-items-center text-gray-500 text-sm`}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
          Cargando ayuda visual controlada
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div
        className={`${frameClass} rounded-2xl bg-rose-500/10 grid place-items-center p-6 text-center text-rose-700 dark:text-rose-200`}
      >
        <div className="max-w-sm space-y-2">
          <ImageIcon className="mx-auto w-7 h-7" />
          <div className="text-sm font-black">No se pudo cargar la ayuda visual</div>
          <p className="text-xs opacity-80">
            Verifica tu sesiÃ³n o pide a ingenierÃ­a confirmar que el archivo sigue vigente.
          </p>
        </div>
      </div>
    );
  }
  if (!aid || !href) {
    return (
      <div
        className={`${frameClass} rounded-2xl bg-gray-100 dark:bg-white/5 grid place-items-center text-gray-500 dark:text-gray-400 text-sm`}
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
