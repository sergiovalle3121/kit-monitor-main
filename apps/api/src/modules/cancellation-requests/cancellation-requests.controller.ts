import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CancellationRequestsService } from './cancellation-requests.service';
import { CreateCancellationRequestDto } from './dto/create-cancellation-request.dto';
import { RespondCancellationRequestDto } from './dto/respond-cancellation-request.dto';

@Controller('cancellation-requests')
export class CancellationRequestsController {
  constructor(private readonly service: CancellationRequestsService) {}

  @Post()
  create(@Body() dto: CreateCancellationRequestDto) {
    return this.service.create(dto);
  }

  @Get('pending')
  findPending() {
    return this.service.findPending();
  }

  @Get('recent')
  findRecent() {
    return this.service.findRecent();
  }

  @Patch(':id/respond')
  respond(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RespondCancellationRequestDto,
  ) {
    return this.service.respond(id, dto);
  }
}
