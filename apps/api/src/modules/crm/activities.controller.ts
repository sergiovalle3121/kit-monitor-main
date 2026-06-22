import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ActivitiesService } from './services/activities.service';
import { CreateActivityDto, UpdateActivityDto } from './dto/activity.dto';

@ApiTags('CRM · Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crm/activities')
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista actividades (filtros: accountId, opportunityId, status, type).' })
  list(
    @Query('accountId') accountId?: string,
    @Query('opportunityId') opportunityId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.service.list({ accountId, opportunityId, status, type });
  }

  @Get('my-tasks')
  @ApiOperation({ summary: 'Tareas abiertas del usuario (worklist de próximas acciones).' })
  myTasks() {
    return this.service.myTasks();
  }

  @Post()
  @ApiOperation({ summary: 'Registra una actividad o crea una tarea.' })
  create(@Body() dto: CreateActivityDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza una actividad/tarea.' })
  update(@Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Marca una tarea como completada.' })
  complete(@Param('id') id: string, @Body() body: { outcome?: string }) {
    return this.service.complete(id, body?.outcome);
  }
}
