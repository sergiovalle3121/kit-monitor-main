import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseInterceptors,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ApiTags, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';

@ApiTags('Reports')
@Controller('reports')
@UseInterceptors(ResponseInterceptor)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiResponse({ status: 201, description: 'Report created successfully' })
  async create(@Body() createReportDto: CreateReportDto) {
    return this.reportsService.create(createReportDto);
  }

  @Get()
  @ApiResponse({ status: 200, description: 'List of all reports' })
  async findAll() {
    return this.reportsService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Report details' })
  async findOne(@Param('id') id: string) {
    return this.reportsService.findOne(+id);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, description: 'Report updated successfully' })
  async update(@Param('id') id: string, @Body() updateReportDto: UpdateReportDto) {
    return this.reportsService.update(+id, updateReportDto);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Report deleted successfully' })
  async remove(@Param('id') id: string) {
    return this.reportsService.remove(+id);
  }
}