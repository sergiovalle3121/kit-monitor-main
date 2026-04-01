import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-bom',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bom.component.html',
  styleUrls: ['./bom.component.css'],
})
export class BomComponent implements OnInit {
  items: any[] = [];
  loading = false;
  error: string | null = null;

  filterModel = '';
  showForm = false;
  submitting = false;
  formError: string | null = null;

  // Import state
  importing = false;
  importResult: { imported: number; errors: any[] } | null = null;
  importError: string | null = null;

  form = {
    model: '',
    partNumber: '',
    description: '',
    usageFactor: 1,
    unit: 'EA',
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.getBom().subscribe({
      next: (data) => { this.items = data ?? []; this.loading = false; },
      error: () => { this.error = 'No se pudo cargar el BOM'; this.loading = false; },
    });
  }

  get filtered(): any[] {
    const q = this.filterModel.trim().toLowerCase();
    return q ? this.items.filter(i => i.model.toLowerCase().includes(q)) : this.items;
  }

  submit(): void {
    this.submitting = true;
    this.formError = null;
    this.api.createBomItem({ ...this.form }).subscribe({
      next: (created) => {
        this.items = [...this.items, created];
        this.submitting = false;
        this.showForm = false;
        this.form = { model: '', partNumber: '', description: '', usageFactor: 1, unit: 'EA' };
      },
      error: (err) => {
        this.formError = err?.error?.message ?? 'Error al guardar el item';
        this.submitting = false;
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importing = true;
    this.importResult = null;
    this.importError = null;

    this.api.importBom(file).subscribe({
      next: (result) => {
        this.importResult = result;
        this.importing = false;
        // Reload the table to show newly imported items
        this.load();
        // Reset file input
        input.value = '';
      },
      error: (err) => {
        this.importError = err?.error?.message ?? 'Error al importar el archivo';
        this.importing = false;
        input.value = '';
      },
    });
  }
}
