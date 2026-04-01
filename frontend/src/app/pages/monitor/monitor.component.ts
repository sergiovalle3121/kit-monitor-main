import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './monitor.component.html',
  styleUrls: ['./monitor.component.css'],
})
export class MonitorComponent implements OnInit {
  kits: any[] = [];
  loading = false;
  error: string | null = null;

  // Grid dimensions: 7 backens × 6 bahías
  backens = [1, 2, 3, 4, 5, 6, 7];
  bahias = [1, 2, 3, 4, 5, 6];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loading = true;
    this.api.getKits().subscribe({
      next: (data) => { this.kits = data ?? []; this.loading = false; },
      error: () => { this.error = 'No se pudo cargar el monitor'; this.loading = false; },
    });
  }

  kitAt(backen: number, bahia: number): any {
    return this.kits.find(k => k.plan?.backen === backen && k.plan?.bahia === bahia) ?? null;
  }
}
