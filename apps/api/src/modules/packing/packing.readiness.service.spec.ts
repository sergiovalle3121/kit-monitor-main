import { DataSource } from 'typeorm';
import { PackingService } from './packing.service';
import { HandlingUnit } from './entities/handling-unit.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import type { TestFlowService } from '../test-flow/test-flow.service';
import type { UnitFlow } from '../test-flow/entities/unit-flow.entity';

describe('PackingService - passed-unit readiness', () => {
  let dataSource: DataSource;
  let packing: PackingService;
  let flows: UnitFlow[];

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
    flows = [
      flow('SN-PASS-1', 'READY_FOR_PACKAGING', 'PASS', 'PACKAGING'),
      flow('SN-PASS-2', 'READY_FOR_PACKAGING', 'PASS', 'PACKAGING'),
      flow('SN-FAIL-1', 'IN_DISPOSITION', 'FAIL', 'DISPOSITION'),
      flow('SN-WAIT-1', 'AWAITING_TEST', null, null),
    ];
    const testFlow = {
      getQueue: jest.fn(async () => flows),
    } as unknown as TestFlowService;

    packing = new PackingService(
      dataSource.getRepository(HandlingUnit),
      ctx,
      numbering,
      testFlow,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  function flow(
    serialNumber: string,
    stage: UnitFlow['stage'],
    testResult: UnitFlow['testResult'],
    destination: UnitFlow['destination'],
  ): UnitFlow {
    return {
      id: serialNumber,
      serialNumber,
      stage,
      testResult,
      destination,
      workOrder: 'WO-9001',
      executionId: null,
      model: 'AX-100',
      assemblyStation: 'FINAL',
      failureCode: testResult === 'FAIL' ? 'ICT-FAIL' : null,
      testRecordId: testResult ? `TST-${serialNumber}` : null,
      holdId: null,
      enqueuedAt: new Date('2026-06-29T08:00:00.000Z'),
      testedAt: testResult ? new Date('2026-06-29T08:05:00.000Z') : null,
      routedAt: destination ? new Date('2026-06-29T08:06:00.000Z') : null,
      programId: null,
      tenant_id: null,
      plant_id: null,
      created_by: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    } as UnitFlow;
  }

  it('reports available, packed, awaiting-test, and blocked serials', async () => {
    await packing.create({
      type: 'CARTON',
      contents: [
        { partNumber: 'AX-100', quantity: 1, serials: ['SN-PASS-1'] },
      ],
    });

    const readiness = await packing.readiness({ workOrder: 'WO-9001' });

    expect(readiness.totals).toMatchObject({
      totalSerials: 4,
      readyForPacking: 2,
      available: 1,
      packed: 1,
      awaitingTest: 1,
      blocked: 1,
    });
    expect(readiness.availableSerials).toEqual(['SN-PASS-2']);
    expect(
      readiness.units.find((unit) => unit.serialNumber === 'SN-PASS-1')
        ?.status,
    ).toBe('PACKED');
  });

  it('rejects serials that have not passed testing into packaging', async () => {
    await expect(
      packing.create({
        type: 'CARTON',
        contents: [
          { partNumber: 'AX-100', quantity: 1, serials: ['SN-FAIL-1'] },
        ],
      }),
    ).rejects.toThrow(/PASS\/READY_FOR_PACKAGING/);
  });

  it('rejects a serial already assigned to another handling unit', async () => {
    await packing.create({
      type: 'CARTON',
      contents: [
        { partNumber: 'AX-100', quantity: 1, serials: ['SN-PASS-1'] },
      ],
    });

    await expect(
      packing.create({
        type: 'CARTON',
        contents: [
          { partNumber: 'AX-100', quantity: 1, serials: ['SN-PASS-1'] },
        ],
      }),
    ).rejects.toThrow(/dos veces/);
  });

  it('keeps available serials but excludes units packed into other shipments', async () => {
    flows.push(flow('SN-PASS-3', 'READY_FOR_PACKAGING', 'PASS', 'PACKAGING'));
    await packing.create({
      shipmentId: 'SHIP-A',
      shipmentFolio: 'SHP-A',
      type: 'CARTON',
      contents: [
        { partNumber: 'AX-100', quantity: 1, serials: ['SN-PASS-1'] },
      ],
    });
    await packing.create({
      shipmentId: 'SHIP-B',
      shipmentFolio: 'SHP-B',
      type: 'CARTON',
      contents: [
        { partNumber: 'AX-100', quantity: 1, serials: ['SN-PASS-2'] },
      ],
    });

    const readiness = await packing.readiness({ shipmentId: 'SHIP-A' });

    expect(readiness.units.map((unit) => unit.serialNumber)).toEqual([
      'SN-PASS-3',
      'SN-PASS-1',
    ]);
    expect(readiness.totals).toMatchObject({
      totalSerials: 2,
      readyForPacking: 2,
      available: 1,
      packed: 1,
    });
  });

  it('rejects content lines whose serial count does not match quantity', async () => {
    await expect(
      packing.create({
        type: 'CARTON',
        contents: [
          {
            partNumber: 'AX-100',
            quantity: 2,
            serials: ['SN-PASS-1'],
          },
        ],
      }),
    ).rejects.toThrow(/Cantidad y seriales no coinciden/);
  });

  it('allows updating the same handling unit without treating its serial as duplicate', async () => {
    const hu = await packing.create({
      type: 'CARTON',
      contents: [
        { partNumber: 'AX-100', quantity: 1, serials: ['SN-PASS-1'] },
      ],
    });

    const updated = await packing.update(hu.id, {
      contents: [
        { partNumber: 'AX-100', quantity: 1, serials: ['SN-PASS-1'] },
      ],
      weightKg: 1.2,
    });

    expect(updated.weightKg).toBe(1.2);
  });
});
