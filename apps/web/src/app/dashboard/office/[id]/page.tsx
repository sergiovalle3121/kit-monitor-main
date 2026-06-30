'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Loader2, FileWarning, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { OfficeShell, OfficeShellMessage, type SaveStatus, type OfficeType } from '@/components/office/OfficeShell';
import { SheetActions } from '@/components/office/SheetActions';
import { SlideActions } from '@/components/office/SlideActions';
import { DocActions } from '@/components/office/DocActions';
import { VersionHistory } from '@/components/office/VersionHistory';
import { ShareButton } from '@/components/office/ShareButton';
import { DocLifecycleActions, type OfficeLifecycleState } from '@/components/office/DocLifecycleActions';
import { DocAuditTimeline } from '@/components/office/DocAuditTimeline';
import { DocSmartRefsPanel } from '@/components/office/DocSmartRefsPanel';
import { DocReviewSummary } from '@/components/office/DocReviewSummary';
import { DocCompatibilityPanel } from '@/components/office/DocCompatibilityPanel';
import { DocReleaseChecklist } from '@/components/office/DocReleaseChecklist';
import { DocDistributionLedger } from '@/components/office/DocDistributionLedger';
import { DocSignaturesPanel } from '@/components/office/DocSignaturesPanel';
import { DocTrainingPanel } from '@/components/office/DocTrainingPanel';
import { DocReviewRoutePanel } from '@/components/office/DocReviewRoutePanel';
import { DocImpactPanel } from '@/components/office/DocImpactPanel';
import { DocEvidencePackagePanel } from '@/components/office/DocEvidencePackagePanel';
import { connectorFreshnessBadge, type AxosConnectorInstance, type AxosConnectorStatusTone } from '@/lib/office/axosConnectors';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const AUTOSAVE_MS = 800;

const Spinner = () => (
  <div className="flex h-full items-center justify-center text-gray-400">
    <Loader2 className="w-6 h-6 animate-spin" />
  </div>
);
const DocEditor = dynamic(() => import('@/components/office/DocEditor').then((m) => m.DocEditor), { ssr: false, loading: Spinner });
const SheetEditor = dynamic(() => import('@/components/office/SheetEditor').then((m) => m.SheetEditor), { ssr: false, loading: Spinner });
const SlidesEditor = dynamic(() => import('@/components/office/SlidesEditor').then((m) => m.SlidesEditor), { ssr: false, loading: Spinner });

interface OfficeDoc {
  id: string;
  type: OfficeType;
  title: string;
  content: any;
  createdBy?: string | null;
  sharedWith?: { email: string; access: 'view' | 'edit' }[] | null;
  lifecycleState?: OfficeLifecycleState;
  locked?: boolean;
  approvedBy?: string | null;
  releasedBy?: string | null;
  obsoletedBy?: string | null;
}

const SHEET_CONNECTOR_TONE_CLASS: Record<AxosConnectorStatusTone, string> = {
  empty: 'text-gray-500 dark:text-gray-400',
  ok: 'text-emerald-600 dark:text-emerald-300',
  due: 'text-amber-600 dark:text-amber-300',
  stale: 'text-red-600 dark:text-red-300',
};

function sheetConnectorsOf(content: any): AxosConnectorInstance[] {
  return Array.isArray(content?.connectors) ? content.connectors : [];
}

export default function OfficeEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  // Gate de escritura centralizado: da WRITE robusto a admin/owner y mantiene en
  // SOLO LECTURA al executive demo (solo *:read). Ver hooks/usePermissions.
  const { canWrite, isAdmin } = usePermissions();

  const [doc, setDoc] = useState<OfficeDoc | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [editorKey, setEditorKey] = useState(0); // bump to remount the editor (e.g. after an import)
  const [docStats, setDocStats] = useState<{ words: number; chars: number } | null>(null);
  const contentRef = useRef<any>(null);
  const titleRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    setLoading(true);
    apiFetch(`${API_BASE}/office-documents/${id}`).then(async (r) => {
      if (!active) return;
      if (!r.ok) {
        setError(r.status === 403
          ? 'No tienes acceso a este documento.'
          : `No se pudo abrir el documento (HTTP ${r.status}).`);
        setLoading(false);
        return;
      }
      const d = await r.json();
      setDoc(d);
      setTitle(d.title ?? '');
      setContent(d.content ?? null);
      titleRef.current = d.title ?? '';
      contentRef.current = d.content ?? null;
      setStatus('saved');
      setLoading(false);
    }).catch(() => {
      if (active) { setError('Error de red al abrir el documento.'); setLoading(false); }
    });
    return () => { active = false; mountedRef.current = false; if (timerRef.current) clearTimeout(timerRef.current); };
  }, [id]);

  const doSave = useCallback(async () => {
    if (!canWrite || doc?.locked || !dirtyRef.current) return;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    dirtyRef.current = false;
    if (mountedRef.current) setStatus('saving');
    try {
      const r = await apiFetch(`${API_BASE}/office-documents/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleRef.current, content: contentRef.current }),
      });
      if (!r.ok) throw new Error(String(r.status));
      if (mountedRef.current) { setStatus('saved'); setSavedAt(Date.now()); }
    } catch {
      dirtyRef.current = true;
      if (mountedRef.current) setStatus('error');
    }
  }, [id, canWrite, doc?.locked]);

  const scheduleSave = useCallback(() => {
    if (!canWrite || doc?.locked) return;
    dirtyRef.current = true;
    setStatus('unsaved');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doSave, AUTOSAVE_MS);
  }, [canWrite, doc?.locked, doSave]);

  const onContent = useCallback((c: any) => { contentRef.current = c; setContent(c); scheduleSave(); }, [scheduleSave]);
  const onTitle = useCallback((v: string) => { titleRef.current = v; setTitle(v); scheduleSave(); }, [scheduleSave]);

  // Replace the whole document content (used by import) and remount the editor.
  const replaceContent = useCallback((c: any) => {
    contentRef.current = c; setContent(c); setEditorKey((k) => k + 1); scheduleSave();
  }, [scheduleSave]);

  // Restore from version history: the server already persisted it, so mark saved.
  const onRestored = useCallback((c: any, t: string) => {
    contentRef.current = c; setContent(c);
    titleRef.current = t; setTitle(t);
    setEditorKey((k) => k + 1);
    dirtyRef.current = false;
    setStatus('saved'); setSavedAt(Date.now());
  }, []);

  // Ctrl/Cmd+S → save immediately (and swallow the browser save dialog).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); doSave(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doSave]);

  // Best-effort flush of pending edits when leaving the page.
  useEffect(() => {
    const flush = () => { if (dirtyRef.current) doSave(); };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [doSave]);

  if (error) {
    return (
      <OfficeShellMessage>
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-500"><FileWarning className="w-7 h-7" /></div>
        <h2 className="font-bold text-lg">No se pudo abrir</h2>
        <p className="text-sm text-gray-500 max-w-sm">{error}</p>
        <Link href="/dashboard/office" className="mt-2 text-sm font-semibold text-blue-500 hover:underline">Volver a Office</Link>
      </OfficeShellMessage>
    );
  }
  if (loading || authLoading || !doc) {
    return <OfficeShellMessage><Loader2 className="w-7 h-7 animate-spin text-gray-400" /><p className="text-sm text-gray-500">Abriendo documento…</p></OfficeShellMessage>;
  }

  const readOnly = !canWrite || !!doc.locked;
  const editorProps = { value: content, onChange: onContent, readOnly };
  const typeActions = doc.type === 'sheet'
    ? <SheetActions content={content} title={title} onImport={replaceContent} readOnly={readOnly} />
    : doc.type === 'slides'
      ? <SlideActions content={content} title={title} />
      : doc.type === 'doc'
        ? <DocActions content={content} title={title} onImport={replaceContent} readOnly={readOnly} docId={id} />
        : null;
  const isOwner = isAdmin || (!!doc.createdBy && doc.createdBy === user?.email);
  const actions = (
    <>
      <DocLifecycleActions
        docId={id}
        state={doc.lifecycleState ?? 'draft'}
        locked={doc.locked}
        canEdit={canWrite}
        isOwner={isOwner}
        onChanged={(next) => {
          setDoc((current) => current ? { ...current, ...next } : current);
          dirtyRef.current = false;
          setStatus(next.locked ? 'readonly' : 'saved');
        }}
      />
      {typeActions}
      {doc.type === 'doc' && <DocReleaseChecklist content={content} docId={id} />}
      {doc.type === 'doc' && <DocCompatibilityPanel content={content} />}
      {doc.type === 'doc' && <DocSmartRefsPanel content={content} />}
      {doc.type === 'doc' && <DocImpactPanel content={content} currentDocId={id} />}
      {doc.type === 'doc' && <DocEvidencePackagePanel docId={id} title={title} />}
      <DocReviewRoutePanel docId={id} isOwner={isOwner} />
      <DocTrainingPanel docId={id} isOwner={isOwner} />
      <DocSignaturesPanel docId={id} canSign={canWrite} />
      <DocDistributionLedger docId={id} />
      <DocAuditTimeline docId={id} />
      {isOwner && canWrite && <ShareButton docId={id} initialShares={doc.sharedWith ?? []} />}
      <VersionHistory docId={id} canEdit={!readOnly} onRestored={onRestored} currentContent={content} />
    </>
  );
  const pptxIssues = doc.type === 'slides' && Array.isArray(content?.pptxCompatibility?.issues)
    ? content.pptxCompatibility.issues
    : [];
  const sheetConnectorBadge = doc.type === 'sheet' ? connectorFreshnessBadge(sheetConnectorsOf(content)) : null;
  const statusBarRight = doc.type === 'sheet' && sheetConnectorBadge
    ? (
      <span className={`inline-flex items-center gap-1 ${SHEET_CONNECTOR_TONE_CLASS[sheetConnectorBadge.tone]}`} title={sheetConnectorBadge.title}>
        <RefreshCw className="h-3.5 w-3.5" /> {sheetConnectorBadge.label}
      </span>
    )
    : doc.type === 'doc' && docStats
    ? <span>{docStats.words} palabras · {docStats.chars} caracteres</span>
    : doc.type === 'slides' && pptxIssues.length
      ? (
        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300" title={pptxIssues.slice(0, 5).map((x: any) => x.message).join(' ')}>
          <FileWarning className="h-3.5 w-3.5" /> {pptxIssues.length} aviso(s) PPTX
        </span>
      )
      : null;
  // Los editores con ribbon muestran las acciones de archivo en su pestaña
  // «Archivo»; el resto las mantiene en el header hasta su migración.
  // Los tres editores llevan ya sus acciones de archivo en la pestaña «Archivo»
  // del ribbon, así el header queda limpio (título + estado + pantalla completa).
  const ribbonArchivo = doc.type === 'doc' || doc.type === 'sheet' || doc.type === 'slides';
  const headerActions = ribbonArchivo ? null : actions;

  return (
    <OfficeShell type={doc.type} title={title} onTitleChange={onTitle} status={status} savedAt={savedAt} readOnly={readOnly} actions={headerActions} statusBarLeft={<span>{doc.lifecycleState ?? 'draft'}{doc.locked ? ' · bloqueado' : ''}</span>} statusBarRight={statusBarRight}>
      {doc.type === 'doc' ? <DocEditor key={editorKey} {...editorProps} author={user?.email ?? ''} onStats={setDocStats} fileActions={actions} title={title} docId={id} />
        : doc.type === 'sheet' ? <SheetEditor key={editorKey} {...editorProps} fileActions={actions} />
        : doc.type === 'slides' ? <SlidesEditor key={editorKey} {...editorProps} fileActions={actions} docId={id} />
        : <div className="py-20 text-center text-sm text-gray-400">Tipo de documento desconocido.</div>}
    </OfficeShell>
  );
}
