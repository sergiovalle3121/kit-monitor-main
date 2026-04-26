import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EnterpriseContextService } from '../../core/enterprise-context.service';

@Component({
  selector: 'app-enterprise-placeholder',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './enterprise-placeholder.component.html',
  styleUrls: ['./enterprise-placeholder.component.css'],
})
export class EnterprisePlaceholderComponent {
  private readonly route = inject(ActivatedRoute);

  private readonly contextService = inject(EnterpriseContextService);
  
  readonly domain = computed(() => this.route.snapshot.paramMap.get('domain') ?? 'domain');
  readonly module = computed(() => this.route.snapshot.paramMap.get('module') ?? 'module');

  readonly title = computed(() => this.pretty(this.module()));
  readonly domainTitle = computed(() => this.pretty(this.domain()));
  
  readonly buildingCode = computed(() => {
    const id = this.contextService.context().buildingId;
    return id ? this.contextService.buildings().find(b => b.id === id)?.code : null;
  });

  readonly programCode = computed(() => {
    const id = this.contextService.context().programId;
    return id ? this.contextService.programs().find(p => p.id === id)?.code : null;
  });

  private pretty(value: string): string {
    return value
      .split('-')
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }
}
