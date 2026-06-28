export const EXCEL_FORMULA_ERRORS = ['#NULL!', '#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#N/A', '#GETTING_DATA!', '#SPILL!', '#CALC!'] as const;
export type ExcelFormulaError = (typeof EXCEL_FORMULA_ERRORS)[number];
export function isExcelFormulaError(value: unknown): value is ExcelFormulaError { return typeof value === 'string' && (EXCEL_FORMULA_ERRORS as readonly string[]).includes(value); }
export function normalizeFormulaError(value: unknown): ExcelFormulaError | null {
  if (isExcelFormulaError(value)) return value;
  const text = String(value ?? '').toUpperCase();
  if ((text.includes('DIV') || text.includes('DIVISION')) && (text.includes('0') || text.includes('ZERO'))) return '#DIV/0!';
  if (text.includes('REF')) return '#REF!';
  if (text.includes('NAME')) return '#NAME?';
  if (text.includes('N/A')) return '#N/A';
  if (text.includes('NUM')) return '#NUM!';
  return null;
}
