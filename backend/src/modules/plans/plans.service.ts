import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

// Stub service — replace with TypeORM repository when DB is integrated
@Injectable()
export class PlansService {
  findAll() {
    return [];
  }

  findOne(id: number) {
    throw new NotFoundException(`Plan ${id} not found`);
  }

  create(dto: CreatePlanDto) {
    return { id: 0, ...dto, status: 'pending', createdAt: new Date() };
  }

  update(id: number, dto: UpdatePlanDto) {
    return { id, ...dto };
  }

  remove(id: number) {
    return { deleted: true, id };
  }
}
