'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft, Loader2, Lock, Plus, X, CheckCircle2, Trash2, Pencil, Users,
  ShieldCheck, FileBadge, Boxes, AlertTriangle, Mail, Phone, Globe, MapPin,
  CreditCard, Truck, Star, Award,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/contexts/ToastContext';
import {
  supApi, supInput, money, QUAL_META, RISK_META, CERT_META, scoreColor, otdColor,
  type Supplier360, type Supplier, type SupplierContact, type SupplierCertification,
} from '@/lib/suppliers';

const BLUE = '#3b82f6';
const STANDARDS = ['ISO9001', 'IATF16949', 'ISO13485', 'AS9100', 'ISO14001', 'ROHS', 'REACH', 'UL', 'CONFLICT_MINERALS'];
const ROLES = ['SALES', 'QUALITY', 'LOGISTICS', 'ENGINEERING', 'FINANCE', 'EXECUTIVE', 'OTHER'];
const ROLE_LABEL: Record<string, string> = { SALES: 'Ventas', QUALITY: 'Calidad', LOGISTICS: 'Logística', ENGINEERING: 'Ingeniería', FINANCE: 'Finanzas', EXECUTIVE: 'Dirección', OTHER: 'Otro' };
type Tab = 'overview' | 'contacts' | 'certs' | 'parts' | 'scars';

export default function SupplierDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [modal, setModal] = useState<null | 'contact' | 'cert' | 'edit'>(null);
  const { data, isLoading, forbidden, mutate } = useApi<Supplier360>(`/suppliers/${id}/360`);

  if (forbidden) return <Guard />;
  if (isLoading || !data) return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const { supplier: s, scorecard, metrics, contacts, certifications, parts, scars } = data;
  const qz = QUAL_META[s.qualificationStatus || 'PENDING'] ?? QUAL_META.PENDING;
  const risk = RISK_META[s.riskLevel || 'LOW'] ?? RISK_META.LOW;

  const tabs: { key: Tab; label: string; icon: typeof Users; count?: number }[] = [
    { key: 'overview', label: 'Resumen', icon: ShieldCheck },
    { key: 'contacts', label: 'Contactos', icon: Users, count: contacts.length },
    { key: 'certs', label: 'Certificaciones', icon: FileBadge, count: certifications.length },
    { key: 'parts', label: 'Partes (AVL)', icon: Boxes, count: parts.length },
    { key: 'scars', label: 'SCARs', icon: AlertTriangle, count: scars.length },
  ];

  async function removeContact(cid: number) { try { await supApi.removeContact(cid); mutate(); } catch { toast.error('Error', 'Proveedores'); } }
  async function removeCert(cid: number) { try { await supApi.removeCertification(cid); mutate(); } catch { toast.error('Error', 'Proveedores'); } }

  return (
    <div className="min-h-screen text-black dark:text-white">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/dashboard/suppliers" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="w-10 h-10 rounded-xl grid place-items-center text-white font-bold flex-shrink-0" style={{ background: `linear-gradient(135deg, ${BLUE}, #6366f1)` }}>{s.name.slice(0, 2).toUpperCase()}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight truncate">{s.name}</h1>
            <p className="text-[12px] text-gray-400 leading-tight font-mono">{s.code}{s.commodity ? ` · ${s.commodity}` : ''}</p>
          </div>
          <span className="hidden sm:inline text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${qz.color}1a`, color: qz.color }}>{qz.label}</span>
          <button onClick={() => setModal('edit')} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10" title="Editar"><Pencil className="w-4 h-4" /></button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pt-6 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Metric label="OTD" value={metrics.otdPct != null ? `${metrics.otdPct}%` : '—'} color={otdColor(metrics.otdPct)} />
          <Metric label="PPM" value={metrics.ppm != null ? String(metrics.ppm) : '—'} color={(metrics.ppm ?? 0) > 100 ? '#ef4444' : (metrics.ppm ?? 0) > 50 ? '#f59e0b' : '#10b981'} />
          <Metric label="Calidad" value={`${scorecard.qualityScore}%`} color={scoreColor(scorecard.qualityScore)} />
          <Metric label="SCARs abiertas" value={String(metrics.scars.open)} color={metrics.scars.open ? '#f59e0b' : '#10b981'} />
          <Metric label="Partes (AVL)" value={String(metrics.parts)} color={BLUE} />
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

        {tab === 'overview' && <Overview s={s} scorecard={scorecard} metrics={metrics} risk={risk} />}
        {tab === 'contacts' && <ContactsTab contacts={contacts} onAdd={() => setModal('contact')} onRemove={removeContact} />}
        {tab === 'certs' && <CertsTab certs={certifications} onAdd={() => setModal('cert')} onRemove={removeCert} />}
        {tab === 'parts' && <PartsTab parts={parts} currency={s.currency || 'USD'} />}
        {tab === 'scars' && <ScarsTab scars={scars} />}
      </main>

      {modal === 'contact' && <ContactModal supplierId={id} onClose={() => setModal(null)} onDone={() => { setModal(null); mutate(); }} />}
      {modal === 'cert' && <CertModal supplierId={id} onClose={() => setModal(null)} onDone={() => { setModal(null); mutate(); }} />}
      {modal === 'edit' && <EditModal supplier={s} onClose={() => setModal(null)} onDone={() => { setModal(null); mutate(); }} />}
    </div>
  );
}

function Overview({ s, scorecard, metrics, risk }: { s: Supplier; scorecard: Supplier360['scorecard']; metrics: Supplier360['metrics']; risk: { label: string; color: string } }) {
  const rows: { icon: typeof Globe; label: string; value: React.ReactNode }[] = [
    { icon: Truck, label: 'Tipo', value: s.type || '—' },
    { icon: Globe, label: 'Región / País', value: [s.region, s.country].filter(Boolean).join(' · ') || '—' },
    { icon: MapPin, label: 'Ciudad', value: s.city || '—' },
    { icon: CreditCard, label: 'Términos', value: [s.paymentTerms, s.incoterm].filter(Boolean).join(' · ') || '—' },
    { icon: Truck, label: 'Lead time', value: s.leadTimeDays != null ? `${s.leadTimeDays} días` : '—' },
    { icon: Award, label: 'Salud financiera', value: s.financialHealth || '—' },
  ];
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

        {/* IQC + SCAR engine metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className={`${glass} rounded-2xl p-5`}>
            <h4 className="text-sm font-semibold mb-3">Calidad de entrada (IQC)</h4>
            <div className="flex items-end gap-3"><div className="text-3xl font-bold tabular-nums" style={{ color: scoreColor(metrics.iqc.passRate) }}>{metrics.iqc.passRate}%</div><div className="text-[12px] text-gray-400 mb-1.5">aceptación</div></div>
            <div className="text-[12px] text-gray-400 mt-1">{metrics.iqc.passed}/{metrics.iqc.total} inspecciones · {metrics.iqc.failed} rechazos</div>
          </div>
          <div className={`${glass} rounded-2xl p-5`}>
            <h4 className="text-sm font-semibold mb-3">SCARs</h4>
            <div className="flex items-end gap-3"><div className="text-3xl font-bold tabular-nums" style={{ color: metrics.scars.open ? '#f59e0b' : '#10b981' }}>{metrics.scars.open}</div><div className="text-[12px] text-gray-400 mb-1.5">abiertas</div></div>
            <div className="text-[12px] text-gray-400 mt-1">{metrics.scars.closed} cerradas · cierre prom. {metrics.scars.avgClosureDays}d</div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className={`${glass} rounded-2xl p-5`}>
          <h3 className="text-sm font-semibold mb-4">Scorecard</h3>
          <Bar label="Calidad" value={scorecard.qualityScore} color={scoreColor(scorecard.qualityScore)} />
          <Bar label="Respuesta" value={scorecard.responseScore} color={scoreColor(scorecard.responseScore)} />
          {s.responsivenessScore != null && <Bar label="Comunicación" value={s.responsivenessScore} color={scoreColor(s.responsivenessScore)} />}
          <div className="flex items-center justify-between text-[13px] mt-4 pt-4 border-t border-black/5 dark:border-white/10">
            <span className="text-gray-400">Nivel de riesgo</span>
            <span className="inline-flex items-center gap-1 font-medium" style={{ color: risk.color }}><ShieldCheck className="w-3.5 h-3.5" />{risk.label}</span>
          </div>
          <div className="flex items-center justify-between text-[13px] mt-2"><span className="text-gray-400">SQE / comprador</span><span className="font-medium truncate ml-2">{s.ownerEmail || '—'}</span></div>
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

function ContactsTab({ contacts, onAdd, onRemove }: { contacts: SupplierContact[]; onAdd: () => void; onRemove: (id: number) => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4"><h2 className="text-sm font-semibold">Contactos <span className="text-gray-400">({contacts.length})</span></h2><button onClick={onAdd} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white" style={{ background: BLUE }}><Plus className="w-3.5 h-3.5" /> Contacto</button></div>
      {contacts.length === 0 ? <EmptyCard text="Sin contactos del proveedor." /> : (
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
      {certs.length === 0 ? <EmptyCard text="Sin certificaciones registradas (ISO 9001, IATF 16949, ISO 13485…)." /> : (
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

function PartsTab({ parts, currency }: { parts: Supplier360['parts']; currency: string }) {
  if (parts.length === 0) return <EmptyCard text="Sin partes ligadas (AVL). Las partes surtidas aparecen aquí desde el catálogo de precios." />;
  return (
    <div className={`${glass} rounded-2xl overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead><tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-black/5 dark:border-white/10">
            <th className="text-left font-medium px-4 py-2.5">Parte</th>
            <th className="text-right font-medium px-3 py-2.5">Precio</th>
            <th className="text-right font-medium px-3 py-2.5">MOQ</th>
            <th className="text-right font-medium px-3 py-2.5">Lead time</th>
            <th className="text-center font-medium px-3 py-2.5">Preferido</th>
          </tr></thead>
          <tbody>
            {parts.map((p) => (
              <tr key={p.id} className="border-b border-black/[0.03] dark:border-white/[0.04]">
                <td className="px-4 py-2.5 font-mono">{p.partNumber}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(p.unitPrice, p.currency || currency)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{p.moq.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{p.leadTimeDays} d</td>
                <td className="px-3 py-2.5 text-center">{p.preferred ? <Star className="w-4 h-4 fill-amber-400 text-amber-400 inline" /> : <span className="text-gray-300">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScarsTab({ scars }: { scars: Supplier360['scars'] }) {
  if (scars.length === 0) return <EmptyCard text="Sin SCARs (acciones correctivas de proveedor)." />;
  const sevColor: Record<string, string> = { minor: '#6b7280', major: '#f59e0b', critical: '#ef4444' };
  return (
    <div className="space-y-2.5">
      {scars.map((sc) => (
        <div key={sc.id} className={`${glass} rounded-2xl p-4`}>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{sc.scarNumber}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${sevColor[sc.severity] || '#6b7280'}1f`, color: sevColor[sc.severity] || '#6b7280' }}>{sc.severity}</span>
            <span className="text-[11px] text-gray-400">{sc.status}</span>
          </div>
          <div className="font-medium text-sm">{sc.issueSummary || sc.partNumber}</div>
          <div className="text-[12px] text-gray-400">parte {sc.partNumber}</div>
        </div>
      ))}
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
        <L label="OTD %"><input type="number" className={supInput} value={f.otdPct} onChange={(e) => setF({ ...f, otdPct: Number(e.target.value) })} /></L>
        <L label="PPM"><input type="number" className={supInput} value={f.ppm} onChange={(e) => setF({ ...f, ppm: Number(e.target.value) })} /></L>
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
function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className={`${glass} rounded-2xl p-3.5`}><div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div><div className="text-lg font-semibold mt-0.5 tabular-nums truncate" style={{ color }}>{value}</div></div>;
}
function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-[12px] mb-1"><span className="text-gray-500">{label}</span><span className="font-medium tabular-nums">{value}%</span></div>
      <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: color }} /></div>
    </div>
  );
}
function EmptyCard({ text }: { text: string }) { return <div className={`${glass} rounded-2xl p-10 text-center text-sm text-gray-400`}>{text}</div>; }
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
function Guard() { return <div className="min-h-screen grid place-items-center text-black dark:text-white"><div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}><Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" /><h2 className="text-lg font-semibold">Sin acceso</h2></div></div>; }
