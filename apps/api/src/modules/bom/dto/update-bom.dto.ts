import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateBomHeaderDto, CreateBomComponentDto } from './create-bom.dto';

export class UpdateBomHeaderDto extends PartialType(
  OmitType(CreateBomHeaderDto, ['components'] as const)
) {}

export class UpdateBomComponentDto extends PartialType(CreateBomComponentDto) {}
