'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Server,
  Gauge,
  ShieldCheck,
  Loader2,
  Save,
  Cpu,
  Activity,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { glass } from '@/lib/glass';

interface AiConfig {
  tenantId: string;
  enabled: boolean;
  defaultModel: string;
  escalationModel: string;
  monthlyTokenBudget: number;
  tokensUsedThisPeriod: number;
  rateLimitPerHour: number;
  periodStart: string | null;
  autoEscalate: boolean;
  autoEscalateSource: 'tenant' | 'default';
  knowledge: string;
  engine: {
    name: string;
    selfHosted: boolean;
    baseUrl: string;
    apiKeyConfigured: boolean;
  };
  mock: boolean;
  availableModels: string[];
}

interface UsageRow {
  id: string;
  model: string;
  userEmail: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  mock: boolean;
  usedByoKey: boolean;
  toolCalls: number;
  createdAt: string;
}

interface Usage {
  totals: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    turns: number;
  };
  byModel: Record<string, { turns: number; tokens: number; costUsd: number }>;
  recent: UsageRow[];
}

interface EngineHealth {
  mock: boolean;
  baseUrl: string;
  apiKeyConfigured: boolean;
  activeModel: string;
  reachable: boolean;
  models: string[];
  modelAvailable: boolean;
  message: string;
  error?: string;
}

const fmtNum = (n: number) => Number(n || 0).toLocaleString();

export default function AiAdminPage() {
  const [cfg, setCfg] = useState<AiConfig | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [health, setHealth] = useState<EngineHealth | null>(null);
  const [probing, setProbing] = useState(false);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function probe() {
    setProbing(true);
    try {
      const res = await fetch('/api/ai/health', { cache: 'no-store' });
      if (res.ok) setHealth(await res.json());
    } catch {
      /* keep the last known status on a transient network error */
    } finally {
      setProbing(false);
    }
  }

  useEffect(() => {
    async function load() {
      const [c, u] = await Promise.all([
        fetch('/api/ai/config', { cache: 'no-store' }),
        fetch('/api/ai/usage', { cache: 'no-store' }),
      ]);
      if (c.status === 401 || c.status === 403) {
        setDenied(true);
        setLoading(false);
        return;
      }
      setCfg(await c.json());
      if (u.ok) setUsage(await u.json());
      setLoading(false);
      void probe();
    }
    load().catch(() => setLoading(false));
  }, []);

  async function patch(body: Record<string, unknown>, note: string) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setCfg(data);
        setMsg(note);
      } else {
        setMsg(data?.message || 'No se pudo guardar.');
      }
    } catch {
      setMsg('Error de red al guardar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
      </div>
    );
  }

  if (denied || !cfg) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-lg font-semibold">Acceso restringido</p>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Solo un administrador puede configurar CIDE.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-violet-600 underline">
          Volver
        </Link>
      </div>
    );
  }

  const usedPct = cfg.monthlyTokenBudget
    ? Math.min(100, (cfg.tokensUsedThisPeriod / cfg.monthlyTokenBudget) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Configuración de CIDE</h1>
          <p className="text-sm text-black/55 dark:text-white/55">
            IA propia · modelo open-source self-hosted
          </p>
        </div>
      </div>

      {/* Status banner */}
      <div className={`${glass} mb-6 rounded-2xl p-4 text-sm`}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Estado:{' '}
            <strong>{cfg.enabled ? 'Habilitada' : 'Deshabilitada'}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Server className="h-4 w-4 text-indigo-500" />
            Motor: <strong>{cfg.engine.selfHosted ? 'self-hosted' : 'externo'}</strong>
          </span>
          <span>
            Modelo activo: <strong>{cfg.defaultModel}</strong>
          </span>
          {cfg.mock && (
            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300">
              modo demo (AI_MOCK)
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-2">
            <ConnectivityPill health={health} probing={probing} />
            <button
              onClick={() => void probe()}
              disabled={probing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${probing ? 'animate-spin' : ''}`}
              />
              Probar conexión
            </button>
          </span>
        </div>
        {health && !health.mock && (
          <p
            className={`mt-2 text-xs ${
              health.reachable && health.modelAvailable
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {health.message}
            {health.reachable && health.models.length > 0 && (
              <> Modelos cargados: {health.models.join(', ')}.</>
            )}
          </p>
        )}
        <p className="mt-2 text-xs text-black/50 dark:text-white/50">
          CIDE corre en tu propia infraestructura ({cfg.engine.baseUrl}) sobre un
          modelo open-source. No se usa ningún proveedor externo de IA y los
          datos nunca salen de tus servidores. El tope mensual es una guardia de
          capacidad, no un costo.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Engine + models */}
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Cpu className="h-4 w-4 text-violet-500" /> Motor y modelos
          </h2>

          <label className="mb-3 flex items-center justify-between text-sm">
            <span>CIDE habilitado</span>
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) =>
                patch({ enabled: e.target.checked }, 'Estado actualizado.')
              }
              className="h-4 w-4 accent-violet-600"
            />
          </label>

          <div className="mb-4 rounded-lg border border-black/10 bg-white/40 px-3 py-2.5 text-xs dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <span className="text-black/55 dark:text-white/55">Endpoint</span>
              <span className="font-mono">{cfg.engine.baseUrl}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-black/55 dark:text-white/55">
                Token de motor
              </span>
              <span>
                {cfg.engine.apiKeyConfigured ? 'configurado' : 'no requerido'}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-black/45 dark:text-white/45">
              Se ajusta por variables de entorno (CIDE_BASE_URL / CIDE_API_KEY),
              no desde aquí.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-black/55 dark:text-white/55">
                Modelo por defecto
              </label>
              <select
                value={cfg.defaultModel}
                onChange={(e) =>
                  patch(
                    { defaultModel: e.target.value },
                    'Modelo actualizado.',
                  )
                }
                className="w-full rounded-lg border border-black/10 bg-white/60 px-2 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              >
                {cfg.availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-black/55 dark:text-white/55">
                Modelo de escalación
              </label>
              <select
                value={cfg.escalationModel}
                onChange={(e) =>
                  patch(
                    { escalationModel: e.target.value },
                    'Modelo actualizado.',
                  )
                }
                className="w-full rounded-lg border border-black/10 bg-white/60 px-2 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              >
                {cfg.availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="mt-4 flex items-start justify-between gap-3 text-sm">
            <span>
              Escalado automático de modelo
              <span className="mt-0.5 block text-[11px] text-black/45 dark:text-white/45">
                Las consultas analíticas usan el modelo de escalación
                automáticamente. Requiere que el motor sirva ese modelo.
                {cfg.autoEscalateSource === 'default' && ' (heredado del entorno)'}
              </span>
            </span>
            <input
              type="checkbox"
              checked={cfg.autoEscalate}
              onChange={(e) =>
                patch(
                  { autoEscalate: e.target.checked },
                  'Escalado automático actualizado.',
                )
              }
              className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600"
            />
          </label>
        </section>

        {/* Budget + limits */}
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Gauge className="h-4 w-4 text-violet-500" /> Uso y límites
          </h2>

          <label className="mb-1 block text-xs text-black/55 dark:text-white/55">
            Tope mensual de uso (tokens)
          </label>
          <BudgetEditor
            value={cfg.monthlyTokenBudget}
            disabled={saving}
            onSave={(v) =>
              patch({ monthlyTokenBudget: v }, 'Tope actualizado.')
            }
          />

          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-black/55 dark:text-white/55">
              <span>Consumo del periodo</span>
              <span>
                {fmtNum(cfg.tokensUsedThisPeriod)} /{' '}
                {fmtNum(cfg.monthlyTokenBudget)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                style={{ width: `${usedPct}%` }}
              />
            </div>
          </div>

          <label className="mb-1 mt-4 block text-xs text-black/55 dark:text-white/55">
            Límite de consultas por hora (por usuario)
          </label>
          <BudgetEditor
            value={cfg.rateLimitPerHour}
            disabled={saving}
            onSave={(v) =>
              patch({ rateLimitPerHour: v }, 'Límite actualizado.')
            }
          />
        </section>
      </div>

      {/* Company knowledge — teach CIDE */}
      <section className={`${glass} mt-6 rounded-2xl p-5`}>
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-violet-500" /> Conocimiento de la
          empresa
        </h2>
        <p className="mb-3 text-xs text-black/55 dark:text-white/55">
          Enséñale a CIDE el contexto propio de tu organización: políticas,
          definiciones, abreviaturas, FAQs, objetivos. Lo usará como contexto
          autoritativo al responder (no sustituye los datos reales de los
          módulos). Máximo 8000 caracteres.
        </p>
        <KnowledgeEditor
          value={cfg.knowledge ?? ''}
          disabled={saving}
          onSave={(v) => patch({ knowledge: v }, 'Conocimiento actualizado.')}
        />
      </section>

      {/* Usage */}
      <section className={`${glass} mt-6 rounded-2xl p-5`}>
        <h2 className="mb-4 text-sm font-semibold">Uso (tokens)</h2>
        {usage ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Consultas" value={fmtNum(usage.totals.turns)} />
              <Stat
                label="Tokens entrada"
                value={fmtNum(usage.totals.inputTokens)}
              />
              <Stat
                label="Tokens salida"
                value={fmtNum(usage.totals.outputTokens)}
              />
              <Stat
                label="Tokens totales"
                value={fmtNum(
                  usage.totals.inputTokens + usage.totals.outputTokens,
                )}
              />
            </div>

            {usage.recent.length > 0 && (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-black/50 dark:text-white/50">
                    <tr>
                      <th className="py-1 pr-3">Fecha</th>
                      <th className="py-1 pr-3">Usuario</th>
                      <th className="py-1 pr-3">Modelo</th>
                      <th className="py-1 pr-3">Tokens</th>
                      <th className="py-1">Origen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.recent.map((r) => (
                      <tr
                        key={r.id}
                        className="border-t border-black/5 dark:border-white/5"
                      >
                        <td className="py-1.5 pr-3">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                        <td className="py-1.5 pr-3">{r.userEmail}</td>
                        <td className="py-1.5 pr-3">{r.model}</td>
                        <td className="py-1.5 pr-3">
                          {fmtNum(r.inputTokens + r.outputTokens)}
                        </td>
                        <td className="py-1.5">{r.mock ? 'demo' : 'CIDE'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-black/55 dark:text-white/55">
            Aún no hay uso registrado.
          </p>
        )}
      </section>

      {msg && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
          <Save className="h-4 w-4" /> {msg}
        </p>
      )}
    </div>
  );
}

function ConnectivityPill({
  health,
  probing,
}: {
  health: EngineHealth | null;
  probing: boolean;
}) {
  if (probing && !health) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-black/5 px-2 py-0.5 text-xs font-medium text-black/55 dark:bg-white/10 dark:text-white/55">
        <Activity className="h-3.5 w-3.5 animate-pulse" /> probando…
      </span>
    );
  }
  if (!health) return null;
  if (health.mock) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300">
        <Activity className="h-3.5 w-3.5" /> sin motor (demo)
      </span>
    );
  }
  const ok = health.reachable && health.modelAvailable;
  const warn = health.reachable && !health.modelAvailable;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${
        ok
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
          : warn
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
            : 'bg-red-500/15 text-red-600 dark:text-red-300'
      }`}
    >
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {ok ? 'motor en línea' : warn ? 'motor sin modelo' : 'motor inaccesible'}
    </span>
  );
}

function KnowledgeEditor({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled: boolean;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setV(value);
  }
  return (
    <div>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value.slice(0, 8000))}
        rows={8}
        placeholder={
          'Ej.: Facturamos los viernes. "OTD" = On-Time Delivery, objetivo 95%.\n' +
          'El cliente A exige FAI por lote. La línea 3 es SMT de alta mezcla…'
        }
        className="w-full resize-y rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-black/45 dark:text-white/45">
          {v.length}/8000
        </span>
        <button
          onClick={() => onSave(v)}
          disabled={disabled || v === value}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-40"
        >
          Guardar conocimiento
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/5 px-3 py-2.5 dark:bg-white/5">
      <p className="text-[11px] text-black/50 dark:text-white/50">{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}

function BudgetEditor({
  value,
  disabled,
  onSave,
}: {
  value: number;
  disabled: boolean;
  onSave: (v: number) => void;
}) {
  const [v, setV] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  // Sync external value → local input during render (no effect needed).
  if (value !== lastValue) {
    setLastValue(value);
    setV(String(value));
  }
  return (
    <div className="flex gap-2">
      <input
        type="number"
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="flex-1 rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/10 dark:bg-white/5"
      />
      <button
        onClick={() => onSave(Math.max(0, parseInt(v || '0', 10)))}
        disabled={disabled || v === String(value)}
        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-40"
      >
        Guardar
      </button>
    </div>
  );
}
