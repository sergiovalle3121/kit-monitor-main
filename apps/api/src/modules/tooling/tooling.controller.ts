import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ToolingService } from './tooling.service';
import {
  CreateToolDto,
  RecordUsageDto,
  SetToolStatusDto,
} from './dto/tooling.dto';

@ApiTags('Tooling')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tooling')
export class ToolingController {
  constructor(private readonly service: ToolingService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs de herramentales: vida consumida, EOL, mant.' })
  kpis() {
    return this.service.kpis();
  }

  @Get()
  @ApiOperation({ summary: 'Lista herramentales (con vida derivada).' })
  list(@Query('status') status?: string, @Query('type') type?: string) {
    return this.service.list({ status, type });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un herramental.' })
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Da de alta un herramental (folio TL-).' })
  create(@Body() dto: CreateToolDto) {
    return this.service.create(dto);
  }

  @Post(':id/usage')
  @ApiOperation({ summary: 'Registra disparos de uso (suma a la vida).' })
  recordUsage(@Param('id') id: string, @Body() dto: RecordUsageDto) {
    return this.service.recordUsage(id, dto);
  }

  @Post(':id/status')
  @ApiOperation({ summary: 'Cambia el estado del herramental.' })
  setStatus(@Param('id') id: string, @Body() dto: SetToolStatusDto) {
    return this.service.setStatus(id, dto);
  }
}
