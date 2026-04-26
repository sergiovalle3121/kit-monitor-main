import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, ParseIntPipe,
  UseInterceptors, UploadedFile, BadRequestException, UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BomService } from './bom.service';
import { CreateBomItemDto } from './dto/create-bom-item.dto';
import { UpdateBomItemDto } from './dto/update-bom-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('bom')
export class BomController {
  constructor(private readonly bomService: BomService) {}

  @Get()
  findAll(@Query('model') model?: string, @Query('programId') programId?: string) {
    return this.bomService.findAll(model, programId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bomService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBomItemDto) {
    return this.bomService.create(dto);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importXlsx(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file uploaded');
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx') throw new BadRequestException('Only .xlsx files are accepted');
    return this.bomService.importFromBuffer(file.buffer);
  }

  @Post('catalog/import')
  @UseInterceptors(FileInterceptor('file'))
  async importKanbanCatalog(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file uploaded');
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx') throw new BadRequestException('Only .xlsx files are accepted');
    return this.bomService.syncCatalogFromKanban(file.buffer);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBomItemDto) {
    return this.bomService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bomService.remove(id);
  }
}
