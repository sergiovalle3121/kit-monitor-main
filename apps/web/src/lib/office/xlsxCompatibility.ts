/* eslint-disable @typescript-eslint/no-explicit-any */

export type XlsxCompatibilitySeverity = 'supported' | 'partial' | 'unsupported' | 'review';
export interface XlsxCompatibilityFeature { key: string; label: string; severity: XlsxCompatibilitySeverity; count: number; note: string }
export interface XlsxCompatibilityReport { features: XlsxCompatibilityFeature[]; unsupportedCount: number; reviewCount: number; score: number }

function sheetsOf(content: any): any[] { return Array.isArray(content) ? content : (Array.isArray(content?.sheets) ? content.sheets : []); }
function countCells(sheets: any[], pred: (cell: any) => boolean): number {
  return sheets.reduce((sum, sheet) => sum + ((sheet?.celldata ?? []) as any[]).filter(pred).length, 0);
}
function feature(key: string, label: string, severity: XlsxCompatibilitySeverity, count: number, note: string): XlsxCompatibilityFeature {
  return { key, label, severity, count, note };
}

export function scanXlsxCompatibility(content: any): XlsxCompatibilityReport {
  const sheets = sheetsOf(content);
  const charts = Array.isArray(content?.charts) ? content.charts.length : 0;
  const pivots = Array.isArray(content?.pivots) ? content.pivots.length : 0;
  const names = Array.isArray(content?.names) ? content.names.length : 0;
  const comments = Array.isArray(content?.comments) ? content.comments.length : 0;
  const formulas = countCells(sheets, (cd) => typeof cd?.v?.f === 'string' || (typeof cd?.v?.v === 'string' && cd.v.v.startsWith('=')));
  const styled = countCells(sheets, (cd) => !!cd?.v && ['bg', 'fc', 'bl', 'it', 'ff', 'fs', 'ht', 'vt', 'ct'].some((k) => cd.v[k] != null));
  const hyperlinks = countCells(sheets, (cd) => !!(cd?.v?.ps?.value || cd?.v?.link || cd?.v?.hyperlink));
  const validations = sheets.reduce((sum, s) => sum + Object.keys(s?.dataVerification ?? s?.dataVerificationConfig ?? {}).length, 0);
  const merged = sheets.reduce((sum, s) => sum + Object.keys(s?.config?.merge ?? {}).length, 0);
  const frozen = sheets.filter((s) => !!(s?.config?.frozen || s?.frozen)).length;
  const protectedSheets = sheets.filter((s) => !!s?.axosProtection?.sheetLocked).length;
  const protectedRanges = sheets.reduce((sum, s) => sum + (Array.isArray(s?.axosProtection?.ranges) ? s.axosProtection.ranges.length : 0), 0);
  const images = sheets.reduce((sum, s) => sum + Object.keys(s?.images ?? s?.image ?? {}).length, 0);
  const macros = content?.vba || content?.macros ? 1 : 0;
  const unsupportedObjects = Array.isArray(content?.unsupportedXlsxFeatures) ? content.unsupportedXlsxFeatures.length : 0;
  const features = [
    feature('formulas', 'Fórmulas', 'supported', formulas, 'Se exportan como fórmulas de Excel cuando el motor las preserva.'),
    feature('styles', 'Estilos', 'partial', styled, 'Estilos básicos se conservan; formatos avanzados requieren revisión visual.'),
    feature('charts', 'Gráficas', charts ? 'partial' : 'supported', charts, 'Las gráficas AXOS se reconstruyen desde metadata compatible.'),
    feature('pivots', 'Tablas dinámicas', pivots ? 'partial' : 'supported', pivots, 'Se conserva definición AXOS; valida el resultado en Excel.'),
    feature('merged', 'Celdas combinadas', 'supported', merged, 'Detectadas en configuración de hojas.'),
    feature('frozen', 'Paneles inmovilizados', 'supported', frozen, 'Señalados para exportación/revisión.'),
    feature('validation', 'Validación de datos', validations ? 'partial' : 'supported', validations, 'Reglas simples compatibles; reglas complejas requieren prueba.'),
    feature('named_ranges', 'Nombres definidos', 'supported', names, 'Workbook names preservados en metadata.'),
    feature('comments', 'Comentarios', comments ? 'partial' : 'supported', comments, 'Comentarios AXOS son threads; Excel puede abrirlos como notas/metadata según exportador.'),
    feature('hyperlinks', 'Hipervínculos', 'partial', hyperlinks, 'Se detectan vínculos en celdas; revisar round-trip.'),
    feature('images', 'Imágenes', images ? 'review' : 'supported', images, 'Imágenes embebidas requieren validación visual.'),
    feature('macros', 'Macros / VBA', macros ? 'unsupported' : 'supported', macros, 'AXOS nunca ejecuta macros; se bloquean/retiran por seguridad.'),
    feature('protection', 'Protección', protectedSheets || protectedRanges ? 'partial' : 'supported', protectedSheets + protectedRanges, 'Protección AXOS se conserva como metadata y avisos.'),
    feature('unsupported_objects', 'Objetos no soportados', unsupportedObjects ? 'unsupported' : 'supported', unsupportedObjects, 'Objetos OOXML sin renderer AXOS deben revisarse antes de compartir.'),
  ];
  const unsupportedCount = features.filter((f) => f.severity === 'unsupported').reduce((s, f) => s + f.count, 0);
  const reviewCount = features.filter((f) => f.severity === 'review' || f.severity === 'partial').reduce((s, f) => s + f.count, 0);
  return { features, unsupportedCount, reviewCount, score: Math.max(0, 100 - unsupportedCount * 20 - reviewCount * 2) };
}
