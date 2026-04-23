import { Controller, Get } from '@nestjs/common';
import { EnterpriseCampusService } from './enterprise-campus.service';

@Controller('enterprise')
export class EnterpriseCampusController {
  constructor(private readonly service: EnterpriseCampusService) {}

  @Get('buildings')
  getBuildings() {
    return this.service.listBuildings();
  }

  @Get('warehouses')
  getWarehouses() {
    return this.service.listWarehouses();
  }

  @Get('customers')
  getCustomers() {
    return this.service.listCustomers();
  }

  @Get('programs')
  getPrograms() {
    return this.service.listPrograms();
  }

  @Get('campus-state')
  getCampusState() {
    return this.service.getCampusState();
  }
}
