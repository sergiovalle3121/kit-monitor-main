import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-picking-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './picking-center.component.html',
  styleUrl: './picking-center.component.css'
})
export class PickingCenterComponent implements OnInit {
  loading = true;
  backlog: any[] = [];
  activeTask: any = null;
  showExceptionModal = false;
  
  exceptionForm = {
    reason: 'SHORT_PICK',
    pickedQty: 0
  };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadBacklog();
  }

  loadBacklog() {
    this.loading = true;
    this.api.getPickingBacklog().subscribe({
      next: (data) => {
        this.backlog = data;
        this.loading = false;
        if (!this.activeTask && this.backlog.length > 0) {
          // Auto-select first in_progress or pending
          this.activeTask = this.backlog.find(t => t.status === 'in_progress') || null;
        }
      },
      error: () => this.loading = false
    });
  }

  startPicking(task: any) {
    this.api.startWarehouseTask(task.id, 'Picker 01').subscribe(() => {
      this.activeTask = { ...task, status: 'in_progress', assignedTo: 'Picker 01' };
      this.loadBacklog();
    });
  }

  confirmPick() {
    if (!this.activeTask) return;
    this.api.completeWarehouseTask(this.activeTask.id, 'Picker 01').subscribe(() => {
      this.activeTask = null;
      this.loadBacklog();
    });
  }

  openException() {
    this.exceptionForm.pickedQty = this.activeTask.quantity;
    this.showExceptionModal = true;
  }

  submitException() {
    this.api.handlePickException(this.activeTask.id, {
      ...this.exceptionForm,
      actor: 'Picker 01'
    }).subscribe(() => {
      this.activeTask = null;
      this.showExceptionModal = false;
      this.loadBacklog();
    });
  }
}
