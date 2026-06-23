import { dossierStationsToCsv, DossierStationRow } from './line-dossier';

function row(over: Partial<DossierStationRow>): DossierStationRow {
  return {
    station: 'EST-10',
    line: 'SMT-1',
    sequence: 10,
    cycleTimeSec: 40,
    hasNp: true,
    hasUseFactor: true,
    hasVisualAid: true,
    complete: true,
    placed: true,
    ...over,
  };
}

describe('dossierStationsToCsv (Fase 39)', () => {
  it('writes a header and one line per station with Sí/No flags', () => {
    const csv = dossierStationsToCsv([
      row({ station: 'EST-10', sequence: 10 }),
      row({
        station: 'EST-20',
        sequence: 20,
        hasVisualAid: false,
        complete: false,
        placed: false,
      }),
    ]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[0]).toMatch(/^Estación,Línea,Secuencia,Ciclo \(s\)/);
    expect(lines[1]).toBe('EST-10,SMT-1,10,40,Sí,Sí,Sí,Sí,Sí');
    expect(lines[2]).toBe('EST-20,SMT-1,20,40,Sí,Sí,No,No,No');
  });

  it('quotes fields containing commas or quotes (RFC 4180)', () => {
    const csv = dossierStationsToCsv([
      row({ station: 'EST, A', line: 'Línea "1"' }),
    ]);
    const line = csv.split('\n')[1];
    expect(line.startsWith('"EST, A","Línea ""1"""')).toBe(true);
  });

  it('returns just the header for an empty table', () => {
    const csv = dossierStationsToCsv([]);
    expect(csv.split('\n')).toHaveLength(1);
    expect(csv).toMatch(/^Estación,/);
  });
});
