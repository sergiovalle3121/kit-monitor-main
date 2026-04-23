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
  transfers: any[] = [];
  activeTab: 'holds' | 'transfers' = 'holds';
  
  // Create hold form
  holdForm = {
    partNumber: '',
    level: 'PART_NUMBER' as any,
    levelValue: '',
    reason: '',
    notes: ''
  };

  // Transfer form
  transferForm = {
    holdId: 0,
    quantity: 0,
    sourceWarehouseId: '',
    sourceLocation: '',
    destWarehouseId: 'WH-QUARANTINE',
    destLocation: 'QUARANTINE-01'
  };

  showTransferModal = false;

  ngOnInit() {
    this.loadHolds();
    this.loadTransfers();
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

  loadTransfers() {
    this.api.getQuarantineTransfers().subscribe({
      next: (data) => this.transfers = data
    });
  }

  openTransferRequest(hold: any) {
    this.transferForm.holdId = hold.id;
    this.transferForm.quantity = 0;
    this.transferForm.sourceWarehouseId = hold.level === 'WAREHOUSE' ? hold.levelValue : '';
    this.showTransferModal = true;
  }

  requestTransfer() {
    this.api.requestQuarantineTransfer({
      ...this.transferForm,
      requestedBy: 'QA Operator'
    }).subscribe({
      next: () => {
        this.loadTransfers();
        this.showTransferModal = false;
      }
    });
  }

  completeTransfer(id: number) {
    this.api.completeQuarantineTransfer(id, 'Logistics Lead').subscribe({
      next: () => {
        this.loadTransfers();
        this.loadHolds();
      }
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
