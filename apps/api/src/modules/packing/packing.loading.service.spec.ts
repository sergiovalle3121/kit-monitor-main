import { DataSource } from 'typeorm';
import { PackingService } from './packing.service';
import { HandlingUnit } from './entities/handling-unit.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

describe('PackingService — scan-verified loading (Carga verificada)', () => {
  let dataSource: DataSource;
  let packing: PackingService;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [HandlingUnit, DocumentSequence],
    });
    await dataSource.initialize();
    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    packing = new PackingService(
      dataSource.getRepository(HandlingUnit),
      ctx,
      numbering,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  const pack = (shipmentId: string, folio?: string) =>
    packing.create({
      shipmentId,
      shipmentFolio: folio,
      type: 'CARTON',
      contents: [{ partNumber: 'PN-1', quantity: 2 }],
    });

  it('starts incomplete and completes as each unit is scanned', async () => {
    const a = await pack('ship-A');
    const b = await pack('ship-A');

    let state = await packing.loadingState('ship-A');
    expect(state).toMatchObject({
      total: 2,
      loaded: 0,
      pending: 2,
      complete: false,
      hasUnits: true,
    });

    const r1 = await packing.verifyScan('ship-A', a.sscc!);
    expect(r1.outcome.result).toBe('matched');
    expect(r1.state.loaded).toBe(1);

    const r2 = await packing.verifyScan('ship-A', b.sscc!);
    expect(r2.outcome.result).toBe('matched');
    expect(r2.state.complete).toBe(true);

    state = await packing.loadingState('ship-A');
    expect(state.pending).toBe(0);
  });

  it('is idempotent when the same unit is re-scanned', async () => {
    const a = await pack('ship-A');
    await packing.verifyScan('ship-A', a.sscc!);
    const again = await packing.verifyScan('ship-A', a.sscc!);
    expect(again.outcome.result).toBe('already');
    expect(again.state.loaded).toBe(1);
  });

  it('accepts the raw GS1-128 scan (AI "00" + 18 digits)', async () => {
    const a = await pack('ship-A');
    const raw = `00${a.sscc}`;
    const r = await packing.verifyScan('ship-A', raw);
    expect(r.outcome.result).toBe('matched');
  });

  it('blocks a unit that belongs to another shipment (poka-yoke)', async () => {
    const other = await pack('ship-B', 'SHP-2026-000002');
    await expect(packing.verifyScan('ship-A', other.sscc!)).rejects.toThrow(
      /pertenece/i,
    );
    // …and it stays pending on its own shipment.
    expect((await packing.loadingState('ship-B')).loaded).toBe(0);
  });

  it('rejects an unknown SSCC', async () => {
    await pack('ship-A');
    await expect(
      packing.verifyScan('ship-A', '999999999999999999'),
    ).rejects.toThrow(/no corresponde/i);
  });

  it('reset reverts a loaded unit back to pending', async () => {
    const a = await pack('ship-A');
    await packing.verifyScan('ship-A', a.sscc!);
    const state = await packing.resetScan('ship-A', a.id);
    expect(state.loaded).toBe(0);
    expect(state.pending).toBe(1);
  });

  describe('assertLoadingComplete (READY gate)', () => {
    it('allows a shipment that uses no handling units', async () => {
      await expect(
        packing.assertLoadingComplete('ship-none'),
      ).resolves.toBeUndefined();
    });

    it('blocks while units are pending, then allows once all are scanned', async () => {
      const a = await pack('ship-A');
      await expect(packing.assertLoadingComplete('ship-A')).rejects.toThrow(
        /faltan/i,
      );
      await packing.verifyScan('ship-A', a.sscc!);
      await expect(
        packing.assertLoadingComplete('ship-A'),
      ).resolves.toBeUndefined();
    });
  });
});
