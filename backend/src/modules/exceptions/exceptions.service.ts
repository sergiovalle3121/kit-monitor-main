import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateExceptionDto } from './dto/create-exception.dto';

@Injectable()
export class ExceptionsService {
  findByKit(kitId: number) {
    return [];
  }

  findOne(id: number) {
    throw new NotFoundException(`Exception ${id} not found`);
  }

  create(dto: CreateExceptionDto) {
    return { id: 0, ...dto, status: 'open', createdAt: new Date() };
  }

  resolve(id: number) {
    return { id, status: 'resolved', resolvedAt: new Date() };
  }
}
