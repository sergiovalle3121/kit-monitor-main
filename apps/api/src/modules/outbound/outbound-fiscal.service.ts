import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { OutboundFiscalProfile } from './entities/outbound-fiscal-profile.entity';
import { UpsertFiscalProfileDto } from './dto/outbound.dto';
import type { FiscalProfileData } from './carta-porte-xml';

/** The tenant's fiscal/SAT profile for issuing the Carta Porte. One row per scope. */
@Injectable()
export class OutboundFiscalService {
  constructor(
    @InjectRepository(OutboundFiscalProfile)
    private readonly repo: Repository<OutboundFiscalProfile>,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<OutboundFiscalProfile>,
    alias: string,
  ): SelectQueryBuilder<OutboundFiscalProfile> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  async get(): Promise<OutboundFiscalProfile | null> {
    const qb = this.repo.createQueryBuilder('f');
    this.applyScope(qb, 'f');
    return (await qb.getOne()) ?? null;
  }

  /** Always returns a usable shape for the XML builder (nulls when unconfigured). */
  async getData(): Promise<FiscalProfileData> {
    const p = await this.get();
    return {
      emisorRfc: p?.emisorRfc ?? null,
      emisorNombre: p?.emisorNombre ?? null,
      regimenFiscal: p?.regimenFiscal ?? null,
      lugarExpedicion: p?.lugarExpedicion ?? null,
      origenDomicilio: p?.origenDomicilio ?? null,
      permSct: p?.permSct ?? null,
      numPermisoSct: p?.numPermisoSct ?? null,
      configVehicular: p?.configVehicular ?? null,
      aseguraRespCivil: p?.aseguraRespCivil ?? null,
      polizaRespCivil: p?.polizaRespCivil ?? null,
      claveProdServDefault: p?.claveProdServDefault ?? null,
    };
  }

  async upsert(dto: UpsertFiscalProfileDto): Promise<OutboundFiscalProfile> {
    let p = await this.get();
    if (!p) {
      p = this.repo.create({
        tenant_id: this.tenantCtx.getTenantId(),
        plant_id: this.tenantCtx.getPlantId(),
        created_by: this.tenantCtx.getUserEmail(),
      });
    }
    Object.assign(p, {
      ...(dto.emisorRfc !== undefined && { emisorRfc: dto.emisorRfc || null }),
      ...(dto.emisorNombre !== undefined && {
        emisorNombre: dto.emisorNombre || null,
      }),
      ...(dto.regimenFiscal !== undefined && {
        regimenFiscal: dto.regimenFiscal || null,
      }),
      ...(dto.lugarExpedicion !== undefined && {
        lugarExpedicion: dto.lugarExpedicion || null,
      }),
      ...(dto.origenDomicilio !== undefined && {
        origenDomicilio: dto.origenDomicilio || null,
      }),
      ...(dto.permSct !== undefined && { permSct: dto.permSct || null }),
      ...(dto.numPermisoSct !== undefined && {
        numPermisoSct: dto.numPermisoSct || null,
      }),
      ...(dto.configVehicular !== undefined && {
        configVehicular: dto.configVehicular || null,
      }),
      ...(dto.aseguraRespCivil !== undefined && {
        aseguraRespCivil: dto.aseguraRespCivil || null,
      }),
      ...(dto.polizaRespCivil !== undefined && {
        polizaRespCivil: dto.polizaRespCivil || null,
      }),
      ...(dto.claveProdServDefault !== undefined && {
        claveProdServDefault: dto.claveProdServDefault || null,
      }),
    });
    return this.repo.save(p);
  }
}
