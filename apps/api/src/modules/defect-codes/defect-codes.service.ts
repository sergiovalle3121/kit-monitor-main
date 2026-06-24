import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DefectCode, DefectFamily } from './entities/defect-code.entity';

/**
 * Catálogo demo additivo: códigos de defecto GENÉRICOS de una planta EMS (sin
 * nombres reales de cliente/producto). Es el cimiento del Pareto/PPM. Se siembra
 * de forma idempotente al arrancar — igual que GovernanceSeedService — solo si la
 * tabla está vacía, así nunca duplica ni pisa códigos creados a mano.
 */
const SEED_DEFECT_CODES: Array<{
  code: string;
  description: string;
  category: DefectFamily;
  defaultSeverity?: string;
}> = [
  {
    code: 'SOL-COLD',
    description: 'Soldadura fría',
    category: DefectFamily.SOLDER,
    defaultSeverity: 'major',
  },
  {
    code: 'SOL-BRIDGE',
    description: 'Puente de soldadura',
    category: DefectFamily.SOLDER,
    defaultSeverity: 'major',
  },
  {
    code: 'SOL-INSUF',
    description: 'Soldadura insuficiente',
    category: DefectFamily.SOLDER,
    defaultSeverity: 'minor',
  },
  {
    code: 'SOL-TOMB',
    description: 'Tombstone / efecto lápida',
    category: DefectFamily.SOLDER,
    defaultSeverity: 'major',
  },
  {
    code: 'CMP-MISS',
    description: 'Componente faltante',
    category: DefectFamily.COMPONENT,
    defaultSeverity: 'critical',
  },
  {
    code: 'CMP-WRONG',
    description: 'Componente equivocado',
    category: DefectFamily.COMPONENT,
    defaultSeverity: 'critical',
  },
  {
    code: 'CMP-POLAR',
    description: 'Polaridad / orientación invertida',
    category: DefectFamily.COMPONENT,
    defaultSeverity: 'major',
  },
  {
    code: 'CMP-DMG',
    description: 'Componente dañado',
    category: DefectFamily.COMPONENT,
    defaultSeverity: 'major',
  },
  {
    code: 'COS-SCRATCH',
    description: 'Rayón / daño cosmético',
    category: DefectFamily.COSMETIC,
    defaultSeverity: 'minor',
  },
  {
    code: 'COS-LABEL',
    description: 'Etiqueta o marcado incorrecto',
    category: DefectFamily.COSMETIC,
    defaultSeverity: 'minor',
  },
  {
    code: 'FUN-NOPWR',
    description: 'No enciende / sin energía',
    category: DefectFamily.FUNCTIONAL,
    defaultSeverity: 'critical',
  },
  {
    code: 'FUN-TEST',
    description: 'Falla en prueba funcional',
    category: DefectFamily.FUNCTIONAL,
    defaultSeverity: 'major',
  },
  {
    code: 'MEC-FIT',
    description: 'Ajuste / ensamble mecánico',
    category: DefectFamily.MECHANICAL,
    defaultSeverity: 'minor',
  },
  {
    code: 'PRC-DOC',
    description: 'Desviación de documentación / proceso',
    category: DefectFamily.PROCESS,
    defaultSeverity: 'minor',
  },
];

@Injectable()
export class DefectCodesService implements OnModuleInit {
  private readonly logger = new Logger(DefectCodesService.name);

  constructor(
    @InjectRepository(DefectCode)
    private readonly repo: Repository<DefectCode>,
  ) {}

  async onModuleInit() {
    try {
      await this.ensureSeeded();
    } catch (error: any) {
      const msg = String(error?.message ?? '');
      const code = error?.code;
      // La tabla aún no existe (arranque en frío antes del sync) — no es fatal.
      if (
        code === '42P01' ||
        (msg.toLowerCase().includes('relation') &&
          msg.toLowerCase().includes('does not exist')) ||
        msg.toLowerCase().includes('no such table')
      ) {
        this.logger.warn(
          'Catálogo de defectos: tabla aún no disponible, se omite el seed.',
        );
        return;
      }
      this.logger.warn(`Catálogo de defectos: seed omitido (${msg}).`);
    }
  }

  /** Siembra los códigos demo solo si el catálogo está vacío (idempotente). */
  async ensureSeeded(): Promise<{ created: number }> {
    const count = await this.repo.count();
    if (count > 0) return { created: 0 };
    let created = 0;
    for (const c of SEED_DEFECT_CODES) {
      await this.repo.save(this.repo.create({ ...c, active: true }));
      created++;
    }
    this.logger.log(`Catálogo de defectos sembrado: ${created} códigos demo.`);
    return { created };
  }

  /** Lista el catálogo. Por defecto solo activos (los inactivos no se ofrecen). */
  async findAll(includeInactive = false): Promise<DefectCode[]> {
    const qb = this.repo.createQueryBuilder('dc');
    if (!includeInactive) qb.where('dc.active = :a', { a: true });
    qb.orderBy('dc.category', 'ASC').addOrderBy('dc.code', 'ASC');
    return qb.getMany();
  }

  async create(dto: Partial<DefectCode>): Promise<DefectCode> {
    if (!dto.code || !dto.code.trim()) {
      throw new ConflictException('El código es obligatorio.');
    }
    const code = dto.code.trim().toUpperCase();
    const existing = await this.repo.findOne({ where: { code } });
    if (existing) throw new ConflictException(`El código ${code} ya existe.`);
    const entity = this.repo.create({
      code,
      description: (dto.description ?? '').trim() || code,
      category: dto.category ?? DefectFamily.PROCESS,
      defaultSeverity: dto.defaultSeverity ?? null,
      active: dto.active ?? true,
    });
    return this.repo.save(entity);
  }

  async update(id: number, dto: Partial<DefectCode>): Promise<DefectCode> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity)
      throw new NotFoundException('Código de defecto no encontrado.');
    // El código es la clave estable; si se renombra, validar unicidad.
    if (dto.code && dto.code.trim().toUpperCase() !== entity.code) {
      const code = dto.code.trim().toUpperCase();
      const clash = await this.repo.findOne({ where: { code } });
      if (clash) throw new ConflictException(`El código ${code} ya existe.`);
      entity.code = code;
    }
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.category !== undefined) entity.category = dto.category;
    if (dto.defaultSeverity !== undefined)
      entity.defaultSeverity = dto.defaultSeverity;
    if (dto.active !== undefined) entity.active = dto.active;
    return this.repo.save(entity);
  }
}
