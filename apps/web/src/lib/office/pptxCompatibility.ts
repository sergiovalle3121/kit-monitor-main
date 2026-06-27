/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Lightweight PPTX compatibility scanner for AXOS Slides.
 *
 * It does not execute content. It only inspects OOXML part names and XML strings
 * inside the .pptx zip so the importer can warn users before unsupported Office
 * features are flattened, skipped or approximated.
 */

export type PptxCompatibilitySeverity = 'info' | 'warning' | 'danger';

export interface PptxCompatibilityIssue {
  code: string;
  severity: PptxCompatibilitySeverity;
  message: string;
  count?: number;
}

export interface PptxCompatibilityReport {
  issueCount: number;
  hasDanger: boolean;
  issues: PptxCompatibilityIssue[];
}

function issue(code: string, severity: PptxCompatibilitySeverity, message: string, count?: number): PptxCompatibilityIssue {
  return { code, severity, message, ...(count && count > 1 ? { count } : {}) };
}

function countFiles(files: string[], re: RegExp): number {
  return files.filter((f) => re.test(f)).length;
}

function countMatches(xml: string, re: RegExp): number {
  return (xml.match(re) || []).length;
}

async function readXmlParts(zip: any, files: string[], re: RegExp): Promise<string[]> {
  const out: string[] = [];
  for (const f of files) {
    if (!re.test(f)) continue;
    const part = zip.file(f);
    if (!part) continue;
    try { out.push(await part.async('string')); } catch { /* best-effort */ }
  }
  return out;
}

/**
 * Scan a PPTX for features AXOS Slides can import natively, approximate, or must
 * skip. This is intentionally conservative: it reports risks instead of failing
 * the import so production users keep their content flow.
 */
export async function analyzePptxCompatibility(buf: ArrayBuffer): Promise<PptxCompatibilityReport> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buf);
  const files = Object.keys(zip.files);
  const issues: PptxCompatibilityIssue[] = [];

  const macroParts = countFiles(files, /(^|\/)vbaProject\.bin$/i);
  if (macroParts) issues.push(issue('macros', 'danger', 'El archivo contiene macros VBA. AXOS no las ejecuta ni las importa.', macroParts));

  const oleParts = countFiles(files, /(^|\/)(embeddings|activeX)\//i);
  if (oleParts) issues.push(issue('embedded-objects', 'warning', 'Contiene objetos OLE/ActiveX embebidos; se omiten por seguridad.', oleParts));

  const mediaParts = countFiles(files, /^ppt\/media\/.+\.(mp4|mov|avi|wmv|m4v|mp3|wav|m4a)$/i);
  if (mediaParts) issues.push(issue('audio-video', 'warning', 'Contiene audio o video; AXOS Slides aún no importa medios temporizados.', mediaParts));

  const comments = countFiles(files, /^ppt\/comments\/comment\d+\.xml$/i) + countFiles(files, /^ppt\/threadedComments\//i);
  if (comments) issues.push(issue('comments', 'info', 'Contiene comentarios de PowerPoint; se conservará el mazo, pero los threads aún no se importan.', comments));

  const notes = countFiles(files, /^ppt\/notesSlides\/notesSlide\d+\.xml$/i);
  if (notes) issues.push(issue('speaker-notes', 'info', 'Contiene notas del orador; AXOS intentará conservarlas como notas de diapositiva.', notes));

  const themeParts = countFiles(files, /^ppt\/theme\/theme\d+\.xml$/i);
  if (themeParts > 1) issues.push(issue('theme-variants', 'info', 'Contiene múltiples themes/variantes; AXOS aplicará el theme más cercano posible.', themeParts));

  const embeddedFonts = countFiles(files, /^ppt\/fonts\//i);
  if (embeddedFonts) issues.push(issue('embedded-fonts', 'warning', 'Contiene fuentes embebidas; por licenciamiento se sustituirán por fuentes disponibles.', embeddedFonts));

  const slideXml = await readXmlParts(zip, files, /^ppt\/slides\/slide\d+\.xml$/i);
  const layoutXml = await readXmlParts(zip, files, /^ppt\/slideLayouts\/slideLayout\d+\.xml$/i);
  const masterXml = await readXmlParts(zip, files, /^ppt\/slideMasters\/slideMaster\d+\.xml$/i);
  const allSlideLikeXml = [...slideXml, ...layoutXml, ...masterXml].join('\n');

  const layoutCount = layoutXml.length;
  if (layoutCount > 1) issues.push(issue('slide-layouts', 'info', 'Contiene layouts de PowerPoint; AXOS los aproximará a layouts internos editables.', layoutCount));

  const masterCount = masterXml.length;
  if (masterCount) issues.push(issue('slide-masters', 'info', 'Contiene slide masters; AXOS importará mobiliario común cuando sea posible y reportará diferencias.', masterCount));

  const charts = countMatches(allSlideLikeXml, /<c:chart\b|\/charts\/chart\d+\.xml/gi) + countFiles(files, /^ppt\/charts\/chart\d+\.xml$/i);
  if (charts) issues.push(issue('charts', 'info', 'Contiene gráficos nativos de PowerPoint; AXOS intentará convertirlos a chartSpec editable.', charts));

  const tables = countMatches(allSlideLikeXml, /<a:tbl\b/g);
  if (tables) issues.push(issue('tables', 'info', 'Contiene tablas; AXOS intentará reconstruirlas como tablas editables.', tables));

  const grouped = countMatches(allSlideLikeXml, /<p:grpSp\b/g);
  if (grouped) issues.push(issue('groups', 'info', 'Contiene grupos de objetos; se conservará la geometría y se aproximará la agrupación editable.', grouped));

  const connectors = countMatches(allSlideLikeXml, /<p:cxnSp\b/g);
  if (connectors) issues.push(issue('connectors', 'info', 'Contiene conectores; AXOS recreará conectores compatibles cuando detecte sus endpoints.', connectors));

  const smartArt = countFiles(files, /^ppt\/diagrams\//i) + countMatches(allSlideLikeXml, /<p:graphicFrame[\s\S]*?dgm:/g);
  if (smartArt) issues.push(issue('smartart', 'info', 'SmartArt se importará como formas editables aproximadas cuando sea posible.', smartArt));

  const animations = countMatches(allSlideLikeXml, /<(p:)?(timing|anim|animEffect|animMotion|animScale|animRot|par|seq)\b/g);
  if (animations) issues.push(issue('animations', 'info', 'Contiene animaciones; AXOS importará la diapositiva y reiniciará la timeline de animación.', animations));

  const transitions = countMatches(allSlideLikeXml, /<p:transition\b/g);
  if (transitions) issues.push(issue('transitions', 'info', 'Contiene transiciones de PowerPoint; se asignará una transición AXOS compatible.', transitions));

  const customGeometry = countMatches(allSlideLikeXml, /<a:custGeom\b/g);
  if (customGeometry) issues.push(issue('custom-geometry', 'info', 'Contiene geometría personalizada; algunas formas pueden convertirse a rectángulos o paths.', customGeometry));

  const gradientFills = countMatches(allSlideLikeXml, /<a:gradFill\b/g);
  if (gradientFills) issues.push(issue('gradients', 'info', 'Contiene gradientes; se aproximan al color principal cuando el objeto no soporte gradiente nativo.', gradientFills));

  return { issueCount: issues.length, hasDanger: issues.some((x) => x.severity === 'danger'), issues };
}
