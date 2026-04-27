import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Query,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { CreateVisualAidDto } from './dto/create-visual-aid.dto';
import { UpdateVisualAidDto } from './dto/update-visual-aid.dto';
import { VisualAidsService } from './visual-aids.service';

@Controller('visual-aids')
export class VisualAidsController {
  constructor(private readonly service: VisualAidsService) {}

  @Get()
  findAll(@Query('model') model?: string, @Query('programId') programId?: string) {
    return this.service.findAll(model, programId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) => {
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.mimetype)) {
        cb(new BadRequestException('Solo se permiten PDF o imágenes (JPG, PNG, WEBP)'), false);
        return;
      }
      cb(null, true);
    },
    limits: { fileSize: 12 * 1024 * 1024 },
  }))
  create(@Body() dto: CreateVisualAidDto, @UploadedFile() file?: any) {
    if (!file?.buffer) {
      throw new BadRequestException('PDF es obligatorio');
    }
    const normalized = {
      ...dto,
      isActive: String(dto.isActive ?? 'true') !== 'false',
      annotations: dto.annotations ? JSON.parse(dto.annotations) : null,
    };
    const extension = extname(file.originalname || '') || '.pdf';
    const filename = `va-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    return this.service.create(normalized, filename, file.buffer);
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
  async serveFile(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = filename.replace(/\//g, '');
    const item = await this.service.findByFilename(safeName);
    if (!item?.pdfData) {
      return res.status(404).json({ message: 'Archivo no encontrado' });
    }

    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', "frame-ancestors *");
    const mime = item.pdfUrl.endsWith('.pdf') ? 'application/pdf' : 'image/png';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    return res.send(item.pdfData);
  }
}
