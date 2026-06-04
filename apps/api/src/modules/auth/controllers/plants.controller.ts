import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermission } from '../decorators/permissions.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plant } from '../entities/plant.entity';
import { CreatePlantDto, UpdatePlantDto } from '../dto/plant.dto';

/**
 * PlantsController - CRUD endpoints for managing plants.
 * 
 * All endpoints are protected with JWT authentication.
 * Read operations require 'settings:read' permission.
 * Write operations require 'settings:write' permission.
 */
@Controller('api/plants')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PlantsController {
  constructor(
    @InjectRepository(Plant)
    private readonly plantRepository: Repository<Plant>,
  ) {}

  /**
   * GET /api/plants?tenantId=xxx - List all plants for a tenant
   */
  @Get()
  @RequirePermission('settings', 'read')
  async getPlants(@Query('tenantId', ParseUUIDPipe) tenantId: string) {
    return await this.plantRepository.find({
      where: { tenantId },
      order: { name: 'ASC' },
    });
  }

  /**
   * GET /api/plants/:id - Get a specific plant by ID
   */
  @Get(':id')
  @RequirePermission('settings', 'read')
  async getPlant(@Param('id', ParseUUIDPipe) id: string) {
    return await this.plantRepository.findOne({ where: { id } });
  }

  /**
   * POST /api/plants - Create a new plant
   */
  @Post()
  @RequirePermission('settings', 'write')
  async createPlant(@Body() body: CreatePlantDto) {
    const plant = this.plantRepository.create({
      name: body.name,
      location: body.location,
      tenantId: body.tenantId,
      isActive: true,
    });
    return await this.plantRepository.save(plant);
  }

  /**
   * PUT /api/plants/:id - Update an existing plant
   */
  @Put(':id')
  @RequirePermission('settings', 'write')
  async updatePlant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePlantDto,
  ) {
    await this.plantRepository.update(id, body);
    return await this.plantRepository.findOne({ where: { id } });
  }

  /**
   * DELETE /api/plants/:id - Soft delete a plant (set isActive to false)
   */
  @Delete(':id')
  @RequirePermission('settings', 'write')
  async deletePlant(@Param('id', ParseUUIDPipe) id: string) {
    await this.plantRepository.update(id, { isActive: false });
    return { message: 'Plant deactivated successfully' };
  }
}
