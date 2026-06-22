'use client';

import React, { useState } from 'react';
import {
  Download,
  File as FileIcon,
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileImage,
  Loader2,
} from 'lucide-react';
import { downloadFile } from '@/lib/chatApi';
import { formatBytes } from '@/lib/chat/format';

/** Icono según el mime / extensión del archivo (componente, no factoría). */
function FileTypeIcon({
  mime,
  name,
  className,
}: {
  mime: string | null | undefined;
  name: string;
  className?: string;
}) {
  const m = (mime || '').toLowerCase();
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (m.startsWith('image/')) return <FileImage className={className} />;
  if (m.includes('pdf') || ext === 'pdf') return <FileText className={className} />;
  if (
    m.includes('sheet') ||
    m.includes('excel') ||
    m.includes('csv') ||
    ['xls', 'xlsx', 'csv'].includes(ext)
  )
    return <FileSpreadsheet className={className} />;
  if (
    m.includes('word') ||
    m.includes('document') ||
    ['doc', 'docx', 'txt', 'rtf'].includes(ext)
  )
    return <FileText className={className} />;
  if (
    m.includes('zip') ||
    m.includes('compressed') ||
    ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)
  )
    return <FileArchive className={className} />;
  return <FileIcon className={className} />;
}

interface Props {
  messageId: string;
  fileName: string;
  fileMime?: string | null;
  fileSize?: number | null;
  mine: boolean;
}

/** Burbuja de archivo adjunto con descarga protegida (Bearer). */
export function FileAttachment({
  messageId,
  fileName,
  fileMime,
  fileSize,
  mine,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleDownload() {
    setBusy(true);
    setError(false);
    try {
      await downloadFile(messageId, fileName);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={busy}
      className={`flex w-60 max-w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors ${
        mine
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15'
      }`}
      title={`Descargar ${fileName}`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          mine ? 'bg-white/20' : 'bg-black/10 dark:bg-white/15'
        }`}
      >
        <FileTypeIcon mime={fileMime} name={fileName} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{fileName}</span>
        <span className={`block text-xs ${mine ? 'text-white/70' : 'text-gray-500'}`}>
          {error
            ? 'Error al descargar'
            : busy
              ? 'Descargando…'
              : fileSize
                ? formatBytes(fileSize)
                : 'Archivo'}
        </span>
      </span>
      <span className="shrink-0">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4 opacity-70" />
        )}
      </span>
    </button>
  );
}
