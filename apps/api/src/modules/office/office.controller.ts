import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { OfficeService } from './office.service';
import { OfficeSheetConnectorsService } from './office-sheet-connectors.service';
import type {
  OfficeDocType,
  OfficeShare,
} from './entities/office-document.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/types/jwt.types';

interface AuthReq {
  user: AuthenticatedUser;
}

@UseGuards(JwtAuthGuard)
@Controller('office-documents')
export class OfficeController {
  constructor(
    private readonly service: OfficeService,
    private readonly sheetConnectors: OfficeSheetConnectorsService,
  ) {}

  @Get()
  list(
    @Request() req: AuthReq,
    @Query('type') type?: OfficeDocType,
    @Query('trash') trash?: string,
  ) {
    return this.service.list(type, req.user, trash === '1' || trash === 'true');
  }

  @Get('sheets/connectors/:type')
  refreshSheetConnector(
    @Request() req: AuthReq,
    @Param('type') type: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.sheetConnectors.refresh(type, query, req.user);
  }

  @Get(':id')
  get(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.get(id, req.user);
  }

  @Post()
  create(
    @Request() req: AuthReq,
    @Body()
    dto: { type: OfficeDocType; title?: string; content?: any; model?: string },
  ) {
    return this.service.create(dto, req.user);
  }

  @Post(':id/duplicate')
  duplicate(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.duplicate(id, req.user);
  }

  @Patch(':id')
  update(
    @Request() req: AuthReq,
    @Param('id') id: string,
    @Body()
    dto: {
      title?: string;
      content?: any;
      model?: string | null;
      sharedWith?: OfficeShare[];
    },
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Patch(':id/restore')
  restore(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.restore(id, req.user);
  }

  @Get(':id/versions')
  versions(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.listVersions(id, req.user);
  }

  @Post(':id/versions')
  snapshot(
    @Request() req: AuthReq,
    @Param('id') id: string,
    @Body() dto: { label?: string },
  ) {
    return this.service.snapshotNow(id, req.user, dto?.label);
  }

  @Post(':id/versions/:versionId/restore')
  restoreVersion(
    @Request() req: AuthReq,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.service.restoreVersion(id, versionId, req.user);
  }

  @Delete(':id')
  remove(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.remove(id, req.user);
  }

  @Delete(':id/permanent')
  destroy(@Request() req: AuthReq, @Param('id') id: string) {
    return this.service.destroy(id, req.user);
  }
}
