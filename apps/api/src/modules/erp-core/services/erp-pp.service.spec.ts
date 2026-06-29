import { Repository } from 'typeorm';
import { SignalGateway } from '../../../common/gateway/signal.gateway';
import { BomComponent } from '../../bom/entities/bom-component.entity';
import { BomHeader } from '../../bom/entities/bom-header.entity';
import { BomItem } from '../../bom/entities/bom-item.entity';
import { InventoryPosition } from '../../inventory/entities/inventory-position.entity';
import { ReplenishmentRule } from '../../inventory/entities/replenishment-rule.entity';
import { Plan } from '../../plans/entities/plan.entity';
import { ErpMrpResult } from '../entities/erp-mrp-result.entity';
import { ErpMrpRun } from '../entities/erp-mrp-run.entity';
import { ErpPlannedOrder } from '../entities/erp-planned-order.entity';
import { ErpPurchaseOrderLine } from '../entities/erp-purchase-order-line.entity';
import { ErpPpService } from './erp-pp.service';
import { ErpMmService } from './erp-mm.service';
import { ErpSdService } from './erp-sd.service';

type MockRepo<T> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const repo = <T>(): MockRepo<T> => ({
  find: jest.fn(),
});

const typedRepo = <T>() => repo<T>() as unknown as Repository<T>;

const buildService = () => {
  const plannedRepo = repo<ErpPlannedOrder>();
  const service = new ErpPpService(
    typedRepo<ErpMrpRun>(),
    typedRepo<ErpMrpResult>(),
    plannedRepo as unknown as Repository<ErpPlannedOrder>,
    typedRepo<ErpPurchaseOrderLine>(),
    typedRepo<BomHeader>(),
    typedRepo<BomComponent>(),
    typedRepo<BomItem>(),
    typedRepo<InventoryPosition>(),
    typedRepo<ReplenishmentRule>(),
    typedRepo<Plan>(),
    {} as ErpMmService,
    {} as ErpSdService,
    { emitToTenant: jest.fn() } as unknown as SignalGateway,
  );

  return { service, plannedRepo };
};

describe('ErpPpService planned orders', () => {
  it('keeps the existing unfiltered list behavior', async () => {
    const { service, plannedRepo } = buildService();
    plannedRepo.find!.mockResolvedValue([]);

    await service.listPlannedOrders();

    expect(plannedRepo.find).toHaveBeenCalledWith({
      where: {},
      order: { createdAt: 'DESC' },
      take: 300,
    });
  });

  it('filters planned orders by materialId using the stored part number', async () => {
    const { service, plannedRepo } = buildService();
    plannedRepo.find!.mockResolvedValue([]);

    await service.listPlannedOrders({
      materialId: ' AX-100 ',
      status: 'planned',
      mrpRunId: 7,
    });

    expect(plannedRepo.find).toHaveBeenCalledWith({
      where: { status: 'planned', mrpRunId: 7, partNumber: 'AX-100' },
      order: { createdAt: 'DESC' },
      take: 300,
    });
  });
});
