import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '../../../common/entities/tenant-base.entity';

/**
 * Fiscal / SAT configuration for issuing the Mexican Carta Porte (CFDI 4.0 +
 * complemento Carta Porte 3.1). One row per tenant/plant. Holds the issuer
 * (emisor) fiscal identity, the autotransporte permit/config and the default SAT
 * catalog keys — everything the XML needs that isn't on the shipment itself.
 * The actual PAC timbrado (CSD sello + TimbreFiscalDigital) is an external step.
 */
@Entity('outbound_fiscal_profiles')
@Index('idx_outbound_fiscal_scope', ['tenant_id', 'plant_id'])
export class OutboundFiscalProfile extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Emisor (issuer) ─────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 13, nullable: true, name: 'emisor_rfc' })
  emisorRfc: string | null;

  @Column({
    type: 'varchar',
    length: 254,
    nullable: true,
    name: 'emisor_nombre',
  })
  emisorNombre: string | null;

  @Column({
    type: 'varchar',
    length: 5,
    nullable: true,
    name: 'regimen_fiscal',
  })
  regimenFiscal: string | null; // SAT c_RegimenFiscal (e.g. 601)

  @Column({
    type: 'varchar',
    length: 5,
    nullable: true,
    name: 'lugar_expedicion',
  })
  lugarExpedicion: string | null; // CP de expedición

  @Column({
    type: 'varchar',
    length: 254,
    nullable: true,
    name: 'origen_domicilio',
  })
  origenDomicilio: string | null;

  // ── Autotransporte (default) ────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 8, nullable: true, name: 'perm_sct' })
  permSct: string | null; // SAT c_TipoPermiso (e.g. TPAF01)

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    name: 'num_permiso_sct',
  })
  numPermisoSct: string | null;

  @Column({
    type: 'varchar',
    length: 8,
    nullable: true,
    name: 'config_vehicular',
  })
  configVehicular: string | null; // SAT c_ConfigAutotransporte (e.g. C2)

  @Column({
    type: 'varchar',
    length: 254,
    nullable: true,
    name: 'asegura_resp_civil',
  })
  aseguraRespCivil: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    name: 'poliza_resp_civil',
  })
  polizaRespCivil: string | null;

  // ── Mercancías (default SAT product key) ────────────────────────────────────
  @Column({
    type: 'varchar',
    length: 8,
    nullable: true,
    name: 'clave_prod_serv_default',
  })
  claveProdServDefault: string | null; // c_ClaveProdServ por mercancía
}
