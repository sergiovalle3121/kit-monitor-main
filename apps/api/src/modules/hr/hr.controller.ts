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
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { HrService } from './hr.service';
import {
  AdvanceCandidateDto,
  CreateAbsenceDto,
  CreateCandidateDto,
  CreateEmployeeDto,
  CreateRequisitionDto,
  CreateReviewDto,
  TerminateEmployeeDto,
  TransitionRequisitionDto,
  UpdateEmployeeDto,
  UpdateRequisitionDto,
  UpdateReviewDto,
} from './dto/hr.dto';

/**
 * HR / Capital Humano — workforce master + talent acquisition + performance +
 * the people-analytics cockpit. Same access posture as People/EHS: any
 * authenticated user can read/capture (RH is participative); admins bypass scope.
 */
@ApiTags('HR')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr')
export class HrController {
  constructor(private readonly service: HrService) {}

  // ── employees ──────────────────────────────────────────────────────────────
  @Get('employees')
  @ApiOperation({ summary: 'Plantilla de colaboradores (con filtros).' })
  listEmployees(
    @Query('status') status?: string,
    @Query('area') area?: string,
    @Query('shift') shift?: string,
    @Query('laborType') laborType?: string,
    @Query('q') q?: string,
  ) {
    return this.service.listEmployees({ status, area, shift, laborType, q });
  }

  @Get('employees/:id')
  @ApiOperation({ summary: 'Detalle de un colaborador.' })
  getEmployee(@Param('id') id: string) {
    return this.service.getEmployee(id);
  }

  @Post('employees')
  @ApiOperation({ summary: 'Alta de colaborador (folio EMP-).' })
  @RequirePermissions('ADMIN_ACCESS')
  createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.service.createEmployee(dto);
  }

  @Patch('employees/:id')
  @ApiOperation({ summary: 'Actualiza datos del colaborador.' })
  @RequirePermissions('ADMIN_ACCESS')
  updateEmployee(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.service.updateEmployee(id, dto);
  }

  @Post('employees/:id/terminate')
  @ApiOperation({ summary: 'Baja del colaborador (voluntaria / involuntaria).' })
  @RequirePermissions('ADMIN_ACCESS')
  terminate(@Param('id') id: string, @Body() dto: TerminateEmployeeDto) {
    return this.service.terminateEmployee(id, dto);
  }

  // ── requisitions ────────────────────────────────────────────────────────────
  @Get('requisitions')
  @ApiOperation({ summary: 'Requisiciones / vacantes.' })
  listRequisitions(@Query('status') status?: string, @Query('area') area?: string) {
    return this.service.listRequisitions({ status, area });
  }

  @Get('requisitions/:id')
  @ApiOperation({ summary: 'Detalle de requisición.' })
  getRequisition(@Param('id') id: string) {
    return this.service.getRequisition(id);
  }

  @Post('requisitions')
  @ApiOperation({ summary: 'Abre una requisición (folio VAC-).' })
  @RequirePermissions('ADMIN_ACCESS')
  createRequisition(@Body() dto: CreateRequisitionDto) {
    return this.service.createRequisition(dto);
  }

  @Patch('requisitions/:id')
  @ApiOperation({ summary: 'Actualiza una requisición.' })
  @RequirePermissions('ADMIN_ACCESS')
  updateRequisition(@Param('id') id: string, @Body() dto: UpdateRequisitionDto) {
    return this.service.updateRequisition(id, dto);
  }

  @Post('requisitions/:id/transition')
  @ApiOperation({ summary: 'Avanza la requisición por su máquina de estados.' })
  @RequirePermissions('ADMIN_ACCESS')
  transitionRequisition(@Param('id') id: string, @Body() dto: TransitionRequisitionDto) {
    return this.service.transitionRequisition(id, dto);
  }

  // ── candidates ──────────────────────────────────────────────────────────────
  @Get('candidates')
  @ApiOperation({ summary: 'Pipeline de candidatos.' })
  listCandidates(@Query('requisitionId') requisitionId?: string, @Query('stage') stage?: string) {
    return this.service.listCandidates({ requisitionId, stage });
  }

  @Post('candidates')
  @ApiOperation({ summary: 'Registra un candidato en el pipeline.' })
  @RequirePermissions('ADMIN_ACCESS')
  createCandidate(@Body() dto: CreateCandidateDto) {
    return this.service.createCandidate(dto);
  }

  @Post('candidates/:id/advance')
  @ApiOperation({ summary: 'Mueve al candidato de etapa (puede contratar).' })
  @RequirePermissions('ADMIN_ACCESS')
  advanceCandidate(@Param('id') id: string, @Body() dto: AdvanceCandidateDto) {
    return this.service.advanceCandidate(id, dto);
  }

  // ── reviews ─────────────────────────────────────────────────────────────────
  @Get('reviews')
  @ApiOperation({ summary: 'Evaluaciones de desempeño.' })
  listReviews(@Query('period') period?: string, @Query('employeeId') employeeId?: string) {
    return this.service.listReviews({ period, employeeId });
  }

  @Get('reviews/:id')
  @ApiOperation({ summary: 'Detalle de evaluación.' })
  getReview(@Param('id') id: string) {
    return this.service.getReview(id);
  }

  @Post('reviews')
  @ApiOperation({ summary: 'Crea una evaluación (folio EVAL-).' })
  @RequirePermissions('ADMIN_ACCESS')
  createReview(@Body() dto: CreateReviewDto) {
    return this.service.createReview(dto);
  }

  @Patch('reviews/:id')
  @ApiOperation({ summary: 'Actualiza / calibra la evaluación (recalcula 9-box).' })
  @RequirePermissions('ADMIN_ACCESS')
  updateReview(@Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.service.updateReview(id, dto);
  }

  // ── absences ────────────────────────────────────────────────────────────────
  @Get('absences')
  @ApiOperation({ summary: 'Eventos de asistencia / ausentismo.' })
  listAbsences(@Query('employeeId') employeeId?: string, @Query('type') type?: string) {
    return this.service.listAbsences({ employeeId, type });
  }

  @Post('absences')
  @ApiOperation({ summary: 'Registra una ausencia / retardo.' })
  @RequirePermissions('ADMIN_ACCESS')
  createAbsence(@Body() dto: CreateAbsenceDto) {
    return this.service.createAbsence(dto);
  }

  // ── analytics (people analytics cockpit) ─────────────────────────────────────
  @Get('analytics/overview')
  @ApiOperation({ summary: 'KPIs de fuerza laboral: headcount, rotación, ausentismo.' })
  overview() {
    return this.service.workforceOverview();
  }

  @Get('analytics/attrition')
  @ApiOperation({ summary: 'Análisis de rotación por área/turno + tendencia.' })
  attrition() {
    return this.service.attritionAnalysis();
  }

  @Get('analytics/staffing-risk')
  @ApiOperation({ summary: 'Riesgo de staffing por área/turno (HR → producción).' })
  staffingRisk() {
    return this.service.staffingRisk();
  }

  @Get('analytics/recruiting')
  @ApiOperation({ summary: 'Embudo de reclutamiento y time-to-fill.' })
  recruiting() {
    return this.service.recruitingFunnel();
  }

  @Get('analytics/nine-box')
  @ApiOperation({ summary: 'Matriz 9-box (desempeño × potencial).' })
  nineBox(@Query('period') period?: string) {
    return this.service.nineBox(period);
  }

  @Get('analytics/flight-risk')
  @ApiOperation({ summary: 'Riesgo de rotación por colaborador (explicable).' })
  flightRisk() {
    return this.service.flightRisk();
  }

  @Get('analytics/labor-cost')
  @ApiOperation({ summary: 'Costo de mano de obra mensual (directo/indirecto).' })
  laborCost() {
    return this.service.laborCost();
  }
}
