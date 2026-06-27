import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Advance } from './entities/advance.entity';
import { Kit } from '../kits/entities/kit.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { CreateAdvanceDto } from './dto/create-advance.dto';

@Injectable()
export class AdvancesService {
  constructor(
    @Inject(getTenantRepositoryToken(Advance))    private readonly repo: TenantScopedRepository<Advance>,
    @Inject(getTenantRepositoryToken(Kit))        private readonly kitRepo: TenantScopedRepository<Kit>,
    @Inject(getTenantRepositoryToken(KitMaterial)) private readonly materialRepo: TenantScopedRepository<KitMaterial>,
    private readonly dataSource: DataSource,
  ) {}

  findByKit(kitId: number): Promise<Advance[]> {
    return this.repo.find({
      where: { kit: { id: kitId } },
      order: { registeredAt: 'DESC' },
    });
  }

  async create(dto: CreateAdvanceDto): Promise<any> {
    // ── 1. Load kit with all needed relations ──────────────────
    const kit = await this.kitRepo.findOne({
      where: { id: dto.kitId },
      relations: ['plan', 'materials', 'advances'],
    });
    if (!kit) throw new NotFoundException(`Kit ${dto.kitId} not found`);

    // ── 2. Validate delta ─────────────────────────────────────
    if (!dto.unitsAssembled || dto.unitsAssembled <= 0) {
      throw new BadRequestException('unitsAssembled must be greater than 0');
    }

    const totalBefore = kit.advances.reduce((s, a) => s + a.unitsAssembled, 0);
    const totalAfter  = totalBefore + dto.unitsAssembled;
    const planQty     = kit.plan.quantity;

    if (totalAfter > planQty) {
      throw new BadRequestException(
        `Advance would exceed plan quantity (${planQty}). ` +
        `Already completed: ${totalBefore}. Delta: ${dto.unitsAssembled}. ` +
        `Max allowed: ${planQty - totalBefore}.`,
      );
    }

    // ── 3. Atomic: save advance + update materials + kit status ─
    return this.dataSource.transaction(async (em) => {
      // Save advance
      const advance = em.create(Advance, {
        kit:            { id: dto.kitId } as Kit,
        unitsAssembled: dto.unitsAssembled,
        notes:          dto.notes,
      });
      await em.save(Advance, advance);

      // Recalculate consumption for every KitMaterial
      for (const material of kit.materials) {
        // Derive usageFactor from stored quantityRequired and plan quantity
        const usageFactor        = material.quantityRequired / planQty;
        const quantityConsumed   = usageFactor * totalAfter;
        const quantityResupplied = material.quantityResupplied ?? 0;
        const quantityRemaining  = (material.quantityRequired + quantityResupplied) - quantityConsumed;
        await em.update(KitMaterial, material.id, {
          quantityConsumed:  Math.round(quantityConsumed  * 1e6) / 1e6,
          quantityRemaining: Math.round(quantityRemaining * 1e6) / 1e6,
        });
      }

      // Update kit status
      const newStatus = totalAfter >= planQty ? 'completed' : 'in_progress';
      if (newStatus !== kit.status) {
        await em.update(Kit, kit.id, { status: newStatus });
      }

      return {
        advance,
        totalCompleted: totalAfter,
        kitStatus: newStatus,
      };
    });
  }
}
