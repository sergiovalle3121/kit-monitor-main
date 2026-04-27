import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ProposalStatus } from '../entities/corrective-proposal.entity';

export class ListProposalsQueryDto {
  @IsOptional()
  @IsEnum(['pending', 'executed', 'dismissed', 'expired'])
  status?: ProposalStatus;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class ExecuteProposalDto {
  @IsOptional()
  @IsString()
  actor?: string;
}

export interface ProposalExecutionResult {
  proposalId: number;
  action: string;
  executedAt: string;
  details: Record<string, any>;
}
