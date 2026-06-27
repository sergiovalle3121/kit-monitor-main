/* eslint-disable @typescript-eslint/no-explicit-any */

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeName = (s: string) => (s || 'documento').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);

function marks(text: string, node: any): string {
  let out = esc(text);
  for (const m of node.marks ?? []) {
    if (m.type === 'bold') out = `<strong>${out}</strong>`;
    else if (m.type === 'italic') out = `<em>${out}</em>`;
    else if (m.type === 'strike') out = `<s>${out}</s>`;
    else if (m.type === 'code') out = `<code>${out}</code>`;
    else if (m.type === 'link') out = `<a href="${esc(m.attrs?.href)}">${out}</a>`;
    else if (m.type === 'comment') out = `<span class="comment" data-comment-id="${esc(m.attrs?.commentId)}">${out}</span>`;
    else if (m.type === 'insertion') out = `<ins data-author="${esc(m.attrs?.author)}">${out}</ins>`;
    else if (m.type === 'deletion') out = `<del data-author="${esc(m.attrs?.author)}">${out}</del>`;
  }
  return out;
}

function inline(nodes: any[] = []): string {
  return nodes.map((n) => {
    if (n.type === 'text') return marks(n.text || '', n);
    if (n.type === 'hardBreak') return '<br />';
    if (n.type === 'image') return `<img src="${esc(n.attrs?.src)}" alt="${esc(n.attrs?.alt)}" />`;
    if (n.type === 'axosRef') return `<span class="axos-ref" data-entity="${esc(n.attrs?.entity)}" data-ref-id="${esc(n.attrs?.refId)}">${esc(n.attrs?.label || n.attrs?.refId)}</span>`;
    if (n.type === 'docField') return `<span class="doc-field" data-key="${esc(n.attrs?.key)}">${esc(n.attrs?.value || n.attrs?.label || n.attrs?.key)}</span>`;
    if (n.type === 'crossRef') return `<a class="xref" href="#bm-${esc(n.attrs?.target)}">${esc(n.attrs?.label || n.attrs?.target)}</a>`;
    if (n.type === 'bookmark') return `<a id="bm-${esc(n.attrs?.name)}"></a>`;
    if (n.type === 'footnoteRef') return `<sup>${esc(n.attrs?.label || '*')}</sup>`;
    if (n.type === 'mathInline') return `<code>${esc(n.attrs?.latex)}</code>`;
    return inline(n.content ?? []);
  }).join('');
}

function block(node: any): string {
  const attrs = node.attrs || {};
  switch (node.type) {
    case 'heading': return `<h${attrs.level || 1}>${inline(node.content)}</h${attrs.level || 1}>`;
    case 'paragraph': return `<p>${inline(node.content)}</p>`;
    case 'blockquote': return `<blockquote>${(node.content ?? []).map(block).join('')}</blockquote>`;
    case 'bulletList': return `<ul>${(node.content ?? []).map(block).join('')}</ul>`;
    case 'orderedList': return `<ol>${(node.content ?? []).map(block).join('')}</ol>`;
    case 'taskList': return `<ul class="task-list">${(node.content ?? []).map(block).join('')}</ul>`;
    case 'listItem': return `<li>${(node.content ?? []).map(block).join('')}</li>`;
    case 'taskItem': return `<li><input type="checkbox" disabled ${attrs.checked ? 'checked' : ''} /> ${(node.content ?? []).map(block).join('')}</li>`;
    case 'codeBlock': return `<pre><code>${esc((node.content ?? []).map((n: any) => n.text || '').join(''))}</code></pre>`;
    case 'horizontalRule': return '<hr />';
    case 'pageBreak': return '<div class="page-break"></div>';
    case 'callout': return `<aside class="callout ${esc(attrs.tone || 'neutral')}">${(node.content ?? []).map(block).join('')}</aside>`;
    case 'table': return `<table>${(node.content ?? []).map(block).join('')}</table>`;
    case 'tableRow': return `<tr>${(node.content ?? []).map(block).join('')}</tr>`;
    case 'tableHeader': return `<th>${(node.content ?? []).map(block).join('')}</th>`;
    case 'tableCell': return `<td>${(node.content ?? []).map(block).join('')}</td>`;
    default: return (node.content ?? []).map(block).join('');
  }
}

export function tiptapJsonToHtmlDocument(json: any, title: string): string {
  const body = (json?.content ?? []).map(block).join('\n') || '<p></p>';
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title || 'AXOS Docs')}</title>
<style>
  body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;line-height:1.6;max-width:900px;margin:40px auto;padding:0 24px;color:#111827}
  table{border-collapse:collapse;width:100%;margin:1rem 0} th,td{border:1px solid #d1d5db;padding:6px 10px;vertical-align:top} th{background:#f3f4f6;text-align:left}
  blockquote{border-left:4px solid #d1d5db;margin-left:0;padding-left:1rem;color:#4b5563}.callout{border:1px solid #e5e7eb;border-left:4px solid #64748b;border-radius:10px;padding:10px 14px;background:#f8fafc}.callout.warning{border-left-color:#f59e0b}.callout.danger{border-left-color:#ef4444}.callout.success{border-left-color:#10b981}.callout.info{border-left-color:#3b82f6}
  .comment{background:#fef3c7;border-bottom:2px solid #f59e0b}.axos-ref,.doc-field{display:inline-block;border:1px solid #bfdbfe;background:#eff6ff;border-radius:999px;padding:0 7px;font-weight:700;color:#1d4ed8}.doc-field{border-style:dashed;color:#0f172a;background:#f8fafc}.page-break{break-before:page;border-top:1px dashed #cbd5e1;margin:24px 0}.task-list{list-style:none;padding-left:0} ins{color:#047857} del{color:#dc2626}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function exportHtml(json: any, title: string) {
  const blob = new Blob([tiptapJsonToHtmlDocument(json, title)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${safeName(title || 'documento')}.html`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
