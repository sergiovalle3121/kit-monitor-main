import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import {
  deriveReadiness,
  ReadinessDemandLine,
  ReadinessSummary,
} from '@axos/contracts';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { BomHeader, BomStatus } from '../bom/entities/bom-header.entity';
import { InventoryPosition } from '../inventory/entities/inventory-position.entity';
import { PublishWorkOrderDto } from './dto/production-plan.dto';

export interface ProductionPlanReadiness {
  publishable: boolean;
  model: string;
  revision: string;
  bomHeaderId: number | null;
  blockers: string[];
  demand: ReadinessDemandLine[];
  summary: ReadinessSummary;
}

@Injectable()
export class ProductionPlanReadinessService {
  constructor(
    @Inject(getTenantRepositoryToken(BomHeader))
    private readonly bomHeaders: TenantScopedRepository<BomHeader>,
    @Inject(getTenantRepositoryToken(InventoryPosition))
    private readonly positions: TenantScopedRepository<InventoryPosition>,
  ) {}

  async evaluatePublish(dto: PublishWorkOrderDto): Promise<ProductionPlanReadiness> {
    const model = dto.model.trim();
    const revision = (dto.revision ?? 'A').trim();
    const header = await this.findActiveBom(model, revision);
    const demand = header ? this.buildDemand(header, dto.quantityPlanned) : [];
    const availableByPart = await this.availableByPart(demand.map((line) => line.partNumber));
    const summary = deriveReadiness({
      demand,
      availableByPart,
      heldParts: new Set<string>(),
      dueDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
    });
    const blockers = this.materialBlockers(header, demand, summary);

    return {
      publishable: blockers.length === 0,
      model,
      revision,
      bomHeaderId: header?.id ?? null,
      blockers,
      demand,
      summary,
    };
  }

  private async findActiveBom(model: string, revision: string): Promise<BomHeader | null> {
    const active = await this.bomHeaders.find({
      where: { model, status: BomStatus.ACTIVE },
      relations: ['components'],
      order: { updatedAt: 'DESC' },
    });
    return active.find((header) => header.revision === revision) ?? active[0] ?? null;
  }

  private buildDemand(header: BomHeader, quantityPlanned: number): ReadinessDemandLine[] {
    const baseQuantity = Number(header.baseQuantity) > 0 ? Number(header.baseQuantity) : 1;
    return (header.components ?? [])
      .filter((component) => !!component.componentNumber)
      .map((component) => {
        const perUnit =
          ((Number(component.quantity) || 0) * (Number(component.usageFactor) || 1)) /
          baseQuantity;
        return {
          partNumber: component.componentNumber,
          description: component.description ?? null,
          quantityRequired: round(perUnit * quantityPlanned),
          unit: component.unit ?? 'EA',
        };
      });
  }

  private async availableByPart(parts: string[]): Promise<Map<string, number>> {
    const partNumbers = [...new Set(parts.filter(Boolean))];
    const availableByPart = new Map<string, number>();
    if (partNumbers.length === 0) return availableByPart;

    const positions = await this.positions.find({
      where: { partNumber: In(partNumbers), holdStatus: 'available' },
    });
    for (const position of positions) {
      const available = Math.max(
        0,
        (Number(position.onHand) || 0) - (Number(position.allocated) || 0),
      );
      availableByPart.set(
        position.partNumber,
        round((availableByPart.get(position.partNumber) ?? 0) + available),
      );
    }
    return availableByPart;
  }

  private materialBlockers(
    header: BomHeader | null,
    demand: ReadinessDemandLine[],
    summary: ReadinessSummary,
  ): string[] {
    if (!header) {
      return ['Sin BOM activo para el modelo; no se puede validar disponibilidad antes de publicar.'];
    }
    if (demand.length === 0) {
      return ['El BOM activo no tiene componentes; agrega materiales antes de publicar la WO.'];
    }
    if (summary.materials === 'green') return [];

    const topShortages = summary.detail.shortages.slice(0, 3).map(
      (line) =>
        `${line.partNumber}: faltan ${line.shortage} ${line.unit} (req ${line.required}, disp ${line.available})`,
    );
    return [
      `Material readiness incompleto: ${summary.detail.shortParts} de ${summary.detail.totalParts} materiales tienen faltante.`,
      ...topShortages,
    ];
  }
}

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round((Number(n) || 0) * f) / f;
}
