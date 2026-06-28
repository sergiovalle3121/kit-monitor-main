'use client';

import React from 'react';

/**
 * Tiny dependency-free Markdown renderer for CIDE chat answers. Supports the
 * subset the copilot actually emits: headings, bullet/numbered lists, code
 * fences, and inline **bold**, *italic*, `code` and [links](url). It builds
 * React elements (no dangerouslySetInnerHTML), so it is XSS-safe by construction.
 */

const INLINE =
  /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push(text.slice(last, idx));
    const key = `${keyPrefix}-${i++}`;
    if (m[2] !== undefined) {
      nodes.push(<strong key={key}>{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/15"
        >
          {m[3]}
        </code>,
      );
    } else if (m[4] !== undefined) {
      nodes.push(<em key={key}>{m[4]}</em>);
    } else if (m[5] !== undefined) {
      nodes.push(
        <a
          key={key}
          href={m[6]}
          target="_blank"
          rel="noreferrer"
          className="text-violet-600 underline dark:text-violet-300"
        >
          {m[5]}
        </a>,
      );
    }
    last = idx + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code fence ```
    if (line.trim().startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <pre
          key={key++}
          className="overflow-x-auto rounded-lg bg-black/80 p-2.5 text-xs text-white dark:bg-black/60"
        >
          <code>{buf.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Headings (#, ##, ###)
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      blocks.push(
        <p
          key={key++}
          className={
            h[1].length === 1
              ? 'text-base font-semibold'
              : 'text-sm font-semibold'
          }
        >
          {renderInline(h[2], `h${key}`)}
        </p>,
      );
      i++;
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc space-y-0.5 pl-5">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `ul${key}-${j}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={key++} className="list-decimal space-y-0.5 pl-5">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `ol${key}-${j}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph: gather consecutive plain lines
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !/^(#{1,3})\s/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="leading-relaxed">
        {para.map((p, j) => (
          <React.Fragment key={j}>
            {j > 0 ? <br /> : null}
            {renderInline(p, `p${key}-${j}`)}
          </React.Fragment>
        ))}
      </p>,
    );
  }

  return <div className="space-y-2">{blocks}</div>;
}
