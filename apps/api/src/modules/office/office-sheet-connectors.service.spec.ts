import { BadRequestException } from '@nestjs/common';
import { OfficeSheetConnectorsService } from './office-sheet-connectors.service';
import type { AuthenticatedUser } from '../../common/types/jwt.types';

const user = {
  tenant_id: 'tenant-a',
  email: 'planner@axos.test',
  role: 'Planner',
  permissions: ['office:read'],
} as AuthenticatedUser;

describe('OfficeSheetConnectorsService', () => {
  const service = new OfficeSheetConnectorsService();

  it('returns tenant-scoped read-only connector data', () => {
    const result = service.refresh(
      'inventory_snapshot',
      { site: 'MAIN', abcClass: 'A' },
      user,
    );
    expect(result.type).toBe('inventory_snapshot');
    expect(result.tenantId).toBe('tenant-a');
    expect(result.readOnly).toBe(true);
    expect(result.columns).toContain('SKU');
    expect(result.params).toEqual({ site: 'MAIN', abcClass: 'A' });
    expect(
      result.rows.every((row) => row.includes('A') || row.includes('MAIN')),
    ).toBe(true);
  });

  it('rejects missing required parameters', () => {
    expect(() => service.refresh('bom_cost_rollup', {}, user)).toThrow(
      BadRequestException,
    );
  });

  it('rejects invalid select and date parameters', () => {
    expect(() =>
      service.refresh('purchase_orders', { risk: 'Extreme' }, user),
    ).toThrow(BadRequestException);
    expect(() =>
      service.refresh('oee_by_line', { dateFrom: '06/27/2026' }, user),
    ).toThrow(BadRequestException);
  });

  it('rejects unknown connector types', () => {
    expect(() => service.refresh('unknown', {}, user)).toThrow(
      BadRequestException,
    );
  });
});
