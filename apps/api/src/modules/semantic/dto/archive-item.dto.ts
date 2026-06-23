import { IsBoolean, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class ArchiveItemDto {
  @IsIn(['metric', 'object', 'link'])
  kind: 'metric' | 'object' | 'link';

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  key: string;

  /** false = archive (hide), true = restore. */
  @IsBoolean()
  active: boolean;
}
