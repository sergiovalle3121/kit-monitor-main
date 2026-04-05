import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { CreateVisualAidDto } from './dto/create-visual-aid.dto';
import { UpdateVisualAidDto } from './dto/update-visual-aid.dto';
import { VisualAidsService } from './visual-aids.service';

@Controller('visual-aids')
export class VisualAidsController {
  constructor(private readonly service: VisualAidsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const destination = '/app/uploads/visual-aids';
        mkdirSync(destination, { recursive: true });
        cb(null, destination);
      },
      filename: (_req, file, cb) => {
        const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const extension = extname(file.originalname) || '.pdf';
        cb(null, `va-${suffix}${extension}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (file.mimetype !== 'application/pdf') {
        cb(new BadRequestException('Solo se permite archivo PDF'), false);
        return;
      }
      cb(null, true);
    },
    limits: { fileSize: 12 * 1024 * 1024 },
  }))
  create(@Body() dto: CreateVisualAidDto, @UploadedFile() file?: any) {
    if (!file?.filename) {
      throw new BadRequestException('PDF es obligatorio');
    }
    const normalized = {
      ...dto,
      isActive: String(dto.isActive ?? 'true') !== 'false',
    };
    return this.service.create(normalized, file.filename);
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
    const baseDir = resolve('/app/uploads/visual-aids');
    const safeName = filename.replace(/\//g, '');
    const fullPath = join(baseDir, safeName);

    if (!existsSync(fullPath)) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', "frame-ancestors *");

    return res.sendFile(fullPath);
  }
}
