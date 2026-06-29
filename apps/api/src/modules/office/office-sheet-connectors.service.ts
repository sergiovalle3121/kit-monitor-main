import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AXOS_SHEET_CONNECTOR_BY_TYPE,
  validateAxosSheetConnectorParams,
  type AxosSheetConnectorDefinition,
  type AxosSheetConnectorType,
} from '@axos/contracts';
import type { AuthenticatedUser } from '../../common/types/jwt.types';

export type OfficeSheetConnectorType = AxosSheetConnectorType;

@Injectable()
export class OfficeSheetConnectorsService {
  refresh(
    type: string,
    rawParams: Record<string, unknown>,
    user: AuthenticatedUser,
  ) {
    const def = AXOS_SHEET_CONNECTOR_BY_TYPE[type as AxosSheetConnectorType];
    if (!def)
      throw new BadRequestException(`Conector AXOS no soportado: ${type}`);
    const validation = validateAxosSheetConnectorParams(def.type, rawParams);
    if (!validation.ok) throw new BadRequestException(validation.errors);
    return {
      type: def.type,
      label: def.label,
      domain: def.domain,
      tenantId: user?.tenant_id ?? null,
      asOf: new Date().toISOString(),
      params: validation.params,
      columns: def.headers,
      rows: this.filterRows(def, validation.params),
      source: 'office-sheet-connector-sample',
      readOnly: true,
      warnings: [
        'Endpoint read-only preparado para reemplazar sample rows por agregadores tenant-safe del dominio AXOS.',
      ],
    };
  }

  private filterRows(
    def: AxosSheetConnectorDefinition,
    params: Record<string, string>,
  ) {
    const textFilters = Object.values(params)
      .filter(Boolean)
      .map((value) => value.toLowerCase());
    if (!textFilters.length) return def.rows;
    return def.rows.filter((row) =>
      textFilters.every((filter) =>
        row.some((cell) => String(cell).toLowerCase().includes(filter)),
      ),
    );
  }
}
