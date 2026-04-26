import * as XLSX from 'xlsx';

export interface ParsedKanbanRow {
  partNumber: string;
  description?: string;
  location?: string;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function toText(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  return text ? text : undefined;
}

function isOpCode(value: unknown): value is string {
  return typeof value === 'string' && value.trim().toUpperCase().startsWith('OP-');
}

export function parseKanbanXlsx(buffer: Buffer): ParsedKanbanRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets['Kan-Ban'] ?? workbook.Sheets[workbook.SheetNames[0] ?? ''];
  if (!sheet) return [];

  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });

  const headerRow = raw[0] ?? [];
  const headers = headerRow.map(normalizeHeader);

  const partNumberIndex = headers.findIndex(header => header === 'numerodeparte');
  const descriptionIndex = headers.findIndex(header => header === 'descripcion');
  const locationIndex = headers.findIndex(header => header === 'ubicacion');
  const location2Index = headers.findIndex(header => header === 'ubicacion2');

  if (partNumberIndex === -1) return [];

  const catalog = new Map<string, ParsedKanbanRow>();

  for (let r = 1; r < raw.length; r++) {
    const row = raw[r] ?? [];
    const partNumber = row[partNumberIndex];
    if (!isOpCode(partNumber)) continue;

    const location = [toText(row[locationIndex]), toText(row[location2Index])]
      .filter(Boolean)
      .join(' ')
      .trim() || undefined;

    catalog.set(partNumber.trim(), {
      partNumber: partNumber.trim(),
      description: toText(row[descriptionIndex]),
      location,
    });
  }

  return [...catalog.values()];
}
