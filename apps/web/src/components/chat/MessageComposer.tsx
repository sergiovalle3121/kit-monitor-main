'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Smile,
  Paperclip,
  ImageIcon,
  Table as TableIcon,
  Send,
  SpellCheck,
  X,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import type { ChatUser } from '@/lib/chatApi';
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
}: MessageComposerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [caret, setCaret] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Autosize del textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, compact ? 120 : 160)}px`;
  }, [value, compact]);

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
    <div className="relative">
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
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-[10px] font-bold text-white">
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
                <SpellCheck className="h-3.5 w-3.5 text-gray-400" />
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

      <div className="flex items-end gap-1">
        <button
          type="button"
          onClick={() => setShowPicker((s) => !s)}
          className={iconBtn}
          aria-label="Emojis y stickers"
          aria-expanded={showPicker}
          disabled={disabled}
        >
          {showPicker ? <X className="h-5 w-5" /> : <Smile className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={iconBtn}
          aria-label="Adjuntar archivo"
          disabled={disabled}
        >
          <Paperclip className="h-5 w-5" />
        </button>
        {!compact && (
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className={iconBtn}
            aria-label="Adjuntar imagen"
            disabled={disabled}
          >
            <ImageIcon className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            const prefix = value && !value.endsWith('\n') ? '\n' : '';
            insertAtCaret(`${prefix}${tableTemplate(2, 2)}\n`);
          }}
          className={iconBtn}
          aria-label="Insertar tabla"
          title="Insertar tabla"
          disabled={disabled}
        >
          <TableIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => onAutocorrectChange(!autocorrect)}
          className={`${iconBtn} ${
            autocorrect ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300' : ''
          }`}
          aria-label="Autocorrector"
          aria-pressed={autocorrect}
          title={autocorrect ? 'Autocorrector activado' : 'Autocorrector desactivado'}
          disabled={disabled}
        >
          <SpellCheck className="h-5 w-5" />
        </button>

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
        <button
          type="button"
          onClick={send}
          disabled={disabled || !value.trim()}
          className="rounded-full bg-blue-600 p-2.5 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-40"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
