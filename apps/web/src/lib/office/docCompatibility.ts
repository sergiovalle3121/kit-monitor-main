/* eslint-disable @typescript-eslint/no-explicit-any */

export type CompatibilitySeverity = 'info' | 'warning' | 'critical';
export type CompatibilityTarget = 'docx' | 'pdf' | 'html';

export interface CompatibilityFinding {
  id: string;
  severity: CompatibilitySeverity;
  target: CompatibilityTarget;
  title: string;
  detail: string;
  count: number;
}

export interface CompatibilityReport {
  score: number;
  findings: CompatibilityFinding[];
  totals: Record<CompatibilitySeverity, number>;
  nodeCounts: Record<string, number>;
  markCounts: Record<string, number>;
}

const DOCX_SUPPORTED_NODES = new Set([
  'doc', 'paragraph', 'text', 'heading', 'bulletList', 'orderedList', 'listItem', 'taskList', 'taskItem',
  'table', 'tableRow', 'tableCell', 'tableHeader', 'image', 'horizontalRule', 'hardBreak', 'pageBreak',
  'blockquote', 'codeBlock', 'callout', 'axosRef', 'docField', 'bookmark', 'crossReference',
]);

const DOCX_SUPPORTED_MARKS = new Set([
  'bold', 'italic', 'underline', 'strike', 'link', 'comment', 'insertion', 'deletion', 'textStyle',
  'highlight', 'code', 'subscript', 'superscript',
]);

function addFinding(findings: CompatibilityFinding[], finding: Omit<CompatibilityFinding, 'id'>) {
  const key = `${finding.target}:${finding.severity}:${finding.title}`;
  const existing = findings.find((item) => item.id === key);
  if (existing) existing.count += finding.count;
  else findings.push({ ...finding, id: key });
}

function walk(node: any, visit: (node: any) => void) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  if (!Array.isArray(node.content)) return;
  node.content.forEach((child: any) => walk(child, visit));
}

export function assessDocCompatibility(content: any): CompatibilityReport {
  const nodeCounts: Record<string, number> = {};
  const markCounts: Record<string, number> = {};
  const findings: CompatibilityFinding[] = [];

  walk(content, (node) => {
    const type = String(node.type || 'unknown');
    nodeCounts[type] = (nodeCounts[type] ?? 0) + 1;

    if (!DOCX_SUPPORTED_NODES.has(type)) {
      addFinding(findings, {
        target: 'docx',
        severity: 'warning',
        title: `Nodo no mapeado para DOCX: ${type}`,
        detail: 'El exportador DOCX puede convertirlo a texto plano o perder estructura avanzada. Validar el archivo antes de liberar el documento.',
        count: 1,
      });
    }

    if (type === 'image' && !node.attrs?.src) {
      addFinding(findings, {
        target: 'docx',
        severity: 'critical',
        title: 'Imagen sin fuente embebida',
        detail: 'Las imágenes sin `src` no pueden exportarse de forma confiable a DOCX/PDF.',
        count: 1,
      });
    }

    if (type === 'table') {
      const rows = Array.isArray(node.content) ? node.content.length : 0;
      if (rows > 35) {
        addFinding(findings, {
          target: 'pdf',
          severity: 'warning',
          title: 'Tabla larga detectada',
          detail: 'Las tablas extensas pueden requerir validación visual en PDF para saltos de página, encabezados repetidos y lectura en planta.',
          count: 1,
        });
      }
    }

    if (Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        const markType = String(mark.type || 'unknown');
        markCounts[markType] = (markCounts[markType] ?? 0) + 1;
        if (!DOCX_SUPPORTED_MARKS.has(markType)) {
          addFinding(findings, {
            target: 'docx',
            severity: 'warning',
            title: `Marca no mapeada para DOCX: ${markType}`,
            detail: 'El contenido se conserva, pero el formato de esta marca puede no tener equivalencia en Word.',
            count: 1,
          });
        }
      }
    }
  });

  if ((markCounts.comment ?? 0) > 0) {
    addFinding(findings, {
      target: 'docx',
      severity: 'info',
      title: 'Comentarios inline presentes',
      detail: 'Los anchors visuales viajan con el documento; los hilos persistentes siguen siendo el registro oficial dentro de AXOS.',
      count: markCounts.comment,
    });
  }

  if ((markCounts.insertion ?? 0) + (markCounts.deletion ?? 0) > 0) {
    addFinding(findings, {
      target: 'docx',
      severity: 'info',
      title: 'Redlines pendientes',
      detail: 'Antes de liberar, revisar si se exporta con cambios visibles o si se aceptan/rechazan desde AXOS Docs.',
      count: (markCounts.insertion ?? 0) + (markCounts.deletion ?? 0),
    });
  }

  const totals = findings.reduce<Record<CompatibilitySeverity, number>>((acc, finding) => {
    acc[finding.severity] += finding.count;
    return acc;
  }, { info: 0, warning: 0, critical: 0 });
  const score = Math.max(0, 100 - totals.critical * 30 - totals.warning * 10 - Math.min(totals.info, 5) * 2);

  return {
    score,
    findings: findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.count - a.count),
    totals,
    nodeCounts,
    markCounts,
  };
}

function severityRank(severity: CompatibilitySeverity) {
  if (severity === 'critical') return 3;
  if (severity === 'warning') return 2;
  return 1;
}
