import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-kits',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kits.html',
})
export class KitsComponent implements OnInit {
  kits: any[] = [];
  loading = false;
  error: string | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loading = true;
    this.api.getKits().subscribe({
      next: d => { this.kits = d ?? []; this.loading = false; },
      error: _ => { this.error = 'No se pudieron cargar los kits'; this.loading = false; }
    });
  }
}
