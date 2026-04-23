import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { EnterpriseContextBannerComponent } from '../../shared/enterprise-context-banner/enterprise-context-banner.component';

@Component({
  selector: 'app-quality-center',
  standalone: true,
  imports: [CommonModule, FormsModule, EnterpriseContextBannerComponent],
  templateUrl: './quality-center.component.html',
  styleUrl: './quality-center.component.css'
})
export class QualityCenterComponent implements OnInit {
  private api = inject(ApiService);
  
  loading = true;
  activeHolds: any[] = [];
  
  // Create hold form
  holdForm = {
    partNumber: '',
    level: 'PART_NUMBER' as any,
    levelValue: '',
    reason: '',
    notes: ''
  };

  ngOnInit() {
    this.loadHolds();
  }

  loadHolds() {
    this.loading = true;
    this.api.getActiveHolds().subscribe({
      next: (data) => {
        this.activeHolds = data;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  applyHold() {
    if (!this.holdForm.partNumber || !this.holdForm.reason) return;
    
    this.api.applyQualityHold({
      ...this.holdForm,
      heldBy: 'QA Lead'
    }).subscribe({
      next: () => {
        this.loadHolds();
        this.resetForm();
      },
      error: (err) => alert('Error al aplicar hold: ' + (err.error?.message || 'Error desconocido'))
    });
  }

  releaseHold(id: number) {
    if (!confirm('¿Seguro que desea liberar este material?')) return;
    
    this.api.releaseQualityHold(id, 'QA Lead').subscribe({
      next: () => this.loadHolds()
    });
  }

  resetForm() {
    this.holdForm = {
      partNumber: '',
      level: 'PART_NUMBER',
      levelValue: '',
      reason: '',
      notes: ''
    };
  }
}
