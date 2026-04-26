import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-capa-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './capa-center.component.html',
  styleUrl: './capa-center.component.css'
})
export class CapaCenterComponent implements OnInit {
  loading = true;
  capas: any[] = [];
  selectedCapa: any = null;
  showCreateModal = false;
  showDetailModal = false;

  capaForm = {
    problemStatement: '',
    partNumber: '',
    priority: 'medium',
    building: '',
    line: '',
    program: '',
    owner: ''
  };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadCapas();
  }

  loadCapas() {
    this.loading = true;
    this.api.getCapas().subscribe({
      next: (data) => {
        this.capas = data;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  openCreate() {
    this.showCreateModal = true;
  }

  createCapa() {
    this.api.createCapa({
      ...this.capaForm,
      createdBy: 'QA Manager'
    }).subscribe({
      next: () => {
        this.loadCapas();
        this.showCreateModal = false;
        this.capaForm = { problemStatement: '', partNumber: '', priority: 'medium', building: '', line: '', program: '', owner: '' };
      }
    });
  }

  viewDetail(capa: any) {
    this.selectedCapa = { ...capa };
    this.showDetailModal = true;
  }

  updateCapa() {
    if (!this.selectedCapa) return;
    this.api.updateCapa(this.selectedCapa.id, this.selectedCapa, 'QA Engineer').subscribe({
      next: () => {
        this.loadCapas();
        this.showDetailModal = false;
      }
    });
  }

  getStatusClass(status: string) {
    return status.toLowerCase().replace(/ /g, '_');
  }

  getCountByStatus(statuses: string[]): number {
    return this.capas.filter(c => statuses.includes(c.status)).length;
  }
}
