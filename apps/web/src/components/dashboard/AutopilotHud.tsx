'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bolt,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Factory,
  Gauge,
  Info,
  Package,
  Settings,
  X,
} from 'lucide-react';
import { type CorrectiveProposal, useSignals } from '@/hooks/useSignals';
import { useAuth } from '@/hooks/useAuth';

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
).replace(/\/$/, '');

export function AutopilotHud() {
  const { tenantId } = useAuth();
  const {
    status,
    proposals,
    setProposals,
    criticalEvents,
    removeProposal,
    removeEvent,
  } = useSignals(tenantId || 'default');

  const [minimized, setMinimized] = useState(false);
  const [executingId, setExecutingId] = useState<number | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem('axos_access_token');

    fetch(`${apiBaseUrl}/api/autopilot/proposals?status=pending`, {
      headers: {
        'Content-Type': 'application/json',
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProposals(data.slice(0, 6));
        }
      })
      .catch((err) => console.error('Failed to load proposals', err));
  }, [setProposals, tenantId]);

  const handleExecute = async (proposal: CorrectiveProposal) => {
    if (executingId === proposal.id) return;
    setExecutingId(proposal.id);

    try {
      const token = window.localStorage.getItem('axos_access_token');
      const res = await fetch(`${apiBaseUrl}/api/autopilot/proposals/${proposal.id}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        setProposals((prev) =>
          prev.map((p) =>
            p.id === proposal.id ? { ...p, status: 'executed' as const } : p,
          ),
        );
      }
    } catch (err) {
      console.error('Execution failed', err);
    } finally {
      setExecutingId(null);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-3 w-3 text-rose-500" strokeWidth={1.5} />;
      case 'high':
        return <AlertCircle className="h-3 w-3 text-orange-500" strokeWidth={1.5} />;
      case 'medium':
        return <Info className="h-3 w-3 text-amber-500" strokeWidth={1.5} />;
      default:
        return <Info className="h-3 w-3 text-[#0071e3]" strokeWidth={1.5} />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'bottleneck':
        return <Gauge className="h-3 w-3 text-[#ff9500]" strokeWidth={1.5} />;
      case 'sigma_instability':
        return <Activity className="h-3 w-3 text-[#34c759]" strokeWidth={1.5} />;
      case 'shortage':
        return <Package className="h-3 w-3 text-[#0071e3]" strokeWidth={1.5} />;
      default:
        return <Settings className="h-3 w-3 text-[#86868b]" strokeWidth={1.5} />;
    }
  };

  const pendingCount = proposals.filter((p) => p.status === 'pending').length;

  return (
    <motion.aside
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 24, stiffness: 90 }}
      className="pointer-events-auto fixed right-5 top-20 z-[900] w-[340px]"
    >
      <div className="apple-card flex max-h-[calc(100vh-100px)] flex-col overflow-hidden rounded-[24px]">
        <header
          className="flex cursor-pointer items-center justify-between border-b border-black/[0.06] px-4 py-3 transition-colors hover:bg-white/60"
          onClick={() => setMinimized(!minimized)}
        >
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-[#0071e3]" strokeWidth={1.5} />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#1d1d1f]">
              Autopilot
            </span>
            {pendingCount > 0 && (
              <span className="min-w-[18px] rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[9px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`h-1.5 w-1.5 rounded-full ${
                status === 'connected'
                  ? 'bg-[#34c759] shadow-[0_0_8px_rgba(52,199,89,0.35)]'
                  : status === 'connecting'
                    ? 'bg-[#ff9500]'
                    : status === 'error'
                      ? 'bg-rose-500'
                      : 'bg-[#86868b]/40'
              }`}
            />
            {minimized ? (
              <ChevronDown className="h-3 w-3 text-[#86868b]" strokeWidth={1.5} />
            ) : (
              <ChevronUp className="h-3 w-3 text-[#86868b]" strokeWidth={1.5} />
            )}
          </div>
        </header>

        <AnimatePresence>
          {!minimized && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="max-h-[calc(100vh-160px)] space-y-2 overflow-y-auto p-2">
                <AnimatePresence>
                  {criticalEvents.map((ev, idx) => (
                    <motion.div
                      key={`event-${idx}`}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      className="group flex items-start gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-2"
                    >
                      <Bolt className="mt-0.5 h-3 w-3 flex-shrink-0 text-rose-500" strokeWidth={1.5} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-rose-500">
                          {ev.domain}
                        </div>
                        <div className="truncate text-[10px] text-[#1d1d1f]">
                          {ev.action}
                        </div>
                        {ev.line && (
                          <div className="text-[9px] text-[#86868b]">Line {ev.line}</div>
                        )}
                      </div>
                      <button
                        onClick={() => removeEvent(ev)}
                        className="p-0.5 text-[#86868b] opacity-0 transition-opacity hover:text-[#1d1d1f] group-hover:opacity-100"
                        aria-label="Dismiss critical event"
                      >
                        <X className="h-3 w-3" strokeWidth={1.5} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {proposals.map((p) => (
                      <motion.div
                        key={p.id}
                        layout
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, x: 16 }}
                        className={`rounded-2xl border-l-2 bg-white/62 p-3 transition-all hover:bg-white ${
                          p.status === 'executed'
                            ? 'border-l-[#34c759] opacity-60'
                            : p.severity === 'critical'
                              ? 'border-l-rose-500'
                              : p.severity === 'high'
                                ? 'border-l-orange-500'
                                : p.severity === 'medium'
                                  ? 'border-l-amber-500'
                                  : 'border-l-[#0071e3]'
                        }`}
                      >
                        <div className="mb-1.5 flex items-start gap-2">
                          {getCategoryIcon(p.category)}
                          <span className="flex-1 text-[11px] font-semibold leading-tight text-[#1d1d1f]">
                            {p.title}
                          </span>
                          {getSeverityIcon(p.severity)}
                        </div>

                        <p className="mb-2 text-[10px] leading-relaxed text-[#86868b]">
                          {p.description}
                        </p>

                        <div className="mb-2.5 flex flex-wrap gap-1.5">
                          {p.line && (
                            <span className="flex items-center gap-1 rounded-md border border-black/[0.06] bg-[#f5f5f7]/80 px-1.5 py-0.5 text-[9px] text-[#86868b]">
                              <Factory className="h-2.5 w-2.5" strokeWidth={1.5} /> {p.line}
                            </span>
                          )}
                          {p.bayId && (
                            <span className="rounded-md border border-black/[0.06] bg-[#f5f5f7]/80 px-1.5 py-0.5 text-[9px] text-[#86868b]">
                              Bay {p.bayId}
                            </span>
                          )}
                          {p.severityScore && (
                            <span className="rounded-md border border-black/[0.06] bg-[#f5f5f7]/80 px-1.5 py-0.5 text-[9px] text-[#86868b]">
                              Score {Math.round(p.severityScore * 100)}%
                            </span>
                          )}
                          {p.sigmaLevel && (
                            <span className="rounded-md border border-black/[0.06] bg-[#f5f5f7]/80 px-1.5 py-0.5 text-[9px] text-[#86868b]">
                              Sigma {p.sigmaLevel.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {p.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleExecute(p)}
                              disabled={executingId === p.id}
                              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0071e3] py-1.5 text-[10px] font-bold text-white shadow-lg shadow-[#0071e3]/15 transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                              <Bolt
                                className={`h-3 w-3 ${executingId === p.id ? 'animate-spin' : ''}`}
                                strokeWidth={1.5}
                              />
                              {executingId === p.id ? 'Executing...' : 'Execute Fix'}
                            </button>
                            <button
                              onClick={() => removeProposal(p.id)}
                              className="rounded-xl border border-black/[0.06] bg-[#f5f5f7]/80 p-1.5 text-[#86868b] transition-colors hover:text-[#1d1d1f]"
                              aria-label="Dismiss proposal"
                            >
                              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[10px] font-medium text-[#34c759]">
                            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Applied
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {proposals.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <CheckCircle2 className="h-6 w-6 text-[#34c759]" strokeWidth={1.5} />
                      <p className="text-[11px] font-medium text-[#86868b]">
                        No active autopilot proposals
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
