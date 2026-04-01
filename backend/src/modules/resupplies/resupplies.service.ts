import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateResupplyDto } from './dto/create-resupply.dto';
import { DeliverResupplyDto } from './dto/deliver-resupply.dto';

@Injectable()
export class ResuppliesService {
  findByKit(kitId: number) {
    return [];
  }

  findOne(id: number) {
    throw new NotFoundException(`Resupply ${id} not found`);
  }

  create(dto: CreateResupplyDto) {
    return { id: 0, ...dto, status: 'requested', requestedAt: new Date() };
  }

  deliver(id: number, dto: DeliverResupplyDto) {
    return { id, ...dto, status: 'delivered', deliveredAt: new Date() };
  }
}
