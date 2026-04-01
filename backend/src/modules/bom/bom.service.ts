import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBomItemDto } from './dto/create-bom-item.dto';
import { UpdateBomItemDto } from './dto/update-bom-item.dto';

// Stub service — replace with TypeORM repository when DB is integrated
@Injectable()
export class BomService {
  findAll(model?: string) {
    return []; // filter by model when wired to DB
  }

  findOne(id: number) {
    throw new NotFoundException(`BomItem ${id} not found`);
  }

  create(dto: CreateBomItemDto) {
    return { id: 0, unit: 'EA', ...dto };
  }

  update(id: number, dto: UpdateBomItemDto) {
    return { id, ...dto };
  }

  remove(id: number) {
    return { deleted: true, id };
  }
}
