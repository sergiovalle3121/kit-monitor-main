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
  dispositions: any[] = [];
  activeTab: 'holds' | 'transfers' | 'dispositions' = 'holds';
  
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

  // Disposition form
  dispositionForm = {
    ncrId: null,
    holdId: null,
    partNumber: '',
    quantity: 0,
    type: 'release' as any,
    reason: '',
    warehouseId: '',
    location: ''
  };

  showTransferModal = false;
  showDispositionModal = false;

  ngOnInit() {
    this.loadHolds();
    this.loadTransfers();
    this.loadDispositions();
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

  loadDispositions() {
    this.api.getDispositions().subscribe({
      next: (data) => this.dispositions = data
    });
  }

  openTransferRequest(hold: any) {
    this.transferForm.holdId = hold.id;
    this.transferForm.quantity = 0;
    this.transferForm.sourceWarehouseId = hold.level === 'WAREHOUSE' ? hold.levelValue : '';
    this.showTransferModal = true;
  }

  openDispositionPropose(hold: any) {
    this.dispositionForm.holdId = hold.id;
    this.dispositionForm.partNumber = hold.partNumber;
    this.dispositionForm.warehouseId = hold.level === 'WAREHOUSE' ? hold.levelValue : '';
    this.dispositionForm.location = hold.level === 'WAREHOUSE' ? 'BULK' : '';
    this.showDispositionModal = true;
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

  proposeDisposition() {
    this.api.proposeDisposition({
      ...this.dispositionForm,
      proposedBy: 'QA Engineer'
    }).subscribe({
      next: () => {
        this.loadDispositions();
        this.showDispositionModal = false;
      }
    });
  }

  approveDisposition(id: number) {
    this.api.approveDisposition(id, 'QA Manager').subscribe({
      next: () => this.loadDispositions()
    });
  }

  executeDisposition(id: number) {
    this.api.executeDisposition(id, 'Logistics Lead').subscribe({
      next: () => {
        this.loadDispositions();
        this.loadHolds();
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
