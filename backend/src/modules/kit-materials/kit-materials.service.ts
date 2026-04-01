import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateKitMaterialDto } from './dto/create-kit-material.dto';

@Injectable()
export class KitMaterialsService {
  findByKit(kitId: number) {
    return [];
  }

  findOne(id: number) {
    throw new NotFoundException(`KitMaterial ${id} not found`);
  }

  create(dto: CreateKitMaterialDto) {
    return { id: 0, unit: 'EA', ...dto };
  }

  remove(id: number) {
    return { deleted: true, id };
  }
}
