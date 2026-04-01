import { 
  Controller, Get, Post, Put, Delete, Body, Param 
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { KitsService } from './kits.service';
import { CreateKitDto } from './dto/create-kit.dto';
import { UpdateKitDto } from './dto/update-kit.dto';

@ApiTags('kits')
@Controller('kits')
export class KitsController {
  constructor(private readonly kitsService: KitsService) {}

  @Post()
  create(@Body() createKitDto: CreateKitDto) {
    return this.kitsService.create(createKitDto);
  }

  @Get()
  findAll() {
    return this.kitsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.kitsService.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateKitDto: UpdateKitDto) {
    return this.kitsService.update(+id, updateKitDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.kitsService.remove(+id);
  }
}
