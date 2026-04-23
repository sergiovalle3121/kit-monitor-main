import { CommonModule } from '@angular/common';
import { Component, Input, computed } from '@angular/core';
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

  constructor(readonly ctx: EnterpriseContextService) {}

  readonly buildingLabel = computed(() => {
    const id = this.ctx.context().buildingId;
    if (!id) return null;
    const b = this.ctx.buildings().find((x) => x.id === id);
    return b ? b.code : id;
  });

  readonly programLabel = computed(() => {
    const id = this.ctx.context().programId;
    if (!id) return null;
    const p = this.ctx.programs().find((x) => x.id === id);
    return p ? p.code : id;
  });

  readonly lineLabel = computed(() => {
    const id = this.ctx.context().lineId;
    if (!id) return null;
    const l = this.ctx.lines().find((x) => x.id === id);
    return l ? l.code : id;
  });

  readonly hasAnyContext = computed(() => {
    const c = this.ctx.context();
    return !!(c.buildingId || c.programId || c.lineId || c.workOrder || c.model);
  });

  /** 'all' = nada seleccionado, 'partial' = algo, 'full' = building+program+line */
  readonly scopeState = computed((): 'all' | 'partial' | 'full' => {
    const c = this.ctx.context();
    if (c.buildingId && c.programId && c.lineId) return 'full';
    if (c.buildingId || c.programId || c.lineId || c.workOrder || c.model) return 'partial';
    return 'all';
  });
}
