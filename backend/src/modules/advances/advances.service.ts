import { Injectable } from '@nestjs/common';
import { CreateAdvanceDto } from './dto/create-advance.dto';

@Injectable()
export class AdvancesService {
  findByKit(kitId: number) {
    return [];
  }

  create(dto: CreateAdvanceDto) {
    return { id: 0, ...dto, registeredAt: new Date() };
  }
}
