import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { DashboardService } from './dashboard.service'; // Asegúrate de que esta ruta sea correcta

// Definición de la fila de la tabla
type Row = { id: number; nombre: string; estado: 'OK' | 'WARN' | 'ERROR' };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatTableModule, MatButtonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  providers: [DashboardService] // <--- ¡Importante! Añade el servicio aquí
})
export class DashboardComponent implements OnInit {
  apiStatus: 'loading' | 'ok' | 'fail' = 'loading';
  apiMessage = '';

  // Datos para las tarjetas (puedes reemplazar con datos reales del backend)
  cards = [
    { title: 'Kits', value: 12 },
    { title: 'Alertas', value: 3 },
    { title: 'Usuarios', value: 5 },
  ];

  // Datos para el gráfico de barras (valores de ejemplo)
  chartData = [5, 9, 2, 7, 3, 10, 6];
  selectedBar = -1;

  // Datos para la tabla (valores de ejemplo)
  displayedColumns = ['id', 'nombre', 'estado', 'acciones'];
  data: Row[] = [
    { id: 1, nombre: 'Kit A', estado: 'OK' },
    { id: 2, nombre: 'Kit B', estado: 'WARN' },
    { id: 3, nombre: 'Kit C', estado: 'ERROR' },
  ];

  // Datos reales de la API
  kits: any[] = [];
  reports: any[] = [];
  models: any[] = [];

  constructor(private dashboardService: DashboardService) { }

  ngOnInit() {
    this.checkApi();
    this.fetchData(); // Agregamos la llamada a la función para obtener los datos
  }

  fetchData() {
    this.dashboardService.getKits().subscribe(data => this.kits = data || []);
    this.dashboardService.getReports().subscribe(data => this.reports = data || []);
    this.dashboardService.getModels().subscribe(data => this.models = data || []);
  }

  // Lógica para verificar el estado de la API
  checkApi() {
    this.apiStatus = 'loading';
    this.dashboardService.getHealth().subscribe({
        next: (msg) => {
          this.apiStatus = 'ok';
          this.apiMessage = msg;
        },
        error: (err) => {
          this.apiStatus = 'fail';
          this.apiMessage = err?.message ?? 'Error';
        }
      });
  }

  // Lógica para generar datos aleatorios para el gráfico y las tarjetas
  randomize() {
    this.chartData = this.chartData.map(() => Math.floor(Math.random() * 10) + 1);
    this.cards = this.cards.map(c => ({ ...c, value: Math.floor(Math.random() * 20) }));
  }

  // Lógica para el clic en una fila de la tabla
  onRowClick(r: Row) {
    alert(`Abrir detalle del ${r.nombre} (id ${r.id})`);
  }

  // Lógica para el clic en una barra del gráfico
  onBarClick(i: number) {
    this.selectedBar = i;
  }
}