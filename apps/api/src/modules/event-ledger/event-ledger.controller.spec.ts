import { EventLedgerController } from './event-ledger.controller';
import { EventLedgerService } from './event-ledger.service';

/**
 * Unit del controller del Event Ledger con el servicio simulado. Verifica que
 * `reference/:type/:id` normaliza el tipo a MAYÚSCULAS y que `work-order/:wo`
 * delega tal cual.
 */
describe('EventLedgerController', () => {
  let controller: EventLedgerController;
  let service: { getEventsByReference: jest.Mock; getEventsByWorkOrder: jest.Mock };

  beforeEach(() => {
    service = {
      getEventsByReference: jest.fn().mockResolvedValue([{ id: 'e1' }]),
      getEventsByWorkOrder: jest.fn().mockResolvedValue([{ id: 'e2' }]),
    };
    controller = new EventLedgerController(service as unknown as EventLedgerService);
  });

  it('getByReference normaliza el tipo a mayúsculas', async () => {
    const res = await controller.getByReference('kit', 'K-1');
    expect(service.getEventsByReference).toHaveBeenCalledWith('KIT', 'K-1');
    expect(res).toEqual([{ id: 'e1' }]);
  });

  it('getByWorkOrder delega el folio sin transformar', async () => {
    const res = await controller.getByWorkOrder('WO-123');
    expect(service.getEventsByWorkOrder).toHaveBeenCalledWith('WO-123');
    expect(res).toEqual([{ id: 'e2' }]);
  });
});
