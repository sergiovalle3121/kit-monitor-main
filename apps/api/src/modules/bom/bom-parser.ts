import * as XLSX from 'xlsx';

export interface ParsedBomRow {
  model: string;
  partNumber: string;
  description?: string;
  location?: string;
  usageFactor: number;
  unit: string;
}

export interface ParseError {
  sheet: string;
  row: number;
  reason: string;
}

export interface ParseResult {
  rows: ParsedBomRow[];
  errors: ParseError[];
}

function isOpCode(value: unknown): value is string {
  return (
    typeof value === 'string' && value.trim().toUpperCase().startsWith('OP-')
  );
}

/** Detect flat format: first row has header "model" and "partNumber" (case-insensitive) */
function isFlatFormat(raw: (string | number | null)[][]): boolean {
  if (!raw[0]) return false;
  const headers = raw[0].map((c) =>
    String(c ?? '')
      .toLowerCase()
      .replace(/[\s_]/g, ''),
  );
  return (
    headers.includes('model') &&
    (headers.includes('partnumber') || headers.includes('np'))
  );
}

/** Parse flat table: headers in row 0, data from row 1 */
function parseFlatSheet(
  raw: (string | number | null)[][],
  sheetName: string,
): ParseResult {
  const rows: ParsedBomRow[] = [];
  const errors: ParseError[] = [];

  const headers = raw[0].map((c) =>
    String(c ?? '')
      .toLowerCase()
      .replace(/[\s_]/g, ''),
  );
  const idx = {
    model: headers.findIndex((h) => h === 'model'),
    partNumber: headers.findIndex((h) => h === 'partnumber' || h === 'np'),
    description: headers.findIndex(
      (h) => h === 'description' || h === 'descripcion',
    ),
    usageFactor: headers.findIndex(
      (h) => h === 'usagefactor' || h === 'fu' || h === 'factordeuso',
    ),
    unit: headers.findIndex((h) => h === 'unit' || h === 'unidad'),
  };
  const locationIdx = headers.findIndex(
    (h) => h === 'location' || h === 'ubicacion',
  );

  if (idx.model === -1 || idx.partNumber === -1) {
    errors.push({
      sheet: sheetName,
      row: 0,
      reason: 'Missing required columns: model, partNumber',
    });
    return { rows, errors };
  }

  for (let r = 1; r < raw.length; r++) {
    const row = raw[r];
    const model = row[idx.model];
    const partNumber = row[idx.partNumber];

    if (!model || !partNumber) {
      if (row.some((c) => c !== null)) {
        errors.push({
          sheet: sheetName,
          row: r + 1,
          reason: 'Missing model or partNumber',
        });
      }
      continue;
    }

    if (!isOpCode(model) || !isOpCode(partNumber)) continue;

    const fuRaw = idx.usageFactor >= 0 ? row[idx.usageFactor] : null;
    const usageFactor =
      fuRaw !== null && !isNaN(Number(fuRaw)) ? Number(fuRaw) : 1;
    const unit =
      idx.unit >= 0 && row[idx.unit] ? String(row[idx.unit]).trim() : 'EA';
    const description =
      idx.description >= 0 && row[idx.description]
        ? String(row[idx.description]).trim()
        : undefined;
    const location =
      locationIdx >= 0 && row[locationIdx]
        ? String(row[locationIdx]).trim()
        : undefined;

    rows.push({
      model: String(model).trim(),
      partNumber: String(partNumber).trim(),
      ...(description ? { description } : {}),
      ...(location ? { location } : {}),
      usageFactor,
      unit,
    });
  }

  return { rows, errors };
}

/**
 * Parse native multi-column format (real BOM.xlsx):
 *   Row 0: category label
 *   Row 1: model codes at columns 0, 3, 6, ...
 *   Row 2: N.P / F.U headers (or empty in some sheets)
 *   Row 3+: part data (N.P at col offset 0, F.U at col offset 1)
 */
function parseMultiColumnSheet(
  raw: (string | number | null)[][],
  sheetName: string,
): ParseResult {
  const rows: ParsedBomRow[] = [];
  const errors: ParseError[] = [];

  const modelsRow = raw[1] ?? [];

  for (let c = 0; c < modelsRow.length; c += 3) {
    const modelCode = modelsRow[c];
    if (!isOpCode(modelCode)) continue;

    for (let r = 3; r < raw.length; r++) {
      const dataRow = raw[r];
      if (!dataRow) continue;

      const partNumber = dataRow[c];
      if (!isOpCode(partNumber)) continue;

      const fuRaw = dataRow[c + 1];
      const usageFactor =
        fuRaw !== null && fuRaw !== undefined && !isNaN(Number(fuRaw))
          ? Number(fuRaw)
          : 1;

      rows.push({
        model: modelCode.trim(),
        partNumber: partNumber.trim(),
        usageFactor,
        unit: 'EA',
      });
    }
  }

  return { rows, errors };
}

export function parseBomXlsx(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer' });

  const allRows: ParsedBomRow[] = [];
  const allErrors: ParseError[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws || !ws['!ref']) continue;

    const raw: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
    });

    if (raw.length < 2) continue;

    const result = isFlatFormat(raw)
      ? parseFlatSheet(raw, sheetName)
      : parseMultiColumnSheet(raw, sheetName);

    allRows.push(...result.rows);
    allErrors.push(...result.errors);
  }

  return { rows: allRows, errors: allErrors };
}
