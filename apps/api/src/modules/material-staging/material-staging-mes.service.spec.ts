import { DataSource } from 'typeorm';
import {
  MaterialStagingMesService,
  deriveStagedStatus,
} from './material-staging-mes.service';
import { MesStagingLine } from './entities/mes-staging-line.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { createTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

/**
 * Carril 1 (puente MES). El estado de surtido (`sf_mes_staging`) corre sobre
 * SQLite real; el listado de planes y el pick-list se simulan (PickListService y
 * la entidad `Plan` —con su columna jsonb— ya tienen su propia cobertura y no
 * cargan bajo SQLite). Verifica que el kitteador ve los planes publicados, surte
 * y que el estado vive en su capa propia.
 */
describe('MaterialStagingMesService (carril 1 · puente MES)', () => {
  let dataSource: DataSource;
  let svc: MaterialStagingMesService;
  let ctx: TenantContextService;
  let pickList: { getByPlan: jest.Mock };
  let positions: { find: jest.Mock };
  let planRepo: { createQueryBuilder: jest.Mock };
  let stockByPart: Record<string, number>;

  const PLAN_ID = 1;
  const LINES = [
    {
      id: 11,
      partNumber: 'AX-PCBA-100',
      description: 'PCBA',
      quantityRequired: 50,
      unit: 'EA',
    },
    {
      id: 12,
      partNumber: 'ENC-AL-6061',
      description: 'Enclosure',
      quantityRequired: 50,
      unit: 'EA',
    },
  ];

  const pickPayload = () => ({
    planId: PLAN_ID,
    workOrder: 'AX-WO-0001',
    model: 'AX-DRIVE-100',
    quantity: 50,
    status: 'published',
    published: true,
    kitId: 7,
    lineCount: LINES.length,
    lines: LINES.map((l) => ({ ...l })),
  });

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [MesStagingLine],
    });
    await dataSource.initialize();
    ctx = new TenantContextService();
    pickList = { getByPlan: jest.fn(async () => pickPayload()) };
    stockByPart = {
      'AX-PCBA-100': 80,
      'ENC-AL-6061': 50,
    };
    positions = {
      find: jest.fn(async ({ where }: any) => {
        const partFilter =
          where?.partNumber?.value ??
          where?.partNumber?._value ??
          where?.partNumber ??
          [];
        const partNumbers = Array.isArray(partFilter) ? partFilter : [partFilter];
        return partNumbers
          .filter((partNumber) => stockByPart[partNumber] != null)
          .map((partNumber) => ({
            partNumber,
            onHand: stockByPart[partNumber],
            allocated: 0,
          }));
      }),
    };
    planRepo = {
      createQueryBuilder: jest.fn(() => {
        const qb: any = {
          leftJoinAndSelect: () => qb,
          where: () => qb,
          andWhere: () => qb,
          orderBy: () => qb,
          getMany: async () => [
            {
              id: PLAN_ID,
              workOrder: 'AX-WO-0001',
              model: 'AX-DRIVE-100',
              line: 1,
              quantity: 50,
              priority: 'high',
              status: 'published',
              publishedAt: new Date(),
              kit: { id: 7, materials: LINES.map((l) => ({ id: l.id })) },
            },
          ],
        };
        return qb;
      }),
    };
    svc = new MaterialStagingMesService(
      createTenantScopedRepository(MesStagingLine, dataSource.manager, ctx),
      positions as never,
      planRepo as never,
      pickList as never,
      ctx,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('lists the published plan as a kitter work order with its pick-list count', async () => {
    const plans = await svc.listPublishedPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0].workOrder).toBe('AX-WO-0001');
    expect(plans[0].totalLines).toBe(2);
    expect(plans[0].stagedLines).toBe(0);
    expect(plans[0].allStaged).toBe(false);
  });

  it('returns the pick-list via PickListService.getByPlan with PENDING lines', async () => {
    const pick = await svc.getPlanPickList(PLAN_ID);
    expect(pickList.getByPlan).toHaveBeenCalledWith(PLAN_ID);
    expect(pick.lines).toHaveLength(2);
    expect(pick.lines.every((l: any) => l.stagingStatus === 'PENDING')).toBe(
      true,
    );
    expect(pick.lines[0].availableQty).toBe(80);
    expect(pick.lines[0].shortageQty).toBe(0);
    expect(pick.summary.stockReady).toBe(true);
    expect(pick.summary.fillRatePct).toBe(0);
  });

  it('marks a single line as staged in the carril-1 own state', async () => {
    const pick = await svc.stageLine(PLAN_ID, LINES[0].id, {});
    const staged = pick.lines.filter((l: any) => l.staged);
    expect(staged).toHaveLength(1);
    expect(staged[0].id).toBe(LINES[0].id);
    expect(staged[0].stagedQty).toBe(50);
    expect(pick.summary.stagedLines).toBe(1);
    expect(pick.summary.allStaged).toBe(false);
  });

  it('stage-all marks the whole plan and flips allStaged / fill-rate', async () => {
    const pick = await svc.stageAllForPlan(PLAN_ID);
    expect(pick.summary.stagedLines).toBe(2);
    expect(pick.summary.fillRatePct).toBe(1);
    expect(pick.summary.allStaged).toBe(true);

    const plans = await svc.listPublishedPlans();
    expect(plans[0].stagedLines).toBe(2);
    expect(plans[0].allStaged).toBe(true);
  });

  it('blocks staging a line when available inventory cannot cover the requested quantity', async () => {
    stockByPart['AX-PCBA-100'] = 20;

    await expect(svc.stageLine(PLAN_ID, LINES[0].id, {})).rejects.toThrow(
      /inventario|faltan|No se puede surtir/,
    );
  });

  it('blocks stage-all when any pick-list line is short', async () => {
    stockByPart['ENC-AL-6061'] = 10;

    await expect(svc.stageAllForPlan(PLAN_ID)).rejects.toThrow(
      /inventario disponible insuficiente/,
    );
  });

  it('blocks stage-all when repeated parts exceed aggregate available stock', async () => {
    stockByPart['AX-PCBA-100'] = 80;
    pickList.getByPlan.mockImplementation(async () => ({
      ...pickPayload(),
      lineCount: 3,
      lines: [
        LINES[0],
        { ...LINES[0], id: 13 },
        LINES[1],
      ],
    }));

    await expect(svc.stageAllForPlan(PLAN_ID)).rejects.toThrow(
      /AX-PCBA-100/,
    );
  });

  it('blocks staging a repeated part when sibling staged quantity already consumes stock', async () => {
    stockByPart['AX-PCBA-100'] = 80;
    pickList.getByPlan.mockImplementation(async () => ({
      ...pickPayload(),
      lineCount: 3,
      lines: [
        LINES[0],
        { ...LINES[0], id: 13 },
        LINES[1],
      ],
    }));

    await svc.stageLine(PLAN_ID, LINES[0].id, {});

    await expect(svc.stageLine(PLAN_ID, 13, {})).rejects.toThrow(
      /AX-PCBA-100/,
    );
  });

  it('unstage reverts a line to pending', async () => {
    await svc.stageAllForPlan(PLAN_ID);
    const pick = await svc.unstageLine(PLAN_ID, LINES[0].id);
    expect(pick.summary.stagedLines).toBe(1);
    const line = pick.lines.find((l: any) => l.id === LINES[0].id);
    expect(line.stagingStatus).toBe('PENDING');
    expect(line.stagedQty).toBe(0);
  });

  it('rejects staging a line that is not in the plan pick-list', async () => {
    await expect(svc.stageLine(PLAN_ID, 99999, {})).rejects.toThrow(
      /no existe/,
    );
  });

  it('deriveStagedStatus: STAGED only when staged covers a positive requirement', () => {
    expect(deriveStagedStatus(50, 50)).toBe('STAGED');
    expect(deriveStagedStatus(50, 60)).toBe('STAGED');
    expect(deriveStagedStatus(50, 10)).toBe('PENDING');
    expect(deriveStagedStatus(0, 0)).toBe('PENDING');
  });
});
