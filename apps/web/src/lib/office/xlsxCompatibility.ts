/* eslint-disable @typescript-eslint/no-explicit-any */

export type XlsxCompatibilitySeverity = 'supported' | 'partial' | 'unsupported' | 'review';
export interface XlsxCompatibilityFeature { key: string; label: string; severity: XlsxCompatibilitySeverity; count: number; note: string }
export interface XlsxCompatibilityReport { features: XlsxCompatibilityFeature[]; unsupportedCount: number; reviewCount: number; score: number }

function sheetsOf(content: any): any[] { return Array.isArray(content) ? content : (Array.isArray(content?.sheets) ? content.sheets : []); }
function countCells(sheets: any[], pred: (cell: any) => boolean): number {
  return sheets.reduce((sum, sheet) => sum + ((sheet?.celldata ?? []) as any[]).filter(pred).length, 0);
}
function countSheetObjects(sheets: any[], getter: (sheet: any) => any): number {
  return sheets.reduce((sum, sheet) => {
    const value = getter(sheet);
    if (Array.isArray(value)) return sum + value.length;
    if (value && typeof value === 'object') return sum + Object.keys(value).length;
    return sum;
  }, 0);
}
function feature(key: string, label: string, severity: XlsxCompatibilitySeverity, count: number, note: string): XlsxCompatibilityFeature {
  return { key, label, severity, count, note };
}
function hasCellNote(cd: any): boolean {
  const value = cd?.v;
  if (!value || typeof value !== 'object') return false;
  return !!(
    (typeof value.comment === 'string' && value.comment.trim())
    || (typeof value.noteText === 'string' && value.noteText.trim())
    || (typeof value.ps?.value === 'string' && value.ps.value.trim())
  );
}
function hasHyperlink(cd: any): boolean {
  const value = cd?.v;
  if (!value || typeof value !== 'object') return false;
  return ['hl', 'hyperlink', 'link'].some((key) => typeof value[key] === 'string' && value[key].trim());
}
function printLayoutCount(content: any): number {
  const layout = content?.printLayout;
  if (!layout || typeof layout !== 'object') return 0;
  const hasCustomLayout = !!(
    layout.printArea
    || layout.orientation === 'landscape'
    || (layout.paperSize && layout.paperSize !== 'A4')
    || layout.fitToWidth
    || layout.fitToPage
    || layout.showGridlines === false
  );
  return hasCustomLayout ? 1 : 0;
}

export function scanXlsxCompatibility(content: any): XlsxCompatibilityReport {
  const sheets = sheetsOf(content);
  const charts = Array.isArray(content?.charts) ? content.charts.length : 0;
  const pivots = Array.isArray(content?.pivots) ? content.pivots.length : 0;
  const names = Array.isArray(content?.names) ? content.names.length : 0;
  const comments = Array.isArray(content?.comments) ? content.comments.length : 0;
  const tables = Array.isArray(content?.tables) ? content.tables.length : 0;
  const importWarnings = Array.isArray(content?.importWarnings) ? content.importWarnings.length : 0;
  const formulas = countCells(sheets, (cd) => typeof cd?.v?.f === 'string' || (typeof cd?.v?.v === 'string' && cd.v.v.startsWith('=')));
  const styled = countCells(sheets, (cd) => !!cd?.v && ['bg', 'fc', 'bl', 'it', 'ff', 'fs', 'ht', 'vt', 'ct'].some((key) => cd.v[key] != null));
  const hyperlinks = countCells(sheets, hasHyperlink);
  const cellNotes = countCells(sheets, hasCellNote);
  const validations = sheets.reduce((sum, sheet) => sum + Object.keys(sheet?.dataVerification ?? sheet?.dataVerificationConfig ?? {}).length, 0);
  const merged = sheets.reduce((sum, sheet) => sum + Object.keys(sheet?.config?.merge ?? {}).length, 0);
  const frozen = sheets.filter((sheet) => !!(sheet?.config?.frozen || sheet?.frozen)).length;
  const filters = sheets.filter((sheet) => !!(sheet?.filter_select || sheet?.config?.filter_select)).length;
  const dimensions = countSheetObjects(sheets, (sheet) => sheet?.config?.columnlen) + countSheetObjects(sheets, (sheet) => sheet?.config?.rowlen);
  const protectedSheets = sheets.filter((sheet) => !!sheet?.axosProtection?.sheetLocked).length;
  const protectedRanges = sheets.reduce((sum, sheet) => sum + (Array.isArray(sheet?.axosProtection?.ranges) ? sheet.axosProtection.ranges.length : 0), 0);
  const images = sheets.reduce((sum, sheet) => sum + Object.keys(sheet?.images ?? sheet?.image ?? {}).length, 0);
  const macros = content?.vba || content?.macros || content?.vbaraw ? 1 : 0;
  const unsupportedObjects = Array.isArray(content?.unsupportedXlsxFeatures) ? content.unsupportedXlsxFeatures.length : 0;
  const printLayout = printLayoutCount(content);
  const features = [
    feature('formulas', 'Fórmulas', 'supported', formulas, 'Se exportan como fórmulas de Excel cuando el editor preserva el texto de fórmula.'),
    feature('styles', 'Estilos', 'partial', styled, 'Estilos básicos se conservan; la fidelidad visual avanzada requiere revisión.'),
    feature('tables', 'Tablas estructuradas', tables ? 'partial' : 'supported', tables, 'La metadata AXOS de tablas y referencias estructuradas se guarda, pero aún no se emiten objetos Table nativos de Excel.'),
    feature('charts', 'Gráficas', charts ? 'partial' : 'supported', charts, 'La metadata de gráficas AXOS se preserva y debe revisarse al abrir en Excel.'),
    feature('pivots', 'Tablas dinámicas', pivots ? 'partial' : 'supported', pivots, 'Las definiciones AXOS de pivot se preservan; valida resultados materializados en Excel.'),
    feature('merged', 'Celdas combinadas', 'supported', merged, 'Configuración de celdas combinadas detectada para exportación/revisión.'),
    feature('frozen', 'Paneles inmovilizados', 'supported', frozen, 'Paneles inmovilizados detectados para exportación/revisión.'),
    feature('filters', 'Filtros', 'supported', filters, 'Autofiltros Fortune-Sheet se exportan como filtros de hoja cuando existe un rango filtrado.'),
    feature('dimensions', 'Anchos y altos', 'supported', dimensions, 'Anchos de columna y altos de fila viajan al XLSX.'),
    feature('print_layout', 'Diseño de página', printLayout ? 'review' : 'supported', printLayout, 'El layout de impresión AXOS controla print HTML; verifica orientación, escala y área en Excel.'),
    feature('validation', 'Validación de datos', validations ? 'partial' : 'supported', validations, 'Reglas simples son compatibles; reglas complejas requieren revisión.'),
    feature('named_ranges', 'Nombres definidos', 'supported', names, 'Los nombres del workbook se preservan como metadata.'),
    feature('comments', 'Threads de comentarios AXOS', comments ? 'partial' : 'supported', comments, 'Threads de revisión AXOS son metadata, no comentarios threaded nativos de Excel.'),
    feature('cell_comments', 'Notas de celda', cellNotes ? 'partial' : 'supported', cellNotes, 'Comentarios de celda hacen round-trip; notas flotantes Fortune requieren revisión visual.'),
    feature('hyperlinks', 'Hipervínculos', 'partial', hyperlinks, 'Hipervínculos de celda detectados; revisa fidelidad de round-trip.'),
    feature('images', 'Imágenes', images ? 'review' : 'supported', images, 'Imágenes embebidas requieren validación visual después de exportar/importar.'),
    feature('macros', 'Macros / VBA', macros ? 'unsupported' : 'supported', macros, 'AXOS nunca ejecuta macros; VBA se bloquea o se retira por seguridad.'),
    feature('import_warnings', 'Warnings de importación', importWarnings ? 'review' : 'supported', importWarnings, 'El workbook trae avisos del importador; revísalos antes de re-exportar o compartir.'),
    feature('protection', 'Protección', protectedSheets || protectedRanges ? 'partial' : 'supported', protectedSheets + protectedRanges, 'La protección AXOS se preserva como metadata y semántica de exportación cuando aplica.'),
    feature('unsupported_objects', 'Objetos no soportados', unsupportedObjects ? 'unsupported' : 'supported', unsupportedObjects, 'Objetos OOXML sin renderer AXOS requieren revisión antes de compartir.'),
  ];
  const unsupportedCount = features.filter((item) => item.severity === 'unsupported').reduce((sum, item) => sum + item.count, 0);
  const reviewCount = features.filter((item) => item.severity === 'review' || item.severity === 'partial').reduce((sum, item) => sum + item.count, 0);
  return { features, unsupportedCount, reviewCount, score: Math.max(0, 100 - unsupportedCount * 20 - reviewCount * 2) };
}
