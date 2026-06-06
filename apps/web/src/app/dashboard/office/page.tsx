'use client';
 

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, FileText, Table, Presentation, Plus, Trash2, Loader2, Lock } from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

type DocType = 'doc' | 'sheet' | 'slides';
interface OfficeDoc { id: string; type: DocType; title: string; updatedAt?: string; createdBy?: string | null }

const TABS: { id: DocType; label: string; icon: typeof FileText; color: string; tint: string }[] = [
  { id: 'doc', label: 'Documentos', icon: FileText, color: 'text-blue-500', tint: 'bg-blue-50 dark:bg-blue-500/10' },
  { id: 'sheet', label: 'Hojas de cálculo', icon: Table, color: 'text-emerald-500', tint: 'bg-emerald-50 dark:bg-emerald-500/10' },
  { id: 'slides', label: 'Presentaciones', icon: Presentation, color: 'text-amber-500', tint: 'bg-amber-50 dark:bg-amber-500/10' },
];

export default function OfficeHubPage() {
  const router = useRouter();
  const [tab, setTab] = useState<DocType>('doc');
  const { data, isLoading, forbidden, mutate } = useApi<OfficeDoc[]>(`/office-documents?type=${tab}`);
  const [busy, setBusy] = useState(false);
  const docs = Array.isArray(data) ? data : [];
  const meta = TABS.find((t) => t.id === tab)!;

  async function create() {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/office-documents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: tab, title: 'Sin título' }),
      });
      const doc = await res.json();
      if (res.ok && doc.id) router.push(`/dashboard/office/${doc.id}`);
    } finally { setBusy(false); }
  }
  async function remove(id: string) {
    await apiFetch(`${API_BASE}/office-documents/${id}`, { method: 'DELETE' });
    mutate();
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4 rounded-none border-x-0 border-t-0 flex items-center justify-between`}>
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </Link>
        <span className="text-sm font-semibold">Office</span>
      </div>

      <main className="max-w-4xl mx-auto px-6 pt-10">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Office</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Documentos, hojas de cálculo y presentaciones — todo dentro de Axos.</p>
        </header>

        <div className={`${glass} inline-flex p-1 rounded-2xl mb-6 gap-1`}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t.id ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex justify-end mb-4">
          <button onClick={create} disabled={busy} className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2 rounded-full hover:scale-[1.03] active:scale-95 transition-transform disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Nuevo {meta.label.toLowerCase()}
          </button>
        </div>

        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
        ) : isLoading ? (
          <div className="flex justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : docs.length === 0 ? (
          <Empty icon={<meta.icon className="w-6 h-6" />} title={`Sin ${meta.label.toLowerCase()}`} body='Crea el primero con "Nuevo".' />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {docs.map((d) => (
              <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`${glass} rounded-2xl p-4 group relative`}>
                <Link href={`/dashboard/office/${d.id}`} className="block">
                  <div className={`inline-flex p-2.5 rounded-xl ${meta.tint} mb-3`}><meta.icon className={`w-5 h-5 ${meta.color}`} /></div>
                  <p className="font-bold truncate">{d.title}</p>
                  <p className="text-[11px] text-gray-400">{d.createdBy ?? ''}</p>
                </Link>
                <button onClick={() => remove(d.id)} className="absolute top-3 right-3 p-1.5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>
              </motion.div>
            ))}
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
