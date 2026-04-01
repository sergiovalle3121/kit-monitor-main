import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KitException } from './entities/kit-exception.entity';
import { Kit } from '../kits/entities/kit.entity';
import { CreateExceptionDto } from './dto/create-exception.dto';

@Injectable()
export class ExceptionsService {
  constructor(
    @InjectRepository(KitException)
    private readonly repo: Repository<KitException>,
  ) {}

  findByKit(kitId: number): Promise<KitException[]> {
    return this.repo.find({
      where: { kit: { id: kitId } },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<KitException> {
    const item = await this.repo.findOneBy({ id });
    if (!item) throw new NotFoundException(`Exception ${id} not found`);
    return item;
  }

  create(dto: CreateExceptionDto): Promise<KitException> {
    const exception = this.repo.create({
      kit: { id: dto.kitId } as Kit,
      type: dto.type,
      partNumber: dto.partNumber,
      description: dto.description,
    });
    return this.repo.save(exception);
  }

  async resolve(id: number): Promise<KitException> {
    await this.findOne(id);
    await this.repo.update(id, { status: 'resolved', resolvedAt: new Date() });
    return this.findOne(id);
  }
}
