'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchFileBlobUrl } from '@/lib/chatApi';

/**
 * Nota de voz protegida por JWT. Como un <audio src> no puede mandar el header
 * Authorization, traemos el archivo con fetch + Bearer y lo reproducimos como
 * blob. Las notas de voz se almacenan como archivos con mime `audio/*`.
 */
export function AuthAudio({ messageId, mine }: { messageId: string; mine: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let active = true;
    fetchFileBlobUrl(messageId)
      .then((u) => {
        if (!active) {
          URL.revokeObjectURL(u);
          return;
        }
        revoked = u;
        setUrl(u);
      })
      .catch(() => setError(true));
    return () => {
      active = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [messageId]);

  if (error) {
    return (
      <div className="text-xs italic text-gray-500 dark:text-gray-400">No se pudo cargar el audio</div>
    );
  }
  if (!url) {
    return (
      <div
        className={`flex h-10 w-52 items-center gap-2 rounded-full px-3 ${
          mine ? 'bg-white/15' : 'bg-black/5 dark:bg-white/10'
        }`}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Cargando audio…</span>
      </div>
    );
  }
  return <audio src={url} controls className="h-10 w-56 max-w-full" />;
}
