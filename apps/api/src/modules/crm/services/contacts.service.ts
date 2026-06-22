import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmContact } from '../entities/crm-contact.entity';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { applyCrmScope, crmScopeStamp } from './crm-scope';
import { CreateContactDto, UpdateContactDto } from '../dto/contact.dto';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(CrmContact)
    private readonly repo: Repository<CrmContact>,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async create(dto: CreateContactDto): Promise<CrmContact> {
    // The first contact on an account is the primary by default.
    let isPrimary = dto.isPrimary ?? false;
    if (!isPrimary) {
      const count = await applyCrmScope(this.repo.createQueryBuilder('c'), 'c', this.tenantCtx)
        .andWhere('c.account_id = :a', { a: dto.accountId })
        .getCount();
      if (count === 0) isPrimary = true;
    }
    if (isPrimary) await this.clearPrimary(dto.accountId);
    const entity = this.repo.create({
      account_id: dto.accountId,
      firstName: dto.firstName,
      lastName: dto.lastName ?? null,
      title: dto.title ?? null,
      department: dto.department ?? null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      mobile: dto.mobile ?? null,
      isPrimary,
      buyingRole: dto.buyingRole ?? null,
      linkedin: dto.linkedin ?? null,
      status: 'ACTIVE',
      notes: dto.notes ?? null,
      ...crmScopeStamp(this.tenantCtx),
    });
    return this.repo.save(entity);
  }

  async listByAccount(accountId: string): Promise<CrmContact[]> {
    return applyCrmScope(this.repo.createQueryBuilder('c'), 'c', this.tenantCtx)
      .andWhere('c.account_id = :a', { a: accountId })
      .orderBy('c.is_primary', 'DESC')
      .addOrderBy('c.first_name', 'ASC')
      .getMany();
  }

  async update(id: string, dto: UpdateContactDto): Promise<CrmContact> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Contacto no encontrado.');
    if (dto.isPrimary) await this.clearPrimary(c.account_id);
    for (const k of [
      'firstName', 'lastName', 'title', 'department', 'email', 'phone',
      'mobile', 'isPrimary', 'buyingRole', 'linkedin', 'status', 'notes',
    ] as const) {
      if (dto[k] !== undefined) (c as unknown as Record<string, unknown>)[k] = dto[k];
    }
    return this.repo.save(c);
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.repo.softDelete(id);
    return { ok: true };
  }

  /** Demote any existing primary on the account so only one stays flagged. */
  private async clearPrimary(accountId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(CrmContact)
      .set({ isPrimary: false })
      .where('account_id = :a', { a: accountId })
      .execute();
  }
}
