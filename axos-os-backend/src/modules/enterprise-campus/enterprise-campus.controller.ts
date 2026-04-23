import { Controller, Get } from '@nestjs/common';
import { EnterpriseCampusService } from './enterprise-campus.service';

@Controller('enterprise')
export class EnterpriseCampusController {
  constructor(private readonly service: EnterpriseCampusService) {}

  @Get('campus-state')
  getCampusState() {
    return this.service.getCampusState();
  }
}
