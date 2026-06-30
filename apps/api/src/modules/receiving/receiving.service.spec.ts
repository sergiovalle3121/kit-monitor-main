import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { ReceivingService } from './receiving.service';
import { ReceivingEvent } from './entities/receiving-event.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { User } from '../users/entities/user.entity';

/**
 * Integración ligera (SQLite en memoria) del folio de recibo y su cableado al
 * inventario. `numbering` y `receivingRepo` son reales; los servicios pesados
 * (inventory/ledger/audit) se simulan para verificar el cableado sin su interior.
 */
describe('ReceivingService — folio + cableado de inventario', () => {
  let dataSource: DataSource;
  let service: ReceivingService;
  let numbering: DocumentNumberingService;
  let inventory: { recordTransaction: jest.Mock; ensureMaterial: jest.Mock };
  const year = new Date().getFullYear();
  const user = { email: 'supervisor@axos.test' } as unknown as User;

  const dto = (
    over: Partial<ReceivingEvent> = {},
  ): Partial<ReceivingEvent> => ({
    partNumber: 'RES-0402-10K',
    quantity: 5000,
    warehouseId: 'WH-1',
    location: 'DOCK',
    supplierCode: 'SUP-001',
    receivedBy: 'op1',
    ...over,
  });

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [ReceivingEvent, DocumentSequence],
    });
    await dataSource.initialize();

    const ctx = new TenantContextService();
    numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    inventory = {
      recordTransaction: jest.fn().mockResolvedValue({}),
      ensureMaterial: jest.fn().mockResolvedValue({}),
    };
    const ledger = { recordEvent: jest.fn().mockResolvedValue(undefined) };
    const audit = { recordAction: jest.fn().mockResolvedValue(undefined) };
    const warehouseRepo = {} as never; // recordReceipt no lo usa
    const tenantCtx = { getTenantId: () => null } as unknown as TenantContextService;

    service = new ReceivingService(
      dataSource.getRepository(ReceivingEvent) as never,
      inventory as never,
      ledger as never,
      audit as never,
      warehouseRepo,
      numbering,
      tenantCtx,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('asigna folio REC-YYYY-NNNN y registra un movimiento RECEIVE con ese folio', async () => {
    const expiresAt = new Date('2026-12-31T00:00:00.000Z');
    const r = await service.recordReceipt(dto({ expiresAt }), user);

    expect(r.receiptNumber).toBe(`REC-${year}-0001`);
    expect(r.expiresAt).toEqual(expiresAt);
    expect(inventory.recordTransaction).toHaveBeenCalledTimes(1);
    const tx = inventory.recordTransaction.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(tx.type).toBe('RECEIVE');
    expect(tx.referenceId).toBe(`REC-${year}-0001`);
    expect(tx.referenceType).toBe('RECEIPT');
    expect(tx.holdStatus).toBe('pending_iqc');
    expect(tx.partNumber).toBe('RES-0402-10K');
    expect(tx.quantity).toBe(5000);
    expect(tx.expiresAt).toEqual(expiresAt);
  });

  it('incrementa el folio de forma atómica en recibos sucesivos', async () => {
    await service.recordReceipt(dto({ partNumber: 'A' }), user);
    const r2 = await service.recordReceipt(dto({ partNumber: 'B' }), user);
    expect(r2.receiptNumber).toBe(`REC-${year}-0002`);
  });

  it('rejects an invalid lot expiry before saving receipt inventory', async () => {
    await expect(
      service.recordReceipt(dto({ expiresAt: 'not-a-date' as never }), user),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(inventory.recordTransaction).not.toHaveBeenCalled();
  });

  it('si la numeración falla, usa un folio de respaldo único con marca F (sin colisión)', async () => {
    jest.spyOn(numbering, 'allocate').mockRejectedValueOnce(new Error('boom'));
    const r = await service.recordReceipt(dto({ partNumber: 'C' }), user);
    expect(r.receiptNumber).toMatch(new RegExp(`^REC-${year}-F[0-9A-Z]+$`));
    // El de respaldo no debe chocar con el formato secuencial.
    expect(r.receiptNumber).not.toMatch(/^REC-\d{4}-\d+$/);
  });
});
