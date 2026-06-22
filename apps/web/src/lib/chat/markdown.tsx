import React from 'react';

/**
 * Render de texto enriquecido para los mensajes del chat (XSS-safe: SOLO crea
 * nodos de texto y elementos React, nunca `dangerouslySetInnerHTML`).
 *
 * Soporta:
 *  - Tablas Markdown (| a | b | / |---|---| / | 1 | 2 |)
 *  - **negrita**, *cursiva* / _cursiva_, ~~tachado~~, `código`
 *  - URLs clicables y @menciones resaltadas
 *  - Resaltado opcional del término de búsqueda
 *
 * Pensado para mensajes cortos de chat (no es un parser Markdown completo).
 */
export interface RenderOpts {
  mine: boolean;
  highlight?: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Resalta coincidencias de `term` dentro de un texto plano (nodos de texto). */
function withHighlight(
  text: string,
  opts: RenderOpts,
  key: string,
): React.ReactNode {
  const term = opts.highlight?.trim();
  if (!term) return text;
  const markCls = opts.mine
    ? 'rounded bg-yellow-300/80 px-0.5 text-black'
    : 'rounded bg-yellow-200 px-0.5 text-black dark:bg-yellow-400/80';
  const lower = term.toLowerCase();
  return text
    .split(new RegExp(`(${escapeRegExp(term)})`, 'gi'))
    .map((part, i) =>
      part.toLowerCase() === lower ? (
        <mark key={`${key}-h${i}`} className={markCls}>
          {part}
        </mark>
      ) : (
        <React.Fragment key={`${key}-h${i}`}>{part}</React.Fragment>
      ),
    );
}

/** Aplica negrita/cursiva/tachado/código a un fragmento de texto plano. */
function inlineFormat(
  text: string,
  opts: RenderOpts,
  key: string,
): React.ReactNode[] {
  // Orden: código (protege su contenido) → negrita → tachado → cursiva.
  const rules: { re: RegExp; wrap: (inner: string, k: string) => React.ReactNode }[] = [
    {
      re: /`([^`]+)`/g,
      wrap: (inner, k) => (
        <code
          key={k}
          className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/15"
        >
          {inner}
        </code>
      ),
    },
    {
      re: /\*\*([^*]+)\*\*/g,
      wrap: (inner, k) => (
        <strong key={k} className="font-semibold">
          {inlineFormat(inner, opts, k)}
        </strong>
      ),
    },
    {
      re: /~~([^~]+)~~/g,
      wrap: (inner, k) => (
        <span key={k} className="line-through opacity-80">
          {inlineFormat(inner, opts, k)}
        </span>
      ),
    },
    {
      re: /(?:\*([^*\n]+)\*|_([^_\n]+)_)/g,
      wrap: (inner, k) => (
        <em key={k} className="italic">
          {inlineFormat(inner, opts, k)}
        </em>
      ),
    },
  ];

  function apply(segment: string, ruleIdx: number, k: string): React.ReactNode[] {
    if (ruleIdx >= rules.length) {
      return [<React.Fragment key={k}>{withHighlight(segment, opts, k)}</React.Fragment>];
    }
    const { re, wrap } = rules[ruleIdx];
    const out: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    let i = 0;
    while ((m = re.exec(segment)) !== null) {
      if (m.index > last) {
        out.push(...apply(segment.slice(last, m.index), ruleIdx + 1, `${k}-${i}a`));
      }
      const inner = m[1] ?? m[2] ?? '';
      out.push(wrap(inner, `${k}-${i}w`));
      last = m.index + m[0].length;
      i++;
    }
    if (last < segment.length) {
      out.push(...apply(segment.slice(last), ruleIdx + 1, `${k}-${i}z`));
    }
    return out;
  }

  return apply(text, 0, key);
}

/** Render de una porción de texto: URLs, @menciones y formato inline. */
function renderTextSpan(
  text: string,
  opts: RenderOpts,
  key: string,
): React.ReactNode[] {
  const mentionCls = opts.mine
    ? 'font-semibold rounded bg-white/20 px-0.5'
    : 'font-semibold text-blue-600 dark:text-blue-400';
  const linkCls = opts.mine
    ? 'underline decoration-white/60 break-all'
    : 'text-blue-600 underline break-all dark:text-blue-400';

  return text
    .split(/(https?:\/\/[^\s]+|@[a-zA-Z0-9._-]+)/g)
    .flatMap((part, i) => {
      if (/^https?:\/\//.test(part)) {
        return [
          <a
            key={`${key}-l${i}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={linkCls}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>,
        ];
      }
      if (/^@[a-zA-Z0-9._-]+$/.test(part)) {
        return [
          <span key={`${key}-m${i}`} className={mentionCls}>
            {part}
          </span>,
        ];
      }
      return inlineFormat(part, opts, `${key}-t${i}`);
    });
}

// ── Tablas ──────────────────────────────────────────────────────────────────

function isSeparatorRow(line: string): boolean {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{1,}:?$/.test(c.trim()));
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

function looksLikeRow(line: string): boolean {
  return line.includes('|') && line.trim().length > 0;
}

function renderTable(
  header: string[],
  rows: string[][],
  opts: RenderOpts,
  key: string,
): React.ReactNode {
  return (
    <div key={key} className="my-1 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {header.map((h, i) => (
              <th
                key={i}
                className="border border-black/15 bg-black/5 px-2 py-1 text-left font-semibold dark:border-white/20 dark:bg-white/10"
              >
                {renderTextSpan(h, opts, `${key}-h${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {header.map((_, ci) => (
                <td
                  key={ci}
                  className="border border-black/15 px-2 py-1 align-top dark:border-white/20"
                >
                  {renderTextSpan(r[ci] ?? '', opts, `${key}-r${ri}c${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Render principal: divide el cuerpo en bloques (tablas vs texto) y arma la
 * salida React. Las líneas de texto conservan sus saltos con <br/>.
 */
export function renderMessageText(
  body: string,
  opts: RenderOpts,
): React.ReactNode {
  if (!body) return null;
  const lines = body.split('\n');
  const blocks: React.ReactNode[] = [];
  let textBuf: string[] = [];
  let blockKey = 0;

  const flushText = () => {
    if (textBuf.length === 0) return;
    const k = `b${blockKey++}`;
    const nodes: React.ReactNode[] = [];
    textBuf.forEach((ln, i) => {
      if (i > 0) nodes.push(<br key={`${k}-br${i}`} />);
      nodes.push(...renderTextSpan(ln, opts, `${k}-${i}`));
    });
    blocks.push(<React.Fragment key={k}>{nodes}</React.Fragment>);
    textBuf = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    if (looksLikeRow(line) && next !== undefined && isSeparatorRow(next)) {
      // Inicio de tabla: header + separador + filas siguientes con '|'.
      flushText();
      const header = splitRow(line);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && looksLikeRow(lines[j]) && !isSeparatorRow(lines[j])) {
        rows.push(splitRow(lines[j]));
        j++;
      }
      blocks.push(renderTable(header, rows, opts, `t${blockKey++}`));
      i = j - 1;
    } else {
      textBuf.push(line);
    }
  }
  flushText();

  return <>{blocks}</>;
}

/** ¿El cuerpo contiene al menos una tabla Markdown? (para layout de la burbuja). */
export function hasTable(body: string): boolean {
  const lines = body.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    if (looksLikeRow(lines[i]) && isSeparatorRow(lines[i + 1])) return true;
  }
  return false;
}

/** Plantilla de tabla Markdown lista para insertar/editar en el composer. */
export function tableTemplate(cols = 2, rows = 2): string {
  const headers = Array.from({ length: cols }, (_, i) => `Columna ${i + 1}`);
  const sep = Array.from({ length: cols }, () => '---');
  const bodyRows = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ' ').join(' | '),
  );
  return [
    `| ${headers.join(' | ')} |`,
    `| ${sep.join(' | ')} |`,
    ...bodyRows.map((r) => `| ${r} |`),
  ].join('\n');
}
