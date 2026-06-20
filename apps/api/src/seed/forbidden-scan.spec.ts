import 'reflect-metadata';
import { Column, DataSource, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

import { assertDatabasePublicDomain, formatScanReport, scanForbidden } from './forbidden-scan';

// ── Entidades de prueba (desechables, sólo para este spec; sqlite en memoria) ──
@Entity('t_parts')
class TPart {
  @PrimaryColumn({ type: 'varchar' })
  partNumber: string;

  @Column({ type: 'varchar', nullable: true })
  description: string;
}

@Entity('t_orders')
class TOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true })
  supplierName: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'simple-array', nullable: true })
  operators: string[] | null;
}

describe('forbidden-scan (motor compartido de auditoría/purga)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [TPart, TOrder],
      synchronize: true,
    });
    await ds.initialize();

    const parts = ds.getRepository(TPart);
    await parts.save([
      { partNumber: 'AX-DRIVE-100', description: 'Controladora demo limpia' }, // limpio
      { partNumber: 'OP-520-0100', description: 'parte de cliente real' }, // prefijo prohibido (texto)
      { partNumber: 'RES-10K-0402', description: 'placa para Motorola Solutions' }, // empresa real (texto)
    ]);

    const orders = ds.getRepository(TOrder);
    await orders.save([
      { supplierName: 'ACME Robotics', metadata: { demo: true }, operators: ['a@axos.example'] }, // limpio
      { supplierName: 'Proveedor Genérico', metadata: { customer: 'Optics' }, operators: ['x@axos.example'] }, // sólo JSON prohibido
      { supplierName: 'Proveedor Genérico', metadata: { ok: 1 }, operators: ['op@nvidia.com'] }, // sólo array prohibido
    ]);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it('detecta prohibidos en columnas de texto, JSON y arreglo', async () => {
    const res = await scanForbidden(ds);
    // P2 (prefijo) + P3 (empresa) + O2 (json) + O3 (array) = 4 filas
    expect(res.totalMatchedRows).toBe(4);

    const parts = res.withHits.find((f) => f.table === 't_parts');
    const orders = res.withHits.find((f) => f.table === 't_orders');
    expect(parts?.matched).toBe(2);
    expect(orders?.matched).toBe(2);

    // El desglose por motivo incluye prefijo y empresas reales.
    const reasons = Object.keys(res.byReason).join(' | ').toLowerCase();
    expect(reasons).toMatch(/prefijo/);
    expect(reasons).toMatch(/optics|motorola|nvidia/);
  });

  it('NO marca los datos limpios (AXOS / ACME / commodities)', async () => {
    const res = await scanForbidden(ds);
    const parts = res.withHits.find((f) => f.table === 't_parts');
    const pks = parts?.rows.map((r) => r.pk).join(' ') ?? '';
    expect(pks).not.toMatch(/AX-DRIVE-100/);
  });

  it('respeta scanJson=false (no revisa columnas JSON)', async () => {
    const res = await scanForbidden(ds, { scanJson: false });
    // Sin JSON, O2 (sólo json) deja de marcarse → 3 filas (P2, P3, O3)
    expect(res.totalMatchedRows).toBe(3);
  });

  it('respeta skipColumns (omite columnas indicadas)', async () => {
    const res = await scanForbidden(ds, { skipColumns: { t_orders: ['operators'] } });
    // Sin la columna array, O3 deja de marcarse → 3 filas (P2, P3, O2)
    expect(res.totalMatchedRows).toBe(3);
  });

  it('formatScanReport produce un reporte legible por tabla', async () => {
    const res = await scanForbidden(ds);
    const report = formatScanReport(res);
    expect(report).toContain('t_parts');
    expect(report).toContain('t_orders');
    expect(report).toMatch(/Filas afectadas: 4|4 prohibidas/);
  });

  it('assertDatabasePublicDomain LANZA ruidosamente cuando hay prohibidos', async () => {
    await expect(assertDatabasePublicDomain(ds)).rejects.toThrow(/PROHIBIDOS/i);
  });

  it('assertDatabasePublicDomain NO lanza cuando la base está limpia', async () => {
    const clean = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [TPart, TOrder],
      synchronize: true,
    });
    await clean.initialize();
    await clean.getRepository(TPart).save({ partNumber: 'AX-OK-1', description: 'limpio' });
    await expect(assertDatabasePublicDomain(clean)).resolves.toBeDefined();
    await clean.destroy();
  });
});
