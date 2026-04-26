import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { NcrService } from './ncr.service';
import { NcrStatus } from './entities/ncr.entity';
import { CreateNcrDto, UpdateNcrStatusDto } from './dto/ncr.dto';

@ApiTags('ncr')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('ncr')
export class NcrController {
  constructor(private readonly ncrService: NcrService) {}

  @Get()
  @RequirePermissions('quality:read')
  @ApiOperation({ summary: 'List NCRs for the current tenant' })
  @ApiQuery({ name: 'partNumber', required: false })
  @ApiQuery({ name: 'status', required: false, enum: NcrStatus })
  @ApiQuery({ name: 'workOrder', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'sourceType', required: false })
  findAll(
    @Query('partNumber') partNumber?: string,
    @Query('status') status?: string,
    @Query('workOrder') workOrder?: string,
    @Query('severity') severity?: string,
    @Query('sourceType') sourceType?: string,
  ) {
    return this.ncrService.findAll({
      partNumber,
      status,
      workOrder,
      severity,
      sourceType,
    });
  }

  @Get(':id')
  @RequirePermissions('quality:read')
  @ApiOperation({
    summary: 'Get a single NCR with related hold and quarantine data',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ncrService.findOne(id);
  }

  @Post()
  @RequirePermissions('quality:write')
  @ApiOperation({ summary: 'Open a new Non-Conformance Report' })
  create(@Body() dto: CreateNcrDto) {
    return this.ncrService.create(dto);
  }

  @Patch(':id/status')
  @RequirePermissions('quality:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update NCR status (contain, disposition, close)' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNcrStatusDto,
  ) {
    return this.ncrService.updateStatus(
      id,
      dto.status as NcrStatus,
      dto.dispositionNotes,
    );
  }
}
