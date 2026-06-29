import { EventLedgerController } from './event-ledger.controller';
import { EventLedgerService } from './event-ledger.service';

describe('EventLedgerController', () => {
  let controller: EventLedgerController;
  let service: {
    findRecent: jest.Mock;
    queryEvents: jest.Mock;
    getEventsByReference: jest.Mock;
    getEventsByWorkOrder: jest.Mock;
  };

  beforeEach(() => {
    service = {
      findRecent: jest.fn().mockResolvedValue([{ id: 'e0' }]),
      queryEvents: jest.fn().mockResolvedValue({
        items: [{ id: 'e1' }],
        pagination: {
          page: 1,
          pageSize: 50,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }),
      getEventsByReference: jest.fn().mockResolvedValue([{ id: 'e1' }]),
      getEventsByWorkOrder: jest.fn().mockResolvedValue([{ id: 'e2' }]),
    };
    controller = new EventLedgerController(
      service as unknown as EventLedgerService,
    );
  });

  it('list sanitizes limit and delegates to the recent feed', async () => {
    const res = await controller.list('25');
    expect(service.findRecent).toHaveBeenCalledWith(25);
    expect(res).toEqual([{ id: 'e0' }]);
  });

  it('query delegates composable filters to the service', async () => {
    const res = await controller.query({
      domain: 'production',
      referenceType: 'work_order',
      referenceId: 'WO-123',
      line: 'LINE-1',
      program: 'EVT',
      page: '2',
    });
    expect(service.queryEvents).toHaveBeenCalledWith({
      domain: 'production',
      referenceType: 'work_order',
      referenceId: 'WO-123',
      line: 'LINE-1',
      program: 'EVT',
      page: '2',
    });
    expect(res.items).toEqual([{ id: 'e1' }]);
  });

  it('getByReference uppercases the reference type', async () => {
    const res = await controller.getByReference('kit', 'K-1');
    expect(service.getEventsByReference).toHaveBeenCalledWith('KIT', 'K-1');
    expect(res).toEqual([{ id: 'e1' }]);
  });

  it('getByWorkOrder delegates the WO unchanged', async () => {
    const res = await controller.getByWorkOrder('WO-123');
    expect(service.getEventsByWorkOrder).toHaveBeenCalledWith('WO-123');
    expect(res).toEqual([{ id: 'e2' }]);
  });
});
