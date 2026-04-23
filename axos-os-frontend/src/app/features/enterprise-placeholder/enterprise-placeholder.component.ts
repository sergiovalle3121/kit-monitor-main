import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-enterprise-placeholder',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './enterprise-placeholder.component.html',
  styleUrls: ['./enterprise-placeholder.component.css'],
})
export class EnterprisePlaceholderComponent {
  private readonly route = inject(ActivatedRoute);

  readonly domain = computed(() => this.route.snapshot.paramMap.get('domain') ?? 'domain');
  readonly module = computed(() => this.route.snapshot.paramMap.get('module') ?? 'module');

  readonly title = computed(() => `${this.pretty(this.domain())} · ${this.pretty(this.module())}`);

  private pretty(value: string): string {
    return value
      .split('-')
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }
}
