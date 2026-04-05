import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateVisualAidDto } from './dto/create-visual-aid.dto';
import { UpdateVisualAidDto } from './dto/update-visual-aid.dto';
import { VisualAidsService } from './visual-aids.service';

@UseGuards(JwtAuthGuard)
@Controller('visual-aids')
export class VisualAidsController {
  constructor(private readonly service: VisualAidsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateVisualAidDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVisualAidDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get('file/:filename')
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    const baseDir = resolve(process.cwd(), 'uploads', 'visual-aids');
    const safeName = filename.replace(/\//g, '');
    const fullPath = join(baseDir, safeName);

    if (!existsSync(fullPath)) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    return res.sendFile(fullPath);
  }
}
