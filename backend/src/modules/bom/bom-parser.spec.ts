import * as XLSX from 'xlsx';
import { parseBomXlsx } from './bom-parser';

describe('parseBomXlsx', () => {
  it('parses flat format rows and preserves optional fields', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['model', 'partNumber', 'description', 'usageFactor', 'unit', 'location'],
      ['OP-520-0001', 'OP-520-0100', 'Cable harness', 2, 'EA', 'A1'],
      ['OP-520-0002', 'OP-520-0101', null, null, null, null],
      ['NOT-VALID', 'OP-520-9999', 'ignored row', 9, 'EA', 'Z9'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'flat');

    const result = parseBomXlsx(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toEqual([
      {
        model: 'OP-520-0001',
        partNumber: 'OP-520-0100',
        description: 'Cable harness',
        usageFactor: 2,
        unit: 'EA',
        location: 'A1',
      },
      {
        model: 'OP-520-0002',
        partNumber: 'OP-520-0101',
        usageFactor: 1,
        unit: 'EA',
      },
    ]);
  });

  it('parses native multi-column format and defaults FU to 1 when missing', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Category', null, null, null, null, null],
      ['OP-520-1000', null, null, 'OP-520-2000', null, null],
      ['N.P', 'F.U', null, 'N.P', 'F.U', null],
      ['OP-520-0100', 3, null, 'OP-520-0200', null, null],
      ['OP-520-0101', '2', null, 'INVALID', 4, null],
      ['INVALID', 10, null, 'OP-520-0201', 5, null],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'native');

    const result = parseBomXlsx(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toEqual([
      { model: 'OP-520-1000', partNumber: 'OP-520-0100', usageFactor: 3, unit: 'EA' },
      { model: 'OP-520-1000', partNumber: 'OP-520-0101', usageFactor: 2, unit: 'EA' },
      { model: 'OP-520-2000', partNumber: 'OP-520-0200', usageFactor: 1, unit: 'EA' },
      { model: 'OP-520-2000', partNumber: 'OP-520-0201', usageFactor: 5, unit: 'EA' },
    ]);
  });
});
