import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { EnterpriseContextBannerComponent } from '../../shared/enterprise-context-banner/enterprise-context-banner.component';

@Component({
  selector: 'app-ncr-center',
  standalone: true,
  imports: [CommonModule, FormsModule, EnterpriseContextBannerComponent],
  templateUrl: './ncr-center.component.html',
  styleUrl: './ncr-center.component.css'
})
export class NcrCenterComponent implements OnInit {
  private api = inject(ApiService);
  
  loading = true;
  ncrs: any[] = [];
  
  // Create NCR form
  ncrForm: any = {
    partNumber: '',
    category: 'Mechanical',
    description: '',
    sourceType: 'in-process',
    quantityAffected: 1,
    severity: 'major',
    building: '',
    line: '',
    workOrder: '',
    lotNumber: ''
  };

  showCreateModal = false;

  ngOnInit() {
    this.loadNcrs();
  }

  loadNcrs() {
    this.loading = true;
    this.api.getAllNcrs().subscribe({
      next: (data) => {
        this.ncrs = data;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  createNcr() {
    this.api.createNcr({
      ...this.ncrForm,
      createdBy: 'Quality Inspector'
    }).subscribe({
      next: () => {
        this.loadNcrs();
        this.showCreateModal = false;
        this.resetForm();
      }
    });
  }

  updateStatus(id: number, status: string) {
    this.api.updateNcrStatus(id, status, 'Quality Manager').subscribe({
      next: () => this.loadNcrs()
    });
  }

  get openNcrs() { return this.ncrs.filter(n => n.status === 'open'); }
  get criticalNcrs() { return this.ncrs.filter(n => n.severity === 'critical'); }

  resetForm() {
    this.ncrForm = {
      partNumber: '',
      category: 'Mechanical',
      description: '',
      sourceType: 'in-process',
      quantityAffected: 1,
      severity: 'major'
    };
  }
}
