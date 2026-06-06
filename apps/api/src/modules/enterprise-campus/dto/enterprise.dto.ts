export class CreateBuildingDto {
  code: string;
  name: string;
  status?: string;
  tags?: string[];
  activeShifts?: string[];
  sortOrder?: number;
}

export class UpdateBuildingDto {
  name?: string;
  status?: string;
  tags?: string[];
  activeShifts?: string[];
  sortOrder?: number;
}

export class CreateCustomerDto {
  code: string;
  name: string;
  industry?: string;
  status?: string;
}

export class CreateProgramDto {
  code: string;
  name: string;
  customerId: string;
  dedicatedBuildingId?: string | null;
  status?: string;
  primaryModelPrefix?: string;
}
