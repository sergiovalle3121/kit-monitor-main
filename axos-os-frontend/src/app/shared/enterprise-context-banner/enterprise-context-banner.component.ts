import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { EnterpriseContextService } from '../../core/enterprise-context.service';

@Component({
  selector: 'app-enterprise-context-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './enterprise-context-banner.component.html',
  styleUrls: ['./enterprise-context-banner.component.css'],
})
export class EnterpriseContextBannerComponent {
  @Input() moduleName = 'Módulo';
  constructor(readonly context: EnterpriseContextService) {}
}
