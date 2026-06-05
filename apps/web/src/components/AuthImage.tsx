'use client';

import React, { useEffect, useState } from 'react';
import { fetchImageBlob } from '@/lib/chatApi';

/**
 * Imagen de mensaje protegida por JWT. Como un <img src> no puede mandar el
 * header Authorization, la traemos con fetch + Bearer y la mostramos como blob.
 */
export function AuthImage({ messageId, alt }: { messageId: string; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let active = true;
    fetchImageBlob(messageId)
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
      <div className="text-xs text-gray-400 italic">No se pudo cargar la imagen</div>
    );
  }
  if (!url) {
    return <div className="h-40 w-56 animate-pulse rounded-[18px] bg-gray-200 dark:bg-white/10" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt ?? 'imagen'}
      className="max-h-72 max-w-[18rem] rounded-[18px] object-cover"
    />
  );
}
