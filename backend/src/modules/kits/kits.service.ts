import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateKitDto } from './dto/create-kit.dto';
import { UpdateKitStatusDto } from './dto/update-kit-status.dto';

// Stub service — replace with TypeORM repository when DB is integrated
@Injectable()
export class KitsService {
  findAll() {
    return [];
  }

  findOne(id: number) {
    throw new NotFoundException(`Kit ${id} not found`);
  }

  create(dto: CreateKitDto) {
    return { id: 0, ...dto, status: 'prepared', createdAt: new Date() };
  }

  updateStatus(id: number, dto: UpdateKitStatusDto) {
    return { id, ...dto };
  }

  remove(id: number) {
    return { deleted: true, id };
  }
}
