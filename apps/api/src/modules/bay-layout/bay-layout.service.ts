import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { BayLayout } from './entities/bay-layout.entity';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { CreateBayLayoutDto } from './dto/create-bay-layout.dto';

@Injectable()
export class BayLayoutService {
  constructor(
    @Inject(getTenantRepositoryToken(BayLayout))
    private readonly repo: TenantScopedRepository<BayLayout>,
  ) {}

  findByModel(model: string): Promise<BayLayout[]> {
    return this.repo.find({
      where: { model },
      order: { bahia: 'ASC', partNumber: 'ASC' },
    });
  }

  create(dto: CreateBayLayoutDto): Promise<BayLayout> {
    const item = this.repo.create(dto);
    return this.repo.save(item);
  }

  async createBulk(dtos: CreateBayLayoutDto[]): Promise<BayLayout[]> {
    const items = this.repo.create(dtos);
    return this.repo.save(items);
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    const item = await this.repo.findOneBy({ id });
    if (!item) throw new NotFoundException(`BayLayout ${id} not found`);
    await this.repo.delete(id);
    return { deleted: true, id };
  }

  async removeByModel(model: string): Promise<{ deleted: number }> {
    const result = await this.repo.delete({ model });
    return { deleted: result.affected ?? 0 };
  }
}
