import { ForbiddenException } from '@nestjs/common';
import { AiActionsService } from './ai-actions.service';
import type { ReqUser } from './ai.service';

function setup() {
  const maintenance = {
    createOrder: jest.fn().mockResolvedValue({
      id: 'o1',
      folio: 'MO-0001',
      title: 'Cambiar termopar',
      status: 'OPEN',
    }),
  };
  const moduleRef = { get: jest.fn().mockReturnValue(maintenance) };
  const service = new AiActionsService(moduleRef as never);
  return { service, maintenance };
}

const admin: ReqUser = { userId: 'a', email: 'admin@b.com', role: 'Admin' };
const writer: ReqUser = {
  userId: 'w',
  email: 'w@b.com',
  role: 'User',
  permissions: ['maintenance:write'],
};
const reader: ReqUser = {
  userId: 'r',
  email: 'r@b.com',
  role: 'User',
  permissions: ['maintenance:read'],
};

describe('AiActionsService.can', () => {
  it('admin can; writer can; reader cannot; unknown action cannot', () => {
    const { service } = setup();
    expect(service.can(admin, 'create_maintenance_order')).toBe(true);
    expect(service.can(writer, 'create_maintenance_order')).toBe(true);
    expect(service.can(reader, 'create_maintenance_order')).toBe(false);
    expect(service.can(admin, 'nope')).toBe(false);
  });
});

describe('AiActionsService.execute', () => {
  it('forbids a caller without the write permission', async () => {
    const { service, maintenance } = setup();
    await expect(
      service.execute(reader, 'create_maintenance_order', {
        title: 'Cambiar termopar',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(maintenance.createOrder).not.toHaveBeenCalled();
  });

  it('rejects an unknown action without touching any service', async () => {
    const { service, maintenance } = setup();
    const out = await service.execute(admin, 'launch_rockets', {});
    expect(out.ok).toBe(false);
    expect(maintenance.createOrder).not.toHaveBeenCalled();
  });

  it('re-validates params and refuses an invalid proposal', async () => {
    const { service, maintenance } = setup();
    const out = await service.execute(writer, 'create_maintenance_order', {
      title: 'no',
    });
    expect(out.ok).toBe(false);
    expect(maintenance.createOrder).not.toHaveBeenCalled();
  });

  it('executes a valid confirmed action and returns the result', async () => {
    const { service, maintenance } = setup();
    const out = await service.execute(writer, 'create_maintenance_order', {
      title: 'Cambiar termopar zona 3',
      priority: 'high',
    });
    expect(out.ok).toBe(true);
    expect(maintenance.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cambiar termopar zona 3',
        priority: 'HIGH',
      }),
    );
    expect((out.result as { folio?: string }).folio).toBe('MO-0001');
  });
});

describe('AiActionsService.execute — extended actions', () => {
  it('creates a purchase requisition with the caller as createdBy', async () => {
    const mm = {
      createRequisition: jest
        .fn()
        .mockResolvedValue({ id: 7, prNumber: 'PR-0007', status: 'open' }),
    };
    const service = new AiActionsService({
      get: jest.fn().mockReturnValue(mm),
    } as never);
    const buyer: ReqUser = {
      userId: 'b',
      email: 'buyer@b.com',
      role: 'User',
      permissions: ['materials:write'],
    };
    const out = await service.execute(buyer, 'create_purchase_requisition', {
      partNumber: 'CAP-100',
      quantity: '250',
    });
    expect(out.ok).toBe(true);
    expect(mm.createRequisition).toHaveBeenCalledWith(
      expect.objectContaining({
        partNumber: 'CAP-100',
        quantity: 250,
        createdBy: 'buyer@b.com',
        source: 'manual',
      }),
    );
    expect((out.result as { prNumber?: string }).prNumber).toBe('PR-0007');
  });

  it('forbids assigning an EHS owner without the reports:read permission', async () => {
    const service = new AiActionsService({ get: jest.fn() } as never);
    const nobody: ReqUser = {
      userId: 'n',
      email: 'n@b.com',
      role: 'User',
      permissions: [],
    };
    await expect(
      service.execute(nobody, 'assign_ehs_incident_owner', {
        incidentId: 'I-1',
        owner: 'Ana',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
