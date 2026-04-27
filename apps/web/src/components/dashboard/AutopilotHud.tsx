'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  ChevronUp, 
  ChevronDown, 
  X, 
  Bolt, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Gauge, 
  Activity, 
  Package, 
  Settings,
  CheckCircle2,
  Factory
} from 'lucide-react';
import { useSignals, CorrectiveProposal, CriticalEvent } from '@/hooks/useSignals';
import { useAuth } from '@/hooks/useAuth';

export function AutopilotHud() {
  const { tenantId } = useAuth();
  const { 
    status, 
    proposals, 
    setProposals,
    criticalEvents, 
    removeProposal, 
    removeEvent 
  } = useSignals(tenantId || 'default');

  const [minimized, setMinimized] = useState(false);
  const [executingId, setExecutingId] = useState<number | null>(null);

  // Initial load
  useEffect(() => {
    fetch('/api/autopilot/proposals?status=pending')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setProposals(data.slice(0, 6));
        }
      })
      .catch(err => console.error('Failed to load proposals', err));
  }, [setProposals]);

  const handleExecute = async (proposal: CorrectiveProposal) => {
    if (executingId === proposal.id) return;
    setExecutingId(proposal.id);

    try {
      const res = await fetch(`/api/autopilot/proposals/${proposal.id}/execute`, {
        method: 'POST',
      });
      if (res.ok) {
        setProposals(prev => prev.map(p => 
          p.id === proposal.id ? { ...p, status: 'executed' as const } : p
        ));
      }
    } catch (err) {
      console.error('Execution failed', err);
    } finally {
      setExecutingId(null);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-3 h-3 text-rose-500" />;
      case 'high': return <AlertCircle className="w-3 h-3 text-orange-500" />;
      case 'medium': return <Info className="w-3 h-3 text-amber-500" />;
      default: return <Info className="w-3 h-3 text-blue-500" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'bottleneck': return <Gauge className="w-3 h-3 opacity-50" />;
      case 'sigma_instability': return <Activity className="w-3 h-3 opacity-50" />;
      case 'shortage': return <Package className="w-3 h-3 opacity-50" />;
      default: return <Settings className="w-3 h-3 opacity-50" />;
    }
  };

  const pendingCount = proposals.filter(p => p.status === 'pending').length;

  return (
    <motion.aside 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-20 right-5 z-[900] w-[340px] pointer-events-auto"
    >
      <div className="bg-[#0a0c16d1] backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-100px)]">
        
        {/* Header */}
        <header 
          className="flex items-center justify-between p-3 px-4 cursor-pointer hover:bg-white/5 border-bottom border-white/5 transition-colors"
          onClick={() => setMinimized(!minimized)}
        >
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-400" />
            <span className="text-[11px] font-bold tracking-widest text-white/90 uppercase">Autopilot</span>
            {pendingCount > 0 && (
              <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {pendingCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${
              status === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse' :
              status === 'connecting' ? 'bg-amber-500' :
              status === 'error' ? 'bg-rose-500' : 'bg-white/20'
            }`} />
            {minimized ? <ChevronDown className="w-3 h-3 text-white/40" /> : <ChevronUp className="w-3 h-3 text-white/40" />}
          </div>
        </header>

        {/* Body */}
        <AnimatePresence>
          {!minimized && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-2 space-y-2 max-h-[calc(100vh-160px)] overflow-y-auto custom-scrollbar">
                
                {/* Critical Events Toasts */}
                <AnimatePresence>
                  {criticalEvents.map((ev, idx) => (
                    <motion.div
                      key={`event-${idx}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2 group"
                    >
                      <Bolt className="w-3 h-3 text-rose-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-bold text-rose-500 tracking-wider uppercase">{ev.domain}</div>
                        <div className="text-[10px] text-white/80 truncate">{ev.action}</div>
                        {ev.line && <div className="text-[9px] text-white/40">Line {ev.line}</div>}
                      </div>
                      <button onClick={() => removeEvent(ev)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-white/40 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Proposals List */}
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {proposals.map((p) => (
                      <motion.div
                        key={p.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, x: 20 }}
                        className={`rounded-xl p-3 border-l-2 transition-all hover:bg-white/5 ${
                          p.status === 'executed' ? 'opacity-50 border-l-green-500 bg-white/5' :
                          p.severity === 'critical' ? 'border-l-rose-500 bg-rose-500/5' :
                          p.severity === 'high' ? 'border-l-orange-500 bg-orange-500/5' :
                          p.severity === 'medium' ? 'border-l-amber-500 bg-amber-500/5' :
                          'border-l-blue-500 bg-blue-500/5'
                        }`}
                      >
                        <div className="flex items-start gap-2 mb-1.5">
                          {getCategoryIcon(p.category)}
                          <span className="flex-1 text-[11px] font-semibold text-white/90 leading-tight">{p.title}</span>
                          {getSeverityIcon(p.severity)}
                        </div>

                        <p className="text-[10px] text-white/50 leading-relaxed mb-2">{p.description}</p>

                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          {p.line && (
                            <span className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-md px-1.5 py-0.5 text-[9px] text-white/40">
                              <Factory className="w-2.5 h-2.5" /> {p.line}
                            </span>
                          )}
                          {p.bayId && (
                            <span className="bg-white/5 border border-white/10 rounded-md px-1.5 py-0.5 text-[9px] text-white/40">
                              Bay {p.bayId}
                            </span>
                          )}
                          {p.severityScore && (
                            <span className="bg-white/5 border border-white/10 rounded-md px-1.5 py-0.5 text-[9px] text-white/40">
                              Score {Math.round(p.severityScore * 100)}%
                            </span>
                          )}
                          {p.sigmaLevel && (
                            <span className="bg-white/5 border border-white/10 rounded-md px-1.5 py-0.5 text-[9px] text-white/40">
                              σ = {p.sigmaLevel.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {p.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleExecute(p)}
                              disabled={executingId === p.id}
                              className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 text-white text-[10px] font-bold shadow-lg shadow-rose-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                              <Bolt className={`w-3 h-3 ${executingId === p.id ? 'animate-spin' : ''}`} />
                              {executingId === p.id ? 'Executing...' : 'Execute Fix'}
                            </button>
                            <button 
                              onClick={() => removeProposal(p.id)}
                              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white/80 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[10px] text-green-500 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Applied
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {proposals.length === 0 && (
                    <div className="py-8 text-center flex flex-col items-center gap-2 opacity-30">
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                      <p className="text-[11px] text-white font-medium">All systems nominal</p>
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
