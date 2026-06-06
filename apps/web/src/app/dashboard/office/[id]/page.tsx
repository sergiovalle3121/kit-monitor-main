'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ChevronLeft, Save, Loader2, Check } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const Spinner = () => <div className="flex justify-center py-24 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
const DocEditor = dynamic(() => import('@/components/office/DocEditor').then((m) => m.DocEditor), { ssr: false, loading: Spinner });
const SheetEditor = dynamic(() => import('@/components/office/SheetEditor').then((m) => m.SheetEditor), { ssr: false, loading: Spinner });
const SlidesEditor = dynamic(() => import('@/components/office/SlidesEditor').then((m) => m.SlidesEditor), { ssr: false, loading: Spinner });

interface OfficeDoc { id: string; type: 'doc' | 'sheet' | 'slides'; title: string; content: any }

export default function OfficeEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<OfficeDoc | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch(`${API_BASE}/office-documents/${id}`).then((r) => r.json()).then((d) => {
      if (!active) return;
      setDoc(d); setTitle(d.title ?? ''); setContent(d.content ?? null); setLoading(false);
    }).catch(() => setLoading(false));
    return () => { active = false; };
  }, [id]);

  const onContent = useCallback((c: any) => { setContent(c); setSaved(false); }, []);

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`${API_BASE}/office-documents/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      setSaved(true);
    } finally { setSaving(false); }
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-24">
      <div className={`${glass} sticky top-0 z-40 px-6 py-3 rounded-none border-x-0 border-t-0 flex items-center justify-between gap-4`}>
        <Link href="/dashboard/office" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors flex-shrink-0">
          <ChevronLeft className="w-4 h-4" /> Office
        </Link>
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setSaved(false); }}
          placeholder="Título"
          className="bg-transparent outline-none text-sm font-semibold text-center flex-1 min-w-0"
        />
        <button onClick={save} disabled={saving || saved} className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full transition-all flex-shrink-0 ${saved ? 'text-gray-400' : 'bg-black dark:bg-white text-white dark:text-black hover:scale-[1.03] active:scale-95'}`}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Guardado' : 'Guardar'}
        </button>
      </div>

      <main className="max-w-5xl mx-auto px-4 md:px-6 pt-6">
        {loading || !doc ? (
          <Spinner />
        ) : doc.type === 'doc' ? (
          <DocEditor value={content} onChange={onContent} />
        ) : doc.type === 'sheet' ? (
          <SheetEditor value={content} onChange={onContent} />
        ) : (
          <SlidesEditor value={content} onChange={onContent} />
        )}
      </main>
    </div>
  );
}
