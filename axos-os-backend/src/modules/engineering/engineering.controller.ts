import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { EngineeringService } from './engineering.service';
import { EngineeringDocumentType } from './entities/engineering-document.entity';
import { CreateEngineeringDocumentDto, UpdateEngineeringDocumentDto } from './dto/engineering-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('engineering')
@UseGuards(JwtAuthGuard)
export class EngineeringController {
  constructor(private readonly engineeringService: EngineeringService) {}

  @Get('documents')
  findAll(
    @Query('type') type?: EngineeringDocumentType,
    @Query('buildingId') buildingId?: string,
    @Query('programId') programId?: string,
    @Query('lineId') lineId?: string,
    @Query('model') model?: string,
  ) {
    if (buildingId || programId || lineId || model) {
      return this.engineeringService.findByScope({ buildingId, programId, lineId, model }, type);
    }
    return this.engineeringService.findAll(type);
  }

  @Get('documents/:id')
  findOne(@Param('id') id: string) {
    return this.engineeringService.findOne(id);
  }

  @Post('documents')
  create(@Body() createDto: CreateEngineeringDocumentDto, @Req() req: any) {
    return this.engineeringService.create(createDto, req.user.email);
  }

  @Patch('documents/:id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateEngineeringDocumentDto,
    @Req() req: any,
  ) {
    return this.engineeringService.update(id, updateDto, req.user.email);
  }

  @Delete('documents/:id')
  remove(@Param('id') id: string) {
    return this.engineeringService.remove(id);
  }
}
