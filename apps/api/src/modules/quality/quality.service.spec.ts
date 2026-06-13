import { NotFoundException } from '@nestjs/common';
import { QualityService } from './quality.service';
import { IqcResult } from './entities/iqc-inspection.entity';
import { QuarantineTransferStatus } from './entities/quarantine-transfer.entity';

/**
 * Unit del QualityService con repos y colaboradores simulados. Se enfoca en los
 * métodos sin QueryRunner: resolución de holds (checkIsHeld), motor de CAPA,
 * dispositions, transferencias de cuarentena y registro de IQC.
 */
describe('QualityService', () => {
  let service: QualityService;
  let holdRepo: AnyRepo;
  let transferRepo: AnyRepo;
  let dispositionRepo: AnyRepo;
  let capaRepo: AnyRepo;
  let iqcRepo: AnyRepo;
  let oqcRepo: AnyRepo;
  let positionRepo: AnyRepo;
  let eventLedger: { recordEvent: jest.Mock };
  let inventory: { recordTransaction: jest.Mock };
  let audit: { recordException: jest.Mock; log: jest.Mock };

  type AnyRepo = {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
  };
  const mkRepo = (): AnyRepo => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((x) => ({ ...x })),
    save: jest.fn(async (x) => ({ id: 1, ...x })),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    holdRepo = mkRepo();
    transferRepo = mkRepo();
    dispositionRepo = mkRepo();
    capaRepo = mkRepo();
    iqcRepo = mkRepo();
    oqcRepo = mkRepo();
    positionRepo = mkRepo();
    eventLedger = { recordEvent: jest.fn().mockResolvedValue(undefined) };
    inventory = { recordTransaction: jest.fn().mockResolvedValue({}) };
    audit = {
      recordException: jest.fn().mockResolvedValue(undefined),
      log: jest.fn().mockResolvedValue(undefined),
    };
    service = new QualityService(
      holdRepo as never,
      transferRepo as never,
      dispositionRepo as never,
      capaRepo as never,
      iqcRepo as never,
      oqcRepo as never,
      positionRepo as never,
      eventLedger as never,
      inventory as never,
      {} as never, // ncrService
      {} as never, // suppliersService
      audit as never,
      {} as never, // dataSource (no usado por estos métodos)
    );
  });

  describe('checkIsHeld', () => {
    it('false cuando no hay holds activos', async () => {
      holdRepo.find.mockResolvedValue([]);
      await expect(service.checkIsHeld('P1', {})).resolves.toBe(false);
    });

    it('un hold PART_NUMBER aplica sin importar el contexto', async () => {
      holdRepo.find.mockResolvedValue([{ level: 'PART_NUMBER' }]);
      await expect(service.checkIsHeld('P1', {})).resolves.toBe(true);
    });

    it('hold WAREHOUSE sólo aplica si coincide el almacén del contexto', async () => {
      holdRepo.find.mockResolvedValue([{ level: 'WAREHOUSE', levelValue: 'WH-1' }]);
      await expect(service.checkIsHeld('P1', { warehouseId: 'WH-1' })).resolves.toBe(true);
      await expect(service.checkIsHeld('P1', { warehouseId: 'WH-2' })).resolves.toBe(false);
    });

    it('hold PROGRAM aplica al coincidir el programa', async () => {
      holdRepo.find.mockResolvedValue([{ level: 'PROGRAM', levelValue: 'PR9' }]);
      await expect(service.checkIsHeld('P1', { programId: 'PR9' })).resolves.toBe(true);
    });
  });

  describe('CAPA', () => {
    it('createCapa genera folio CAPA-YYYY-NNNN y registra el evento', async () => {
      capaRepo.count.mockResolvedValue(2);
      const year = new Date().getFullYear();
      const capa = await service.createCapa({ partNumber: 'P1', createdBy: 'qa' });
      expect(capa.capaNumber).toBe(`CAPA-${year}-0003`);
      expect(eventLedger.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CAPA_CREATED' }),
      );
    });

    it('updateCapa lanza 404 si no existe', async () => {
      capaRepo.findOne.mockResolvedValue(null);
      await expect(service.updateCapa(1, {}, 'qa')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updateCapa aplica el patch y registra el evento', async () => {
      capaRepo.findOne.mockResolvedValue({ id: 1, status: 'open' });
      const res = await service.updateCapa(1, { status: 'closed' } as never, 'qa');
      expect(res.status).toBe('closed');
      expect(eventLedger.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CAPA_UPDATED' }),
      );
    });
  });

  describe('Dispositions', () => {
    it('proposeDisposition crea en estado PROPOSED, registra evento y excepción', async () => {
      const d = await service.proposeDisposition({ partNumber: 'P1', type: 'scrap' as never, proposedBy: 'qa' });
      expect(d.status).toBe('proposed');
      expect(eventLedger.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DISPOSITION_PROPOSED' }),
      );
      expect(audit.recordException).toHaveBeenCalled();
    });

    it('approveDisposition lanza 404 si no existe', async () => {
      dispositionRepo.findOne.mockResolvedValue(null);
      await expect(service.approveDisposition(1, 'mgr')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('approveDisposition marca APPROVED y audita', async () => {
      dispositionRepo.findOne.mockResolvedValue({ id: 1, status: 'proposed', type: 'scrap', partNumber: 'P1' });
      const res = await service.approveDisposition(1, 'mgr');
      expect(res.status).toBe('approved');
      expect(res.approvedBy).toBe('mgr');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DISPOSITION_APPROVAL' }),
      );
    });
  });

  describe('Quarantine transfers', () => {
    it('requestQuarantineTransfer lanza 404 si el hold no existe', async () => {
      holdRepo.findOne.mockResolvedValue(null);
      await expect(
        service.requestQuarantineTransfer({
          holdId: 1,
          quantity: 5,
          sourceWarehouseId: 'WH-1',
          sourceLocation: 'A',
          destWarehouseId: 'WH-Q',
          destLocation: 'Q',
          requestedBy: 'qa',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('requestQuarantineTransfer hereda el partNumber del hold y queda PENDING', async () => {
      holdRepo.findOne.mockResolvedValue({ id: 1, partNumber: 'P9' });
      const t = await service.requestQuarantineTransfer({
        holdId: 1,
        quantity: 5,
        sourceWarehouseId: 'WH-1',
        sourceLocation: 'A',
        destWarehouseId: 'WH-Q',
        destLocation: 'Q',
        requestedBy: 'qa',
      });
      expect(t.partNumber).toBe('P9');
      expect(t.status).toBe(QuarantineTransferStatus.PENDING);
      expect(eventLedger.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'QUARANTINE_TRANSFER_REQUESTED' }),
      );
    });

    it('completeQuarantineTransfer rechaza un transfer ya procesado', async () => {
      transferRepo.findOne.mockResolvedValue({ id: 1, status: QuarantineTransferStatus.COMPLETED });
      await expect(service.completeQuarantineTransfer(1, 'mat')).rejects.toThrow(/already processed/);
    });

    it('completeQuarantineTransfer ejecuta el movimiento físico y marca COMPLETED', async () => {
      transferRepo.findOne.mockResolvedValue({
        id: 1,
        status: QuarantineTransferStatus.PENDING,
        partNumber: 'P9',
        quantity: 5,
        sourceWarehouseId: 'WH-1',
        sourceLocation: 'A',
        destWarehouseId: 'WH-Q',
        destLocation: 'Q',
        hold: { reason: 'NCR-1' },
      });
      const res = await service.completeQuarantineTransfer(1, 'mat');
      expect(inventory.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'TRANSFER', partNumber: 'P9', quantity: 5 }),
      );
      expect(res.status).toBe(QuarantineTransferStatus.COMPLETED);
      // Se sella la posición destino como cuarentena.
      expect(positionRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ partNumber: 'P9', warehouseId: 'WH-Q' }),
        { holdStatus: 'quarantine' },
      );
    });
  });

  describe('IQC', () => {
    it('recordIqcInspection PASS libera el stock pending_iqc del lote', async () => {
      const insp = await service.recordIqcInspection({
        partNumber: 'P1',
        lotNumber: 'L1',
        result: IqcResult.PASS,
        inspector: 'qa',
      });
      expect(insp.inspectionNumber).toMatch(/^IQC-\d{4}-0001$/);
      expect(positionRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ partNumber: 'P1', lotNumber: 'L1', holdStatus: 'pending_iqc' }),
        { holdStatus: 'available' },
      );
      expect(eventLedger.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'IQC_INSPECTION_RECORDED' }),
      );
    });

    it('recordIqcInspection CONDITIONAL no toca inventario ni crea hold', async () => {
      await service.recordIqcInspection({
        partNumber: 'P1',
        lotNumber: 'L1',
        result: IqcResult.CONDITIONAL,
        inspector: 'qa',
      });
      expect(positionRepo.update).not.toHaveBeenCalled();
      expect(eventLedger.recordEvent).toHaveBeenCalled();
    });
  });

  describe('lecturas simples', () => {
    it('findAllActiveHolds delega con el filtro activo', async () => {
      holdRepo.find.mockResolvedValue([{ id: 1 }]);
      await service.findAllActiveHolds();
      expect(holdRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('getOqcHistory filtra por partNumber cuando se pasa', async () => {
      oqcRepo.find.mockResolvedValue([]);
      await service.getOqcHistory('P1');
      expect(oqcRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { partNumber: 'P1' } }),
      );
    });
  });
});
