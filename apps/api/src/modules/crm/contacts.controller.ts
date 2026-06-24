import {
  Body,
  Controller,
  Delete,
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
import { ContactsService } from './services/contacts.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@ApiTags('CRM · Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('crm/contacts')
export class ContactsController {
  constructor(private readonly service: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'Contactos de una cuenta (?accountId=).' })
  list(@Query('accountId') accountId: string) {
    return this.service.listByAccount(accountId);
  }

  @Post()
  @RequirePermissions('sales:write')
  @ApiOperation({ summary: 'Agrega un contacto a una cuenta.' })
  create(@Body() dto: CreateContactDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('sales:write')
  @ApiOperation({ summary: 'Actualiza un contacto.' })
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('sales:write')
  @ApiOperation({ summary: 'Elimina (soft) un contacto.' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
