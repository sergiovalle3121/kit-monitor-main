import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-warehouse-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './warehouse-center.component.html',
  styleUrl: './warehouse-center.component.css'
})
export class WarehouseCenterComponent implements OnInit {
  loading = true;
  tasks: any[] = [];
  showModal = false;

  taskForm = {
    type: 'transfer' as any,
    partNumber: '',
    quantity: 0,
    lotNumber: '',
    fromWarehouseId: '',
    fromLocation: '',
    toWarehouseId: '',
    toLocation: '',
    referenceType: 'MANUAL',
    referenceId: ''
  };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadTasks();
  }

  loadTasks() {
    this.loading = true;
    this.api.getWarehouseTasks().subscribe({
      next: (data) => {
        this.tasks = data;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  openCreate() {
    this.showModal = true;
  }

  createTask() {
    this.api.createWarehouseTask(this.taskForm).subscribe({
      next: () => {
        this.loadTasks();
        this.showModal = false;
        this.taskForm = { type: 'transfer', partNumber: '', quantity: 0, lotNumber: '', fromWarehouseId: '', fromLocation: '', toWarehouseId: '', toLocation: '', referenceType: 'MANUAL', referenceId: '' };
      }
    });
  }

  startTask(id: number) {
    this.api.startWarehouseTask(id, 'WH Op 01').subscribe(() => this.loadTasks());
  }

  completeTask(id: number) {
    this.api.completeWarehouseTask(id, 'WH Op 01').subscribe(() => this.loadTasks());
  }

  getTaskClass(status: string) {
    return status.toLowerCase();
  }
}
