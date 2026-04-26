import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { EnterpriseContextService, EnterpriseContextState } from '../../core/enterprise-context.service';

@Component({
  selector: 'app-context-gate',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './context-gate.component.html',
  styleUrls: ['./context-gate.component.css']
})
export class ContextGateComponent implements OnInit {
  private readonly contextService = inject(EnterpriseContextService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly buildings = this.contextService.buildings;
  readonly programs = this.contextService.programs;

  selectedBuildingId = signal<string | null>(null);
  selectedProgramId = signal<string | null>(null);

  step = signal<number>(1); // 1: Building, 2: Program

  filteredPrograms = computed(() => {
    const bId = this.selectedBuildingId();
    if (!bId) return [];
    return this.programs().filter(p => {
      const buildingRef = p.dedicatedBuilding;
      if (!buildingRef) return true; // Global program
      // Match if it's an object with .id or if it's a direct ID string
      return buildingRef === bId || buildingRef.id === bId;
    });
  });

  async ngOnInit() {
    await this.contextService.preload();
    
    // Auto-select if only one building
    if (this.buildings().length === 1) {
      this.selectBuilding(this.buildings()[0].id);
    }
  }

  selectBuilding(id: string) {
    this.selectedBuildingId.set(id);
    if (this.filteredPrograms().length === 1) {
      this.selectProgram(this.filteredPrograms()[0].id);
    } else {
      this.step.set(2);
    }
  }

  selectProgram(id: string) {
    this.selectedProgramId.set(id);
    this.confirmContext();
  }

  goBack() {
    this.step.set(1);
    this.selectedProgramId.set(null);
  }

  confirmContext() {
    const bId = this.selectedBuildingId();
    const pId = this.selectedProgramId();

    if (bId && pId) {
      this.contextService.update({
        buildingId: bId,
        programId: pId,
        isConfigured: true
      });

      const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/welcome';
      this.router.navigateByUrl(returnUrl);
    }
  }
}
