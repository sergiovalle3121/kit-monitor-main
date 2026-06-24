import {
  Controller, Get, Post, Patch, Delete, Put,
  Param, Body, Query, ParseIntPipe,
  UseInterceptors, UploadedFile, BadRequestException, UseGuards,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BomService } from './bom.service';
import { CreateBomItemDto } from './dto/create-bom-item.dto';
import { UpdateBomItemDto } from './dto/update-bom-item.dto';
import { CreateBomHeaderDto, CreateBomComponentDto } from './dto/create-bom.dto';
import { UpdateBomHeaderDto, UpdateBomComponentDto } from './dto/update-bom.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { BomStatus } from './entities/bom-header.entity';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('bom')
export class BomController {
  constructor(private readonly bomService: BomService) {}

  // ==================== LEGACY BOM ITEM ENDPOINTS ====================

  @Get()
  findAll(@Query('model') model?: string, @Query('programId') programId?: string) {
    return this.bomService.findAll(model, programId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bomService.findOne(id);
  }

  @Post()
  @RequirePermissions('engineering:write')
  create(@Body() dto: CreateBomItemDto) {
    return this.bomService.create(dto);
  }

  @Post('import')
  @RequirePermissions('engineering:write')
  @UseInterceptors(FileInterceptor('file'))
  async importXlsx(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file uploaded');
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx') throw new BadRequestException('Only .xlsx files are accepted');
    return this.bomService.importFromBuffer(file.buffer);
  }

  @Post('catalog/import')
  @RequirePermissions('engineering:write')
  @UseInterceptors(FileInterceptor('file'))
  async importKanbanCatalog(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file uploaded');
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx') throw new BadRequestException('Only .xlsx files are accepted');
    return this.bomService.syncCatalogFromKanban(file.buffer);
  }

  @Patch(':id')
  @RequirePermissions('engineering:write')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBomItemDto) {
    return this.bomService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('engineering:write')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bomService.remove(id);
  }

  // ==================== SAP-STYLE BOM HEADER & COMPONENTS ENDPOINTS ====================

  @Get('headers')
  findAllBomHeaders(
    @Query('model') model?: string, 
    @Query('status') status?: BomStatus
  ) {
    return this.bomService.findAllBomHeaders(model, status);
  }

  @Get('headers/:id')
  findBomHeaderById(@Param('id', ParseIntPipe) id: number) {
    return this.bomService.findBomHeaderById(id);
  }

  @Get('headers/:id/tree')
  getBomTreeStructure(@Param('id', ParseIntPipe) id: number) {
    return this.bomService.getBomTreeStructure(id);
  }

  @Post('headers')
  @RequirePermissions('engineering:write')
  createBomWithComponents(@Body() dto: CreateBomHeaderDto) {
    return this.bomService.createBomWithComponents(dto);
  }

  @Patch('headers/:id')
  @RequirePermissions('engineering:write')
  updateBomHeader(
    @Param('id', ParseIntPipe) id: number, 
    @Body() dto: UpdateBomHeaderDto
  ) {
    return this.bomService.updateBomHeader(id, dto);
  }

  @Post('headers/:id/components')
  @RequirePermissions('engineering:write')
  addComponentToBom(
    @Param('id', ParseIntPipe) id: number, 
    @Body() dto: CreateBomComponentDto
  ) {
    return this.bomService.addComponentToBom(id, dto);
  }

  @Patch('headers/:id/components/:componentId')
  @RequirePermissions('engineering:write')
  updateComponent(
    @Param('id', ParseIntPipe) id: number,
    @Param('componentId', ParseIntPipe) componentId: number,
    @Body() dto: UpdateBomComponentDto
  ) {
    return this.bomService.updateComponent(id, componentId, dto);
  }

  @Delete('headers/:id/components/:componentId')
  @RequirePermissions('engineering:write')
  removeComponentFromBom(
    @Param('id', ParseIntPipe) id: number,
    @Param('componentId', ParseIntPipe) componentId: number
  ) {
    return this.bomService.removeComponentFromBom(id, componentId);
  }

  @Post('headers/:id/approve')
  @RequirePermissions('engineering:write')
  approveBom(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-user-id') approvedBy: string
  ) {
    return this.bomService.approveBom(id, approvedBy || 'System');
  }

  @Post('headers/:id/activate')
  @RequirePermissions('engineering:write')
  activateBom(@Param('id', ParseIntPipe) id: number) {
    return this.bomService.activateBom(id);
  }
}
