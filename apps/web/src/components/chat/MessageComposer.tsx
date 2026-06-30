'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Smile,
  Paperclip,
  ImageIcon,
  Table as TableIcon,
  Send,
  SpellCheck,
  Plus,
  Check,
  X,
  Mic,
  Square,
  Trash2,
  BarChart3,
  Clock,
  Film,
  MapPin,
  Contact,
  Type,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Quote,
  List,
  ListOrdered,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import type { ChatUser } from '@/lib/chatApi';
import { avatarStyle } from '@/lib/chat/avatar';
import { EmojiStickerPicker } from './EmojiStickerPicker';
import { autocorrectText, getWordCompletions } from '@/lib/chat/autocorrect';
import { searchEmojis } from '@/lib/chat/emojis';
import { tableTemplate } from '@/lib/chat/markdown';

interface MessageComposerProps {
  value: string;
  onChange: (v: string) => void;
  /** Envía un mensaje de texto (ya con autocorrección aplicada si está activa). */
  onSubmitText: (text: string) => void;
  /** El padre decide cómo manejar la imagen (preview + envío). */
  onAttachImage: (file: File) => void;
  /** El padre envía el archivo genérico. */
  onAttachFile: (file: File) => void;
  onTyping?: () => void;
  /** Miembros de la conversación activa, para autocompletar @menciones. */
  mentionUsers?: ChatUser[];
  autocorrect: boolean;
  onAutocorrectChange: (b: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
  /** Al cambiar (p. ej. id de conversación), enfoca el campo de texto. */
  autoFocusKey?: string;
  /** Abrir el creador de encuestas (desde el menú "+"). */
  onCreatePoll?: () => void;
  /** Abrir el programador de mensajes (desde el menú "+"). */
  onSchedule?: () => void;
  /** Abrir el selector de GIFs. */
  onPickGif?: () => void;
  /** Compartir mi ubicación actual. */
  onShareLocation?: () => void;
  /** Compartir el contacto de un compañero. */
  onShareContact?: () => void;
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Token `@parcial` al final del texto (hasta el cursor), o null. */
function mentionTokenBefore(text: string): string | null {
  const m = /(?:^|\s)@([a-zA-Z0-9._-]*)$/.exec(text);
  return m ? m[1] : null;
}

/** Token `:parcial` (shortcode de emoji) al final del texto, o null. */
function shortcodeBefore(text: string): string | null {
  const m = /(?:^|\s):([a-z0-9_+-]{2,})$/.exec(text);
  return m ? m[1] : null;
}

export function MessageComposer({
  value,
  onChange,
  onSubmitText,
  onAttachImage,
  onAttachFile,
  onTyping,
  mentionUsers = [],
  autocorrect,
  onAutocorrectChange,
  disabled = false,
  placeholder = 'Escribe un mensaje…',
  compact = false,
  autoFocusKey,
  onCreatePoll,
  onSchedule,
  onPickGif,
  onShareLocation,
  onShareContact,
}: MessageComposerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showFormat, setShowFormat] = useState(false);
  const [caret, setCaret] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordSecs, setRecordSecs] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);

  // Cierra el picker / menú "+" al hacer clic fuera del composer.
  useEffect(() => {
    if (!showPicker && !showActions) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setShowPicker(false);
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showPicker, showActions]);

  // Autosize del textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, compact ? 120 : 160)}px`;
  }, [value, compact]);

  // Enfoca el campo al abrir/cambiar de conversación (comodidad: escribir ya).
  useEffect(() => {
    if (autoFocusKey) textareaRef.current?.focus();
  }, [autoFocusKey]);

  // Limpieza de la grabación al desmontar.
  useEffect(() => {
    return () => {
      recordStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, []);

  // ── Notas de voz ────────────────────────────────────────────────────────────
  function discardRecorded() {
    setRecordedUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
    recordedBlobRef.current = null;
    setRecordSecs(0);
  }
  async function startRecording() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia)
      return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      const mr = new MediaRecorder(stream);
      recordChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) recordChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(recordChunksRef.current, {
          type: mr.mimeType || 'audio/webm',
        });
        recordedBlobRef.current = blob;
        setRecordedUrl(URL.createObjectURL(blob));
        recordStreamRef.current?.getTracks().forEach((t) => t.stop());
        recordStreamRef.current = null;
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setShowPicker(false);
      setShowActions(false);
      setRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = setInterval(
        () => setRecordSecs((s) => s + 1),
        1000,
      );
    } catch {
      /* permiso de micrófono denegado */
    }
  }
  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecording(false);
  }
  function cancelRecording() {
    const mr = mediaRecorderRef.current;
    if (mr) {
      mr.onstop = null;
      mr.stop();
    }
    mediaRecorderRef.current = null;
    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordStreamRef.current = null;
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecording(false);
    discardRecorded();
  }
  function sendRecorded() {
    const blob = recordedBlobRef.current;
    if (!blob) return;
    const ext = blob.type.includes('mp4') || blob.type.includes('mpeg') ? 'm4a' : 'webm';
    const file = new File([blob], `nota-de-voz-${Date.now()}.${ext}`, {
      type: blob.type || 'audio/webm',
    });
    onAttachFile(file);
    discardRecorded();
  }
  function fmtSecs(s: number): string {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function syncCaret() {
    const el = textareaRef.current;
    if (el) setCaret(el.selectionStart ?? value.length);
  }

  // ── Autocompletados (prioridad: @mención > :emoji > palabra) ────────────────
  const upToCaret = value.slice(0, caret);
  const mentionQuery = mentionTokenBefore(upToCaret);
  const shortcode = mentionQuery === null ? shortcodeBefore(upToCaret) : null;

  const mentionCandidates =
    mentionQuery !== null
      ? mentionUsers
          .filter((u) =>
            (u.username || u.email || '')
              .toLowerCase()
              .includes(mentionQuery.toLowerCase()),
          )
          .slice(0, 6)
      : [];

  const emojiCandidates = shortcode ? searchEmojis(shortcode, 12) : [];

  const wordComp =
    mentionQuery === null && !shortcode
      ? getWordCompletions(value, caret)
      : { partial: '', start: caret, suggestions: [] };

  const anyPopup =
    mentionCandidates.length > 0 ||
    emojiCandidates.length > 0 ||
    wordComp.suggestions.length > 0;

  // Reemplaza el rango [start, caret) por `text` y reubica el cursor.
  function replaceRange(start: number, text: string) {
    const next = value.slice(0, start) + text + value.slice(caret);
    onChange(next);
    const pos = start + text.length;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.setSelectionRange(pos, pos);
        el.focus();
        setCaret(pos);
      }
    });
  }

  function insertAtCaret(text: string) {
    replaceRange(caret, text);
  }

  // Aplica formato Markdown a la selección actual del textarea.
  type FormatKind =
    | 'bold'
    | 'italic'
    | 'strike'
    | 'code'
    | 'quote'
    | 'ul'
    | 'ol';
  function formatSelection(kind: FormatKind) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;

    const focusRange = (from: number, to: number) => {
      requestAnimationFrame(() => {
        const e2 = textareaRef.current;
        if (e2) {
          e2.focus();
          e2.setSelectionRange(from, to);
          setCaret(to);
        }
      });
    };

    if (kind === 'quote' || kind === 'ul' || kind === 'ol') {
      // Prefijo por línea sobre el bloque seleccionado (o la línea del cursor).
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const block = value.slice(lineStart, end);
      const prefixed = block
        .split('\n')
        .map((l, i) =>
          (kind === 'quote' ? '> ' : kind === 'ul' ? '- ' : `${i + 1}. `) + l,
        )
        .join('\n');
      const next = value.slice(0, lineStart) + prefixed + value.slice(end);
      onChange(next);
      focusRange(lineStart, lineStart + prefixed.length);
      return;
    }

    const wrap =
      kind === 'bold' ? '**' : kind === 'strike' ? '~~' : kind === 'code' ? '`' : '_';
    const placeholderText =
      kind === 'bold'
        ? 'negrita'
        : kind === 'italic'
          ? 'cursiva'
          : kind === 'strike'
            ? 'tachado'
            : 'código';
    const inner = value.slice(start, end) || placeholderText;
    const next = value.slice(0, start) + wrap + inner + wrap + value.slice(end);
    onChange(next);
    focusRange(start + wrap.length, start + wrap.length + inner.length);
  }

  function applyMention(u: ChatUser) {
    const handle = u.username || u.email || '';
    const atIdx = upToCaret.lastIndexOf('@');
    if (atIdx < 0) return insertAtCaret(`@${handle} `);
    replaceRange(atIdx, `@${handle} `);
  }

  function applyShortcode(emoji: string) {
    const colonIdx = upToCaret.lastIndexOf(':');
    if (colonIdx < 0) return insertAtCaret(emoji);
    replaceRange(colonIdx, emoji);
  }

  function applyWord(word: string) {
    replaceRange(wordComp.start, `${word} `);
  }

  // Acepta la primera sugerencia activa (Enter/Tab). Devuelve true si actuó.
  function acceptFirstSuggestion(): boolean {
    if (mentionCandidates.length > 0) {
      applyMention(mentionCandidates[0]);
      return true;
    }
    if (emojiCandidates.length > 0) {
      applyShortcode(emojiCandidates[0]);
      return true;
    }
    if (wordComp.suggestions.length > 0) {
      applyWord(wordComp.suggestions[0]);
      return true;
    }
    return false;
  }

  function send() {
    const text = autocorrect ? autocorrectText(value) : value;
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmitText(trimmed);
    onChange('');
    setShowPicker(false);
    setCaret(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      setShowPicker(false);
      return;
    }
    if (e.key === 'Tab' && anyPopup) {
      e.preventDefault();
      acceptFirstSuggestion();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (anyPopup) {
        e.preventDefault();
        acceptFirstSuggestion();
        return;
      }
      e.preventDefault();
      send();
    }
  }

  function pickFile(input: HTMLInputElement | null, asImage: boolean) {
    const f = input?.files?.[0];
    if (!f) return;
    if (asImage || f.type.startsWith('image/')) onAttachImage(f);
    else onAttachFile(f);
    if (input) input.value = '';
  }

  const iconBtn =
    'rounded-full p-2 text-gray-500 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-white/10 disabled:opacity-40';

  return (
    <div className="relative" ref={rootRef}>
      {/* Selector de emojis/stickers */}
      {showPicker && (
        <div className="absolute bottom-14 left-2 z-30">
          <EmojiStickerPicker
            onPickEmoji={(emoji) => insertAtCaret(emoji)}
            onPickSticker={(s) => {
              onSubmitText(s);
              setShowPicker(false);
            }}
          />
        </div>
      )}

      {/* Popup de autocompletado */}
      {anyPopup && !showPicker && (
        <div
          className={`${glass} absolute bottom-14 left-2 right-2 z-20 max-h-48 overflow-y-auto rounded-2xl p-1`}
        >
          {mentionCandidates.map((u) => (
            <button
              key={u.id}
              onMouseDown={(e) => {
                e.preventDefault();
                applyMention(u);
              }}
              className="flex w-full items-center gap-2 rounded-xl p-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={avatarStyle(u.id)}
              >
                {initials(u.username || u.email)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {u.username || u.email}
                </span>
                <span className="block truncate text-xs text-gray-500">{u.role}</span>
              </span>
            </button>
          ))}

          {emojiCandidates.length > 0 && (
            <div className="flex flex-wrap gap-0.5 p-1">
              {emojiCandidates.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyShortcode(emoji);
                  }}
                  className="rounded-lg p-1 text-xl leading-none hover:bg-black/5 dark:hover:bg-white/10"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {mentionCandidates.length === 0 &&
            emojiCandidates.length === 0 &&
            wordComp.suggestions.map((w) => (
              <button
                key={w}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyWord(w);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                <SpellCheck className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                {w}
              </button>
            ))}
        </div>
      )}

      {/* Inputs ocultos */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={() => pickFile(imageInputRef.current, true)}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={() => pickFile(fileInputRef.current, false)}
      />

      {recording ? (
        <div className="flex items-center gap-3 rounded-2xl bg-black/5 px-4 py-2.5 dark:bg-white/10">
          <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
          <span className="flex-1 text-sm font-medium tabular-nums">
            Grabando… {fmtSecs(recordSecs)}
          </span>
          <button
            type="button"
            onClick={cancelRecording}
            className={iconBtn}
            aria-label="Cancelar grabación"
          >
            <Trash2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={stopRecording}
            className="rounded-full bg-blue-600 p-2.5 text-white"
            aria-label="Detener grabación"
          >
            <Square className="h-4 w-4" />
          </button>
        </div>
      ) : recordedUrl ? (
        <div className="flex items-center gap-2 rounded-2xl bg-black/5 px-3 py-2 dark:bg-white/10">
          <button
            type="button"
            onClick={discardRecorded}
            className={iconBtn}
            aria-label="Descartar nota de voz"
          >
            <Trash2 className="h-5 w-5" />
          </button>
          <audio src={recordedUrl} controls className="h-10 min-w-0 flex-1" />
          <button
            type="button"
            onClick={sendRecorded}
            className="rounded-full bg-blue-600 p-2.5 text-white"
            aria-label="Enviar nota de voz"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
        {showFormat && (
          <div className="mb-1.5 flex items-center gap-0.5 rounded-2xl bg-black/5 px-2 py-1 dark:bg-white/10">
            {(
              [
                { k: 'bold', icon: <Bold className="h-4 w-4" />, label: 'Negrita' },
                { k: 'italic', icon: <Italic className="h-4 w-4" />, label: 'Cursiva' },
                { k: 'strike', icon: <Strikethrough className="h-4 w-4" />, label: 'Tachado' },
                { k: 'code', icon: <Code className="h-4 w-4" />, label: 'Código' },
                { k: 'quote', icon: <Quote className="h-4 w-4" />, label: 'Cita' },
                { k: 'ul', icon: <List className="h-4 w-4" />, label: 'Lista' },
                { k: 'ol', icon: <ListOrdered className="h-4 w-4" />, label: 'Lista numerada' },
              ] as const
            ).map((b) => (
              <button
                key={b.k}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => formatSelection(b.k)}
                aria-label={b.label}
                title={b.label}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-black/10 dark:text-gray-300 dark:hover:bg-white/15"
              >
                {b.icon}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1">
          <button
            type="button"
            onClick={() => {
              setShowPicker((s) => !s);
              setShowActions(false);
            }}
            className={iconBtn}
            aria-label="Emojis y stickers"
            aria-expanded={showPicker}
            disabled={disabled}
          >
          {showPicker ? <X className="h-5 w-5" /> : <Smile className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={() => setShowFormat((s) => !s)}
          className={`${iconBtn} ${showFormat ? 'bg-black/10 dark:bg-white/15' : ''}`}
          aria-label="Formato de texto"
          aria-pressed={showFormat}
          disabled={disabled}
        >
          <Type className="h-5 w-5" />
        </button>

        {/* Menú "+" de adjuntos y herramientas (descongestiona la barra) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowActions((s) => !s);
              setShowPicker(false);
            }}
            className={`${iconBtn} ${showActions ? 'bg-black/10 dark:bg-white/15' : ''}`}
            aria-label="Adjuntar y más"
            aria-expanded={showActions}
            disabled={disabled}
          >
            <Plus
              className={`h-5 w-5 transition-transform ${showActions ? 'rotate-45' : ''}`}
            />
          </button>
          {showActions && (
            <div
              className={`${glass} absolute bottom-12 left-0 z-30 w-48 rounded-2xl p-1 shadow-xl`}
            >
              <button
                type="button"
                onClick={() => {
                  imageInputRef.current?.click();
                  setShowActions(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                <ImageIcon className="h-4 w-4 text-blue-500" /> Foto
              </button>
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowActions(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Paperclip className="h-4 w-4 text-violet-500" /> Archivo
              </button>
              {onPickGif && (
                <button
                  type="button"
                  onClick={() => {
                    onPickGif();
                    setShowActions(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <Film className="h-4 w-4 text-fuchsia-500" /> GIF
                </button>
              )}
              {onShareLocation && (
                <button
                  type="button"
                  onClick={() => {
                    onShareLocation();
                    setShowActions(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <MapPin className="h-4 w-4 text-rose-500" /> Ubicación
                </button>
              )}
              {onShareContact && (
                <button
                  type="button"
                  onClick={() => {
                    onShareContact();
                    setShowActions(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <Contact className="h-4 w-4 text-teal-500" /> Contacto
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const prefix = value && !value.endsWith('\n') ? '\n' : '';
                  insertAtCaret(`${prefix}${tableTemplate(2, 2)}\n`);
                  setShowActions(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                <TableIcon className="h-4 w-4 text-emerald-500" /> Tabla
              </button>
              {onCreatePoll && (
                <button
                  type="button"
                  onClick={() => {
                    onCreatePoll();
                    setShowActions(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <BarChart3 className="h-4 w-4 text-pink-500" /> Encuesta
                </button>
              )}
              {onSchedule && (
                <button
                  type="button"
                  onClick={() => {
                    onSchedule();
                    setShowActions(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <Clock className="h-4 w-4 text-sky-500" /> Programar
                </button>
              )}
              <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
              <button
                type="button"
                onClick={() => onAutocorrectChange(!autocorrect)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                aria-pressed={autocorrect}
              >
                <SpellCheck className="h-4 w-4 text-amber-500" />
                <span className="flex-1">Autocorrector</span>
                {autocorrect && <Check className="h-4 w-4 text-blue-500" />}
              </button>
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          aria-label="Escribe un mensaje"
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            onTyping?.();
          }}
          onKeyUp={syncCaret}
          onClick={syncCaret}
          onSelect={syncCaret}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="max-h-40 flex-1 resize-none rounded-2xl bg-black/5 px-4 py-2 text-sm outline-none placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:bg-white/10"
        />
        {value.trim() ? (
          <button
            type="button"
            onClick={send}
            disabled={disabled}
            className="rounded-full bg-blue-600 p-2.5 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-40"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled}
            className="rounded-full bg-blue-600 p-2.5 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-40"
            aria-label="Grabar nota de voz"
            title="Nota de voz"
          >
            <Mic className="h-4 w-4" />
          </button>
        )}
      </div>
      </>
      )}
    </div>
  );
}
