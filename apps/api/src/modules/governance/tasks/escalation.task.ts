import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditService } from '../audit.service';

@Injectable()
export class EscalationTask {
  private readonly logger = new Logger(EscalationTask.name);

  constructor(private readonly auditService: AuditService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleEscalations() {
    this.logger.log('Starting autonomous escalation check...');
    try {
      const result = await this.auditService.checkEscalations();
      this.logger.log(
        `Escalation check completed. Exceptions checked: ${result.checked}`,
      );
    } catch (err) {
      this.logger.error('Error during autonomous escalation check', err.stack);
    }
  }
}
