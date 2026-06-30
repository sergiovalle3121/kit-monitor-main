'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft, Loader2, Lock, Plus, X, CheckCircle2, Trash2, Pencil, Users,
  ShieldCheck, FileBadge, Boxes, AlertTriangle, Mail, Phone, Globe, MapPin,
  CreditCard, Truck, Star, Award, TrendingUp, TrendingDown, Minus, Gauge,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/contexts/ToastContext';
import {
  supApi, supInput, money, QUAL_META, RISK_META, CERT_META, AVL_STATUS_META,
  SCAR_STATUS_META, SCAR_SEV_META, scoreColor, otdColor, ppmColor, gradeMeta, sourceLabel,
  type Supplier360, type Supplier, type SupplierContact, type SupplierCertification,
  type SupplierApprovedPart, type Scorecard, type TrendPoint, type MetricSource,
} from '@/lib/suppliers';

const BLUE = '#3b82f6';
const STANDARDS = ['ISO9001', 'IATF16949', 'ISO13485', 'AS9100', 'ISO14001', 'ROHS', 'REACH', 'UL', 'CONFLICT_MINERALS'];
const ROLES = ['SALES', 'QUALITY', 'LOGISTICS', 'ENGINEERING', 'FINANCE', 'EXECUTIVE', 'OTHER'];
const ROLE_LABEL: Record<string, string> = { SALES: 'Ventas', QUALITY: 'Calidad', LOGISTICS: 'Logística', ENGINEERING: 'Ingeniería', FINANCE: 'Finanzas', EXECUTIVE: 'Dirección', OTHER: 'Otro' };
const AVL_STATUSES = ['APPROVED', 'CONDITIONAL', 'PENDING', 'DISQUALIFIED'];
const SCAR_SEVS = ['minor', 'major', 'critical'];
const SCAR_FLOW = ['open', 'sent_to_supplier', 'awaiting_response', 'response_under_review', 'action_accepted', 'effectiveness_review', 'closed'];
type Tab = 'overview' | 'contacts' | 'certs' | 'parts' | 'scars';

export default function SupplierDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [modal, setModal] = useState<null | 'contact' | 'cert' | 'edit' | 'avl' | 'scar'>(null);
  const [editAvl, setEditAvl] = useState<SupplierApprovedPart | null>(null);
  const { data, isLoading, forbidden, mutate } = useApi<Supplier360>(`/suppliers/${id}/360`);

  if (forbidden) return <Guard />;
  if (isLoading || !data) return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const { supplier: s, scorecard, trend, metrics, contacts, certifications, avl, scars } = data;
  const qz = QUAL_META[s.qualificationStatus || 'PENDING'] ?? QUAL_META.PENDING;
  const risk = RISK_META[s.riskLevel || 'LOW'] ?? RISK_META.LOW;
  const g = gradeMeta(scorecard.grade);

  const tabs: { key: Tab; label: string; icon: typeof Users; count?: number }[] = [
    { key: 'overview', label: 'Resumen', icon: ShieldCheck },
    { key: 'contacts', label: 'Contactos', icon: Users, count: contacts.length },
    { key: 'certs', label: 'Certificaciones', icon: FileBadge, count: certifications.length },
    { key: 'parts', label: 'Partes (AVL)', icon: Boxes, count: avl.length },
    { key: 'scars', label: 'SCARs', icon: AlertTriangle, count: scars.length },
  ];

  async function removeContact(cid: number) { try { await supApi.removeContact(cid); mutate(); } catch { toast.error('Error', 'Proveedores'); } }
  async function removeCert(cid: number) { try { await supApi.removeCertification(cid); mutate(); } catch { toast.error('Error', 'Proveedores'); } }
  async function removeAvl(aid: number) { try { await supApi.removeAvlPart(aid); mutate(); } catch { toast.error('Error', 'Proveedores'); } }
  async function setAvlStatus(aid: number, approvalStatus: string) {
    try { await supApi.updateAvlPart(aid, { approvalStatus }); toast.success('AVL actualizado.', 'Proveedores'); mutate(); }
    catch { toast.error('Error', 'Proveedores'); }
  }
  async function advanceScar(scarId: number, status: string) {
    try { await supApi.updateScar(scarId, { status }); toast.success('SCAR actualizada.', 'Proveedores'); mutate(); }
    catch { toast.error('Error', 'Proveedores'); }
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/dashboard/suppliers" aria-label="Volver" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="w-10 h-10 rounded-xl grid place-items-center text-white font-bold flex-shrink-0" style={{ background: `linear-gradient(135deg, ${BLUE}, #6366f1)` }}>{s.name.slice(0, 2).toUpperCase()}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight truncate">{s.name}</h1>
            <p className="text-[12px] text-gray-400 leading-tight font-mono">{s.code}{s.commodity ? ` · ${s.commodity}` : ''}</p>
          </div>
          {scorecard.grade !== 'NA' && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${g.color}1a`, color: g.color }} title="Grade compuesto (OTD + PPM + SCAR + certs)">
              <Award className="w-3.5 h-3.5" /> Grade {g.label}
            </span>
          )}
          <span className="hidden sm:inline text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${qz.color}1a`, color: qz.color }}>{qz.label}</span>
          <button onClick={() => setModal('edit')} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10" title="Editar"><Pencil className="w-4 h-4" /></button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pt-6 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <GradeTile grade={scorecard.grade} composite={scorecard.composite} color={g.color} />
          <MetricSourced label="OTD" value={metrics.otd.value != null ? `${metrics.otd.value}%` : '—'} color={otdColor(metrics.otd.value)} source={metrics.otd.source} hint={metrics.otd.eligible ? `${metrics.otd.onTime}/${metrics.otd.eligible} a tiempo` : undefined} />
          <MetricSourced label="PPM" value={metrics.iqc.ppm != null ? String(metrics.iqc.ppm) : '—'} color={ppmColor(metrics.iqc.ppm)} source={metrics.iqc.ppmSource} hint={metrics.iqc.inspected ? `${metrics.iqc.inspected.toLocaleString()} insp.` : undefined} />
          <Metric label="SCARs abiertas" value={String(metrics.scars.open)} color={metrics.scars.open ? '#f59e0b' : '#10b981'} />
          <Metric label="Partes (AVL)" value={String(metrics.approvedParts)} color={BLUE} sub={metrics.avl > metrics.approvedParts ? `${metrics.avl} totales` : 'aprobadas'} />
          <Metric label="Certs por vencer" value={String(metrics.expiringCerts)} color={metrics.expiringCerts ? '#f59e0b' : '#10b981'} />
        </div>

        <div className="flex items-center gap-1 mb-6 border-b border-black/5 dark:border-white/10 overflow-x-auto">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} className={`relative px-4 py-2.5 text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${active ? '' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`} style={active ? { color: BLUE } : undefined}>
                <t.icon className="w-4 h-4" />{t.label}
                {t.count != null && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10">{t.count}</span>}
                {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: BLUE }} />}
              </button>
            );
          })}
        </div>

        {tab === 'overview' && <Overview s={s} scorecard={scorecard} metrics={metrics} trend={trend} risk={risk} />}
        {tab === 'contacts' && <ContactsTab contacts={contacts} onAdd={() => setModal('contact')} onRemove={removeContact} />}
        {tab === 'certs' && <CertsTab certs={certifications} onAdd={() => setModal('cert')} onRemove={removeCert} />}
        {tab === 'parts' && <AvlTab parts={avl} currency={s.currency || 'USD'} onAdd={() => { setEditAvl(null); setModal('avl'); }} onEdit={(p) => { setEditAvl(p); setModal('avl'); }} onRemove={removeAvl} onStatus={setAvlStatus} />}
        {tab === 'scars' && <ScarsTab scars={scars} onOpen={() => setModal('scar')} onAdvance={advanceScar} />}
      </main>

      {modal === 'contact' && <ContactModal supplierId={id} onClose={() => setModal(null)} onDone={() => { setModal(null); mutate(); }} />}
      {modal === 'cert' && <CertModal supplierId={id} onClose={() => setModal(null)} onDone={() => { setModal(null); mutate(); }} />}
      {modal === 'edit' && <EditModal supplier={s} onClose={() => setModal(null)} onDone={() => { setModal(null); mutate(); }} />}
      {modal === 'avl' && <AvlModal supplierId={id} part={editAvl} onClose={() => setModal(null)} onDone={() => { setModal(null); mutate(); }} />}
      {modal === 'scar' && <ScarModal supplierId={id} onClose={() => setModal(null)} onDone={() => { setModal(null); mutate(); }} />}
    </div>
  );
}

function Overview({ s, scorecard, metrics, trend, risk }: { s: Supplier; scorecard: Scorecard; metrics: Supplier360['metrics']; trend: TrendPoint[]; risk: { label: string; color: string } }) {
  const rows: { icon: typeof Globe; label: string; value: React.ReactNode }[] = [
    { icon: Truck, label: 'Tipo', value: s.type || '—' },
    { icon: Globe, label: 'Región / País', value: [s.region, s.country].filter(Boolean).join(' · ') || '—' },
    { icon: MapPin, label: 'Ciudad', value: s.city || '—' },
    { icon: CreditCard, label: 'Términos', value: [s.paymentTerms, s.incoterm].filter(Boolean).join(' · ') || '—' },
    { icon: Truck, label: 'Lead time', value: s.leadTimeDays != null ? `${s.leadTimeDays} días` : '—' },
    { icon: Award, label: 'Salud financiera', value: s.financialHealth || '—' },
  ];
  const ppmScore = metrics.iqc.ppm != null ? Math.max(0, Math.min(100, Math.round(100 - metrics.iqc.ppm / 50))) : null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className={`${glass} rounded-2xl p-5`}>
          <h3 className="text-sm font-semibold mb-4">Perfil del proveedor</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {rows.map((r) => (
              <div key={r.label} className="flex items-start gap-3">
                <r.icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0"><div className="text-[11px] uppercase tracking-wide text-gray-400">{r.label}</div><div className="text-sm font-medium truncate">{r.value}</div></div>
              </div>
            ))}
          </div>
          {s.website && <a href={`https://${s.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: BLUE }}><Globe className="w-3.5 h-3.5" />{s.website}</a>}
          {s.singleSource && <div className="mt-4 flex items-center gap-2 text-[13px] text-red-500 bg-red-500/10 rounded-xl px-3 py-2"><AlertTriangle className="w-4 h-4" /> Proveedor de fuente única (single-source) — riesgo de continuidad.</div>}
          {s.notes && <p className="mt-4 text-sm text-gray-500 border-t border-black/5 dark:border-white/10 pt-4">{s.notes}</p>}
        </div>

        {/* IQC + SCAR engine metrics (derived) */}
        <div className="grid grid-cols-2 gap-4">
          <div className={`${glass} rounded-2xl p-5`}>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">Calidad de entrada (IQC) <SourceBadge source={metrics.iqc.ppmSource} /></h4>
            <div className="flex items-end gap-3"><div className="text-3xl font-bold tabular-nums" style={{ color: ppmColor(metrics.iqc.ppm) }}>{metrics.iqc.ppm != null ? metrics.iqc.ppm : '—'}</div><div className="text-[12px] text-gray-400 mb-1.5">PPM</div></div>
            <div className="text-[12px] text-gray-400 mt-1">{metrics.iqc.passRate}% aceptación · {metrics.iqc.defects} def / {metrics.iqc.inspected.toLocaleString()} insp · {metrics.iqc.lots} lotes</div>
          </div>
          <div className={`${glass} rounded-2xl p-5`}>
            <h4 className="text-sm font-semibold mb-3">SCARs</h4>
            <div className="flex items-end gap-3"><div className="text-3xl font-bold tabular-nums" style={{ color: metrics.scars.open ? '#f59e0b' : '#10b981' }}>{metrics.scars.open}</div><div className="text-[12px] text-gray-400 mb-1.5">abiertas</div></div>
            <div className="text-[12px] text-gray-400 mt-1">{metrics.scars.closed} cerradas{metrics.scars.onTimeRate != null ? ` · ${metrics.scars.onTimeRate}% a tiempo` : ''} · cierre prom. {metrics.scars.avgClosureDays}d</div>
          </div>
        </div>

        {/* OTD / PPM trend */}
        <TrendCard trend={trend} />
      </div>

      <div className="space-y-6">
        <div className={`${glass} rounded-2xl p-5`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Scorecard</h3>
            <TrendPill dir={scorecard.trend} />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-12 h-12 rounded-2xl grid place-items-center text-2xl font-bold flex-shrink-0" style={{ background: `${gradeMeta(scorecard.grade).color}1a`, color: gradeMeta(scorecard.grade).color }}>{scorecard.grade === 'NA' ? '—' : scorecard.grade}</span>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-gray-400">Grade compuesto</div>
              <div className="text-sm font-medium">{scorecard.composite != null ? `${scorecard.composite}/100` : 'Sin datos suficientes'}</div>
            </div>
          </div>
          <Bar label="OTD" value={scorecard.otdPct ?? 0} color={otdColor(scorecard.otdPct)} note={sourceLabel(scorecard.otdSource)} />
          <Bar label="Calidad (PPM)" value={ppmScore ?? 0} color={scoreColor(ppmScore ?? 0)} note={sourceLabel(scorecard.ppmSource)} />
          {scorecard.scarResponsiveness != null && <Bar label="Respuesta SCAR" value={scorecard.scarResponsiveness} color={scoreColor(scorecard.scarResponsiveness)} />}
          {scorecard.certScore != null && <Bar label="Certificaciones" value={scorecard.certScore} color={scoreColor(scorecard.certScore)} />}
          <div className="flex items-center justify-between text-[13px] mt-4 pt-4 border-t border-black/5 dark:border-white/10">
            <span className="text-gray-400">Nivel de riesgo</span>
            <span className="inline-flex items-center gap-1 font-medium" style={{ color: risk.color }}><ShieldCheck className="w-3.5 h-3.5" />{risk.label}</span>
          </div>
          <div className="flex items-center justify-between text-[13px] mt-2"><span className="text-gray-400">SQE / comprador</span><span className="font-medium truncate ml-2">{s.ownerEmail || '—'}</span></div>
          <p className="mt-3 text-[11px] text-gray-400 leading-relaxed">Ponderación: OTD {Math.round(scorecard.weights.otd * 100)}% · PPM {Math.round(scorecard.weights.ppm * 100)}% · SCAR {Math.round(scorecard.weights.scar * 100)}% · certs {Math.round(scorecard.weights.cert * 100)}%. Pesos se renormalizan sobre lo medible.</p>
        </div>
        {s.tags && s.tags.length > 0 && (
          <div className={`${glass} rounded-2xl p-5`}>
            <h3 className="text-sm font-semibold mb-3">Etiquetas</h3>
            <div className="flex flex-wrap gap-1.5">{s.tags.map((t) => <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-500">{t}</span>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function TrendCard({ trend }: { trend: TrendPoint[] }) {
  const hasData = trend.some((t) => t.otdPct != null || t.ppm != null);
  if (!hasData) return null;
  const maxPpm = Math.max(100, ...trend.map((t) => t.ppm ?? 0));
  return (
    <div className={`${glass} rounded-2xl p-5`}>
      <h4 className="text-sm font-semibold mb-4 flex items-center gap-2"><Gauge className="w-4 h-4 text-gray-400" /> Tendencia (últimos meses)</h4>
      <div className="grid grid-cols-2 gap-6">
        <Sparkline label="OTD %" points={trend.map((t) => ({ m: t.month, v: t.otdPct }))} max={100} color="#10b981" fmt={(v) => `${v}%`} />
        <Sparkline label="PPM" points={trend.map((t) => ({ m: t.month, v: t.ppm }))} max={maxPpm} color="#ef4444" invert fmt={(v) => String(v)} />
      </div>
    </div>
  );
}

function Sparkline({ label, points, max, color, invert, fmt }: { label: string; points: { m: string; v: number | null }[]; max: number; color: string; invert?: boolean; fmt: (v: number) => string }) {
  const last = [...points].reverse().find((p) => p.v != null);
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-2"><span className="text-gray-500">{label}</span><span className="font-medium tabular-nums" style={{ color }}>{last?.v != null ? fmt(last.v) : '—'}</span></div>
      <div className="flex items-end gap-1 h-16">
        {points.map((p, i) => {
          const ratio = p.v == null ? 0 : Math.max(0.04, Math.min(1, (invert ? max - p.v : p.v) / max));
          return (
            <div key={i} className="flex-1 flex flex-col justify-end" title={`${p.m}: ${p.v != null ? fmt(p.v) : 's/dato'}`}>
              <div className="rounded-t" style={{ height: `${ratio * 100}%`, background: p.v == null ? 'rgba(120,120,120,0.15)' : `${color}99`, minHeight: 3 }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-gray-400 mt-1"><span>{points[0]?.m.slice(2)}</span><span>{points[points.length - 1]?.m.slice(2)}</span></div>
    </div>
  );
}

function ContactsTab({ contacts, onAdd, onRemove }: { contacts: SupplierContact[]; onAdd: () => void; onRemove: (id: number) => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4"><h2 className="text-sm font-semibold">Contactos <span className="text-gray-400">({contacts.length})</span></h2><button onClick={onAdd} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white" style={{ background: BLUE }}><Plus className="w-3.5 h-3.5" /> Contacto</button></div>
      {contacts.length === 0 ? <EmptyCard text="Sin contactos del proveedor. Agrega a tu contraparte de ventas, calidad y logística para tener a quién escalar." /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {contacts.map((c) => (
            <div key={c.id} className={`${glass} rounded-2xl p-4`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-full grid place-items-center font-semibold text-white flex-shrink-0" style={{ background: BLUE }}>{c.name.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0"><div className="font-semibold flex items-center gap-1.5 truncate">{c.name}{c.isPrimary && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />}</div><div className="text-[12px] text-gray-400 truncate">{c.title || '—'}</div></div>
                </div>
                <button onClick={() => onRemove(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]">{c.role && <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-500">{ROLE_LABEL[c.role] || c.role}</span>}</div>
              <div className="mt-2 space-y-1 text-[12px] text-gray-500">
                {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 hover:text-blue-500"><Mail className="w-3.5 h-3.5" />{c.email}</a>}
                {c.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{c.phone}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CertsTab({ certs, onAdd, onRemove }: { certs: SupplierCertification[]; onAdd: () => void; onRemove: (id: number) => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4"><h2 className="text-sm font-semibold">Certificaciones <span className="text-gray-400">({certs.length})</span></h2><button onClick={onAdd} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white" style={{ background: BLUE }}><Plus className="w-3.5 h-3.5" /> Certificación</button></div>
      {certs.length === 0 ? <EmptyCard text="Sin certificaciones registradas (ISO 9001, IATF 16949, ISO 13485…). Captura número y vencimiento y el sistema te avisa antes de que caduquen." /> : (
        <div className="space-y-2.5">
          {certs.map((c) => {
            const m = CERT_META[c.status] ?? CERT_META.VALID;
            return (
              <div key={c.id} className={`${glass} rounded-2xl p-4 flex items-center gap-4`}>
                <span className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${m.color}1a`, color: m.color }}><FileBadge className="w-5 h-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold">{c.standard}</span><span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${m.color}1f`, color: m.color }}>{m.label}</span></div>
                  <div className="text-[12px] text-gray-400">{[c.certNumber, c.issuedBy].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[12px] text-gray-400">Vence</div>
                  <div className="text-sm font-medium" style={{ color: c.status === 'EXPIRED' || c.status === 'EXPIRING' ? m.color : undefined }}>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div>
                </div>
                <button onClick={() => onRemove(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AvlTab({ parts, currency, onAdd, onEdit, onRemove, onStatus }: { parts: SupplierApprovedPart[]; currency: string; onAdd: () => void; onEdit: (p: SupplierApprovedPart) => void; onRemove: (id: number) => void; onStatus: (id: number, st: string) => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold">Partes aprobadas · AVL <span className="text-gray-400">({parts.length})</span></h2>
        <button onClick={onAdd} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white" style={{ background: BLUE }}><Plus className="w-3.5 h-3.5" /> Aprobar parte</button>
      </div>
      {parts.length === 0 ? (
        <EmptyCard text="Sin partes en el AVL. El AVL declara qué partes está APROBADO a surtir este proveedor, con su precio y lead time — la base para que Compras sepa a quién comprar y para derivar su desempeño por parte." />
      ) : (
        <div className={`${glass} rounded-2xl overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-black/5 dark:border-white/10">
                <th className="text-left font-medium px-4 py-2.5">Parte</th>
                <th className="text-left font-medium px-3 py-2.5">Estatus</th>
                <th className="text-right font-medium px-3 py-2.5">Precio</th>
                <th className="text-right font-medium px-3 py-2.5">MOQ</th>
                <th className="text-right font-medium px-3 py-2.5">Lead time</th>
                <th className="text-right font-medium px-3 py-2.5"></th>
              </tr></thead>
              <tbody>
                {parts.map((p) => {
                  const m = AVL_STATUS_META[p.approvalStatus] ?? AVL_STATUS_META.PENDING;
                  return (
                    <tr key={p.id} className="border-b border-black/[0.03] dark:border-white/[0.04] group">
                      <td className="px-4 py-2.5"><div className="font-mono">{p.partNumber}</div>{p.description && <div className="text-[11px] text-gray-400 truncate max-w-[220px]">{p.description}</div>}</td>
                      <td className="px-3 py-2.5">
                        <select value={p.approvalStatus} onChange={(e) => onStatus(p.id, e.target.value)} className="rounded-full px-2 py-0.5 text-[11px] font-medium border-0 outline-none cursor-pointer" style={{ background: `${m.color}1f`, color: m.color }}>
                          {AVL_STATUSES.map((st) => <option key={st} value={st}>{AVL_STATUS_META[st].label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.unitPrice != null ? money(p.unitPrice, p.currency || currency) : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.moq != null ? p.moq.toLocaleString() : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{p.leadTimeDays != null ? `${p.leadTimeDays} d` : '—'}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => onEdit(p)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-400 hover:text-blue-500"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => onRemove(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ScarsTab({ scars, onOpen, onAdvance }: { scars: Supplier360['scars']; onOpen: () => void; onAdvance: (id: number, st: string) => void }) {
  const sevColor: Record<string, string> = { minor: '#6b7280', major: '#f59e0b', critical: '#ef4444' };
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold">SCARs <span className="text-gray-400">({scars.length})</span></h2>
        <button onClick={onOpen} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white" style={{ background: BLUE }}><Plus className="w-3.5 h-3.5" /> Abrir SCAR</button>
      </div>
      {scars.length === 0 ? <EmptyCard text="Sin SCARs (acciones correctivas de proveedor). Cuando un lote falle IQC o un proveedor incumpla, abre un SCAR aquí para darle seguimiento 8D hasta su cierre." /> : (
        <div className="space-y-2.5">
          {scars.map((sc) => {
            const st = SCAR_STATUS_META[sc.status] ?? { label: sc.status, color: '#6b7280', open: true };
            return (
              <div key={sc.id} className={`${glass} rounded-2xl p-4`}>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{sc.scarNumber}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${sevColor[sc.severity] || '#6b7280'}1f`, color: sevColor[sc.severity] || '#6b7280' }}>{sc.severity}</span>
                  <span className="ml-auto">
                    <select value={sc.status} onChange={(e) => onAdvance(sc.id, e.target.value)} className="rounded-full px-2 py-0.5 text-[11px] font-medium border-0 outline-none cursor-pointer" style={{ background: `${st.color}1f`, color: st.color }}>
                      {SCAR_FLOW.map((f) => <option key={f} value={f}>{SCAR_STATUS_META[f]?.label || f}</option>)}
                    </select>
                  </span>
                </div>
                <div className="font-medium text-sm">{sc.issueSummary || sc.partNumber}</div>
                <div className="text-[12px] text-gray-400">parte {sc.partNumber}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Modals ───────────────────────────────────────────────────────────────────
function ContactModal({ supplierId, onClose, onDone }: { supplierId: number; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: '', title: '', role: 'SALES', email: '', phone: '', isPrimary: false });
  async function submit() {
    if (!f.name.trim()) { toast.error('Nombre requerido.', 'Proveedores'); return; }
    setBusy(true);
    try { await supApi.addContact({ supplierId, ...f }); toast.success('Contacto agregado.', 'Proveedores'); onDone(); } catch { toast.error('Error.', 'Proveedores'); } finally { setBusy(false); }
  }
  return (
    <Modal title="Nuevo contacto" onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <L label="Nombre" full><input className={supInput} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></L>
        <L label="Puesto"><input className={supInput} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></L>
        <L label="Área"><select className={supInput} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></L>
        <L label="Email"><input className={supInput} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></L>
        <L label="Teléfono"><input className={supInput} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></L>
      </div>
      <label className="flex items-center gap-2 mt-3 text-sm"><input type="checkbox" checked={f.isPrimary} onChange={(e) => setF({ ...f, isPrimary: e.target.checked })} /> Contacto principal</label>
      <Actions busy={busy} onClose={onClose} onSubmit={submit} />
    </Modal>
  );
}

function CertModal({ supplierId, onClose, onDone }: { supplierId: number; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ standard: 'ISO9001', certNumber: '', issuedBy: '', issuedAt: '', expiresAt: '' });
  async function submit() {
    setBusy(true);
    try { await supApi.addCertification({ supplierId, ...f, issuedAt: f.issuedAt || undefined, expiresAt: f.expiresAt || undefined } as Partial<SupplierCertification>); toast.success('Certificación agregada.', 'Proveedores'); onDone(); } catch { toast.error('Error.', 'Proveedores'); } finally { setBusy(false); }
  }
  return (
    <Modal title="Nueva certificación" onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <L label="Estándar"><select className={supInput} value={f.standard} onChange={(e) => setF({ ...f, standard: e.target.value })}>{STANDARDS.map((st) => <option key={st}>{st}</option>)}</select></L>
        <L label="Número"><input className={supInput} value={f.certNumber} onChange={(e) => setF({ ...f, certNumber: e.target.value })} /></L>
        <L label="Emitido por"><input className={supInput} value={f.issuedBy} onChange={(e) => setF({ ...f, issuedBy: e.target.value })} /></L>
        <L label="Emisión"><input type="date" className={supInput} value={f.issuedAt} onChange={(e) => setF({ ...f, issuedAt: e.target.value })} /></L>
        <L label="Vencimiento"><input type="date" className={supInput} value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></L>
      </div>
      <Actions busy={busy} onClose={onClose} onSubmit={submit} />
    </Modal>
  );
}

function AvlModal({ supplierId, part, onClose, onDone }: { supplierId: number; part: SupplierApprovedPart | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    partNumber: part?.partNumber || '', description: part?.description || '', commodity: part?.commodity || '',
    approvalStatus: part?.approvalStatus || 'APPROVED', unitPrice: part?.unitPrice ?? '', currency: part?.currency || 'USD',
    moq: part?.moq ?? '', leadTimeDays: part?.leadTimeDays ?? '', approvedBy: part?.approvedBy || '', notes: part?.notes || '',
  });
  async function submit() {
    if (!f.partNumber.trim()) { toast.error('Número de parte requerido.', 'AVL'); return; }
    setBusy(true);
    const body: Partial<SupplierApprovedPart> = {
      partNumber: f.partNumber.trim(), description: f.description || undefined, commodity: f.commodity || undefined,
      approvalStatus: f.approvalStatus, currency: f.currency, approvedBy: f.approvedBy || undefined, notes: f.notes || undefined,
      unitPrice: f.unitPrice === '' ? undefined : Number(f.unitPrice),
      moq: f.moq === '' ? undefined : Number(f.moq),
      leadTimeDays: f.leadTimeDays === '' ? undefined : Number(f.leadTimeDays),
    };
    try {
      if (part) await supApi.updateAvlPart(part.id, body);
      else await supApi.addAvlPart({ supplierId, ...body });
      toast.success(part ? 'Parte actualizada.' : 'Parte aprobada en el AVL.', 'AVL'); onDone();
    } catch { toast.error('No se pudo guardar.', 'AVL'); } finally { setBusy(false); }
  }
  return (
    <Modal title={part ? 'Editar parte (AVL)' : 'Aprobar parte (AVL)'} onClose={onClose} wide>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <L label="Número de parte" full><input className={supInput} value={f.partNumber} onChange={(e) => setF({ ...f, partNumber: e.target.value })} placeholder="AX-DRIVE-100" /></L>
        <L label="Descripción" full><input className={supInput} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></L>
        <L label="Estatus"><select className={supInput} value={f.approvalStatus} onChange={(e) => setF({ ...f, approvalStatus: e.target.value })}>{AVL_STATUSES.map((st) => <option key={st} value={st}>{AVL_STATUS_META[st].label}</option>)}</select></L>
        <L label="Commodity"><input className={supInput} value={f.commodity} onChange={(e) => setF({ ...f, commodity: e.target.value })} placeholder="Pasivos" /></L>
        <L label="Aprobado por"><input className={supInput} value={f.approvedBy} onChange={(e) => setF({ ...f, approvedBy: e.target.value })} placeholder="SQE" /></L>
        <L label="Precio unitario"><input type="number" step="0.0001" className={supInput} value={f.unitPrice} onChange={(e) => setF({ ...f, unitPrice: e.target.value })} /></L>
        <L label="Moneda"><input className={supInput} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} /></L>
        <L label="MOQ"><input type="number" className={supInput} value={f.moq} onChange={(e) => setF({ ...f, moq: e.target.value })} /></L>
        <L label="Lead time (d)"><input type="number" className={supInput} value={f.leadTimeDays} onChange={(e) => setF({ ...f, leadTimeDays: e.target.value })} /></L>
        <L label="Notas" full><textarea className={supInput} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></L>
      </div>
      <Actions busy={busy} onClose={onClose} onSubmit={submit} />
    </Modal>
  );
}

function ScarModal({ supplierId, onClose, onDone }: { supplierId: number; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ partNumber: '', severity: 'major', issueSummary: '', defectDescription: '', quantityAffected: '', dueDate: '', createdBy: '', containmentRequired: '' });
  async function submit() {
    if (!f.partNumber.trim() || !f.issueSummary.trim()) { toast.error('Parte y resumen requeridos.', 'SCAR'); return; }
    setBusy(true);
    try {
      await supApi.createScar({
        supplier: { id: supplierId },
        partNumber: f.partNumber.trim(),
        severity: f.severity,
        issueSummary: f.issueSummary.trim(),
        defectDescription: f.defectDescription || f.issueSummary,
        quantityAffected: f.quantityAffected === '' ? 0 : Number(f.quantityAffected),
        containmentRequired: f.containmentRequired || undefined,
        dueDate: f.dueDate || undefined,
        createdBy: f.createdBy || 'SQE',
      });
      toast.success('SCAR abierta.', 'SCAR'); onDone();
    } catch { toast.error('No se pudo abrir el SCAR.', 'SCAR'); } finally { setBusy(false); }
  }
  return (
    <Modal title="Abrir SCAR" onClose={onClose} wide>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <L label="Número de parte"><input className={supInput} value={f.partNumber} onChange={(e) => setF({ ...f, partNumber: e.target.value })} /></L>
        <L label="Severidad"><select className={supInput} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>{SCAR_SEVS.map((sv) => <option key={sv} value={sv}>{SCAR_SEV_META[sv]?.label || sv}</option>)}</select></L>
        <L label="Resumen del problema" full><input className={supInput} value={f.issueSummary} onChange={(e) => setF({ ...f, issueSummary: e.target.value })} placeholder="Soldadura fría en conector J3" /></L>
        <L label="Descripción del defecto" full><textarea className={supInput} rows={2} value={f.defectDescription} onChange={(e) => setF({ ...f, defectDescription: e.target.value })} /></L>
        <L label="Cantidad afectada"><input type="number" className={supInput} value={f.quantityAffected} onChange={(e) => setF({ ...f, quantityAffected: e.target.value })} /></L>
        <L label="Fecha compromiso (8D)"><input type="date" className={supInput} value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></L>
        <L label="Contención requerida" full><input className={supInput} value={f.containmentRequired} onChange={(e) => setF({ ...f, containmentRequired: e.target.value })} placeholder="Sort 100% en recibo" /></L>
        <L label="Abierto por"><input className={supInput} value={f.createdBy} onChange={(e) => setF({ ...f, createdBy: e.target.value })} placeholder="SQE" /></L>
      </div>
      <Actions busy={busy} onClose={onClose} onSubmit={submit} />
    </Modal>
  );
}

function EditModal({ supplier, onClose, onDone }: { supplier: Supplier; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: supplier.name, qualificationStatus: supplier.qualificationStatus || 'PENDING', riskLevel: supplier.riskLevel || 'LOW',
    status: supplier.status, commodity: supplier.commodity || '', country: supplier.country || '', region: supplier.region || 'NAM',
    paymentTerms: supplier.paymentTerms || '', incoterm: supplier.incoterm || '', leadTimeDays: supplier.leadTimeDays ?? 0,
    otdPct: supplier.otdPct ?? 0, ppm: supplier.ppm ?? 0, financialHealth: supplier.financialHealth || '', singleSource: supplier.singleSource || false,
    ownerEmail: supplier.ownerEmail || '', website: supplier.website || '', notes: supplier.notes || '',
  });
  async function submit() {
    setBusy(true);
    try {
      await supApi.update(supplier.id, { ...f, leadTimeDays: Number(f.leadTimeDays) || undefined, otdPct: Number(f.otdPct) || undefined, ppm: Number(f.ppm) || undefined } as Partial<Supplier>);
      toast.success('Proveedor actualizado.', 'Proveedores'); onDone();
    } catch { toast.error('Error.', 'Proveedores'); } finally { setBusy(false); }
  }
  return (
    <Modal title="Editar proveedor" onClose={onClose} wide>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <L label="Nombre" full><input className={supInput} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></L>
        <L label="Calificación"><select className={supInput} value={f.qualificationStatus} onChange={(e) => setF({ ...f, qualificationStatus: e.target.value })}>{Object.keys(QUAL_META).map((k) => <option key={k} value={k}>{QUAL_META[k].label}</option>)}</select></L>
        <L label="Riesgo"><select className={supInput} value={f.riskLevel} onChange={(e) => setF({ ...f, riskLevel: e.target.value })}>{Object.keys(RISK_META).map((k) => <option key={k} value={k}>{RISK_META[k].label}</option>)}</select></L>
        <L label="Estatus"><select className={supInput} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{['active', 'inactive', 'restricted'].map((s) => <option key={s}>{s}</option>)}</select></L>
        <L label="Commodity"><input className={supInput} value={f.commodity} onChange={(e) => setF({ ...f, commodity: e.target.value })} /></L>
        <L label="País"><input className={supInput} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></L>
        <L label="Región"><select className={supInput} value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}>{['NAM', 'LATAM', 'EMEA', 'APAC'].map((r) => <option key={r}>{r}</option>)}</select></L>
        <L label="OTD % (manual / fallback)"><input type="number" className={supInput} value={f.otdPct} onChange={(e) => setF({ ...f, otdPct: Number(e.target.value) })} /></L>
        <L label="PPM (manual / fallback)"><input type="number" className={supInput} value={f.ppm} onChange={(e) => setF({ ...f, ppm: Number(e.target.value) })} /></L>
        <L label="Lead time (d)"><input type="number" className={supInput} value={f.leadTimeDays} onChange={(e) => setF({ ...f, leadTimeDays: Number(e.target.value) })} /></L>
        <L label="Términos"><input className={supInput} value={f.paymentTerms} onChange={(e) => setF({ ...f, paymentTerms: e.target.value })} /></L>
        <L label="Incoterm"><input className={supInput} value={f.incoterm} onChange={(e) => setF({ ...f, incoterm: e.target.value })} /></L>
        <L label="Salud financiera"><select className={supInput} value={f.financialHealth} onChange={(e) => setF({ ...f, financialHealth: e.target.value })}>{['', 'STRONG', 'STABLE', 'WATCH', 'DISTRESSED'].map((s) => <option key={s} value={s}>{s || '—'}</option>)}</select></L>
        <L label="SQE / comprador"><input className={supInput} value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} /></L>
        <L label="Sitio web"><input className={supInput} value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></L>
        <L label="Notas" full><textarea className={supInput} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></L>
      </div>
      <label className="flex items-center gap-2 mt-3 text-sm"><input type="checkbox" checked={f.singleSource} onChange={(e) => setF({ ...f, singleSource: e.target.checked })} /> Fuente única (single-source)</label>
      <Actions busy={busy} onClose={onClose} onSubmit={submit} />
    </Modal>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────
function Metric({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return <div className={`${glass} rounded-2xl p-3.5`}><div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div><div className="text-lg font-semibold mt-0.5 tabular-nums truncate" style={{ color }}>{value}</div>{sub && <div className="text-[10px] text-gray-400 truncate">{sub}</div>}</div>;
}
function MetricSourced({ label, value, color, source, hint }: { label: string; value: string; color: string; source?: MetricSource; hint?: string }) {
  const tag = sourceLabel(source);
  return (
    <div className={`${glass} rounded-2xl p-3.5`}>
      <div className="flex items-center justify-between gap-1"><span className="text-[10px] uppercase tracking-wide text-gray-400">{label}</span>{tag && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300" title="Valor manual — falta fuente para derivarlo">{tag}</span>}{source === 'derived' && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" title="Derivado de datos reales">real</span>}</div>
      <div className="text-lg font-semibold mt-0.5 tabular-nums truncate" style={{ color }}>{value}</div>
      {hint && <div className="text-[10px] text-gray-400 truncate">{hint}</div>}
    </div>
  );
}
function GradeTile({ grade, composite, color }: { grade: string; composite: number | null; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-3.5`}>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">Grade</div>
      <div className="flex items-baseline gap-1.5"><span className="text-2xl font-bold" style={{ color }}>{grade === 'NA' ? '—' : grade}</span>{composite != null && <span className="text-[11px] text-gray-400 tabular-nums">{composite}/100</span>}</div>
    </div>
  );
}
function SourceBadge({ source }: { source?: MetricSource }) {
  if (source === 'derived') return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" title="Derivado de inspecciones IQC reales">real</span>;
  if (source === 'manual') return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300" title="Valor manual — sin inspecciones IQC para derivarlo">manual</span>;
  return null;
}
function TrendPill({ dir }: { dir: string }) {
  const m = dir === 'improving' ? { icon: TrendingUp, color: '#10b981', label: 'Mejora' } : dir === 'declining' ? { icon: TrendingDown, color: '#ef4444', label: 'Empeora' } : { icon: Minus, color: '#6b7280', label: 'Estable' };
  return <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: m.color }}><m.icon className="w-3.5 h-3.5" />{m.label}</span>;
}
function Bar({ label, value, color, note }: { label: string; value: number; color: string; note?: string | null }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-[12px] mb-1"><span className="text-gray-500 flex items-center gap-1.5">{label}{note && <span className="text-[9px] px-1 py-0 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300">{note}</span>}</span><span className="font-medium tabular-nums">{Math.round(value)}%</span></div>
      <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: color }} /></div>
    </div>
  );
}
function EmptyCard({ text }: { text: string }) { return <div className={`${glass} rounded-2xl p-10 text-center text-sm text-gray-400 max-w-2xl mx-auto`}>{text}</div>; }
function L({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) { return <label className={`block ${full ? 'md:col-span-full' : ''}`}><span className="block text-[12px] font-medium text-gray-500 mb-1">{label}</span>{children}</label>; }
function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-16 bg-black/40 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className={`${glass} rounded-3xl p-6 w-full ${wide ? 'max-w-3xl' : 'max-w-xl'}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-semibold">{title}</h3><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button></div>
        {children}
      </div>
    </div>
  );
}
function Actions({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: () => void }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
      <button onClick={onSubmit} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: BLUE }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar</button>
    </div>
  );
}
function Guard() { return <div className="min-h-screen grid place-items-center text-foreground"><div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}><Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" /><h2 className="text-lg font-semibold">Sin acceso</h2></div></div>; }
