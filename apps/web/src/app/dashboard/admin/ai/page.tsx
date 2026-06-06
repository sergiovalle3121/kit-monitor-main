'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  KeyRound,
  Gauge,
  ShieldCheck,
  Loader2,
  Save,
  Trash2,
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
  byoKey: { configured: boolean; last4: string | null };
  platformKeyAvailable: boolean;
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

const fmtNum = (n: number) => Number(n || 0).toLocaleString();
const fmtUsd = (n: number) => `$${Number(n || 0).toFixed(4)}`;

export default function AiAdminPage() {
  const [cfg, setCfg] = useState<AiConfig | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

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
          Solo un administrador puede configurar la IA.
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
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Configuración de IA</h1>
          <p className="text-sm text-black/55 dark:text-white/55">
            Axos Copilot · modelo híbrido de costo
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
          <span>
            Llave de plataforma:{' '}
            <strong>
              {cfg.platformKeyAvailable ? 'configurada' : 'no configurada'}
            </strong>
          </span>
          <span>
            Llave propia (BYO):{' '}
            <strong>
              {cfg.byoKey.configured
                ? `•••• ${cfg.byoKey.last4}`
                : 'no configurada'}
            </strong>
          </span>
          {cfg.mock && (
            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300">
              modo demo (AI_MOCK)
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-black/50 dark:text-white/50">
          Si esta organización tiene su propia llave (BYO), paga su propio
          consumo y no se le aplica presupuesto. Si no, usa la llave de
          plataforma con el tope mensual de abajo.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Provider + key */}
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-violet-500" /> Proveedor y llave
          </h2>

          <label className="mb-3 flex items-center justify-between text-sm">
            <span>Asistente habilitado</span>
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) =>
                patch({ enabled: e.target.checked }, 'Estado actualizado.')
              }
              className="h-4 w-4 accent-violet-600"
            />
          </label>

          <label className="mb-1 block text-xs text-black/55 dark:text-white/55">
            API key de Anthropic (BYO) — se guarda cifrada
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-ant-…"
              className="flex-1 rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5"
            />
            <button
              onClick={() => {
                if (keyInput.trim()) {
                  patch({ apiKey: keyInput.trim() }, 'Llave guardada.');
                  setKeyInput('');
                }
              }}
              disabled={saving || !keyInput.trim()}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              Guardar
            </button>
          </div>
          {cfg.byoKey.configured && (
            <button
              onClick={() => patch({ apiKey: '' }, 'Llave eliminada.')}
              disabled={saving}
              className="mt-2 inline-flex items-center gap-1 text-xs text-red-500 hover:underline"
            >
              <Trash2 className="h-3 w-3" /> Quitar llave (usar plataforma)
            </button>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
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
        </section>

        {/* Budget + limits */}
        <section className={`${glass} rounded-2xl p-5`}>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Gauge className="h-4 w-4 text-violet-500" /> Presupuesto y límites
          </h2>

          <label className="mb-1 block text-xs text-black/55 dark:text-white/55">
            Presupuesto mensual (tokens, llave de plataforma)
          </label>
          <BudgetEditor
            value={cfg.monthlyTokenBudget}
            disabled={saving}
            onSave={(v) =>
              patch({ monthlyTokenBudget: v }, 'Presupuesto actualizado.')
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

      {/* Usage */}
      <section className={`${glass} mt-6 rounded-2xl p-5`}>
        <h2 className="mb-4 text-sm font-semibold">Uso y costo (estimado)</h2>
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
              <Stat label="Costo estimado" value={fmtUsd(usage.totals.costUsd)} />
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
                      <th className="py-1 pr-3">Costo</th>
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
                        <td className="py-1.5 pr-3">{fmtUsd(r.costUsd)}</td>
                        <td className="py-1.5">
                          {r.mock ? 'demo' : r.usedByoKey ? 'BYO' : 'plataforma'}
                        </td>
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
        className="flex-1 rounded-lg border border-black/10 bg-white/60 px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5"
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
