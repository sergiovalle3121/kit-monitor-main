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
import { ModelsService } from './models.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { ApiTags, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';

@ApiTags('Models')
@Controller('models')
@UseInterceptors(ResponseInterceptor)
@ApiBearerAuth()
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Post()
  @ApiResponse({ status: 201, description: 'Model created successfully' })
  async create(@Body() createModelDto: CreateModelDto) {
    return this.modelsService.create(createModelDto);
  }

  @Get()
  @ApiResponse({ status: 200, description: 'List of all models' })
  async findAll() {
    return this.modelsService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Model details' })
  async findOne(@Param('id') id: string) {
    return this.modelsService.findOne(+id);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, description: 'Model updated successfully' })
  async update(@Param('id') id: string, @Body() updateModelDto: UpdateModelDto) {
    return this.modelsService.update(+id, updateModelDto);
  }

  @Delete(':id')
  @ApiResponse({ status: 200, description: 'Model deleted successfully' })
  async remove(@Param('id') id: string) {
    return this.modelsService.remove(+id);
  }
}