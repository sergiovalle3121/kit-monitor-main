'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { Image as ImageIcon, Upload, Link as LinkIcon } from 'lucide-react';
import { RibbonMenuButton } from '../ribbon';
import { useToast } from '@/contexts/ToastContext';

const MAX = 5 * 1024 * 1024; // 5 MB

/** Inserción de imagen: subir archivo (data URL) o desde URL. */
export function DocImageInsert({ editor }: { editor: Editor }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const fromUrl = () => {
    const url = window.prompt('URL de la imagen');
    if (url) (editor.chain().focus() as any).setImage({ src: url }).run();
  };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX) { toast.error('La imagen supera 5 MB. Usa una URL para imágenes grandes.'); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') (editor.chain().focus() as any).setImage({ src: reader.result }).run(); };
    reader.readAsDataURL(f);
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <RibbonMenuButton icon={ImageIcon} label="Imagen" menuWidth={210} items={[
        { label: 'Subir desde archivo…', icon: Upload, onClick: () => fileRef.current?.click() },
        { label: 'Desde una URL…', icon: LinkIcon, onClick: fromUrl },
      ]} />
    </>
  );
}
