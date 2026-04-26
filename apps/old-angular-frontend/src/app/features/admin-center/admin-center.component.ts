import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-admin-center',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-center.component.html',
  styleUrl: './admin-center.component.css'
})
export class AdminCenterComponent implements OnInit {
  loading = true;
  activeTab: 'users' | 'master-data' | 'audit' = 'users';
  users: any[] = [];
  masterData: any = { buildings: [], warehouses: [], programs: [], lines: [], roles: [], permissions: [] };
  auditLogs: any[] = [];

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadUsers();
    this.loadMasterData();
    this.loadAuditLogs();
  }

  loadUsers() {
    this.api.getGovernanceUsers().subscribe(users => {
      this.users = users;
      this.loading = false;
    });
  }

  loadMasterData() {
    this.api.getGovernanceMasterData().subscribe(data => this.masterData = data);
  }

  loadAuditLogs() {
    this.api.getGovernanceAuditLogs().subscribe(logs => this.auditLogs = logs);
  }

  updateUserRole(user: any, newRole: string) {
    this.api.updateGovernanceUser(user.id, { role: newRole }).subscribe(() => {
      this.loadUsers();
    });
  }

  togglePermission(user: any, permission: string) {
    const permissions = user.permissions || [];
    const index = permissions.indexOf(permission);
    if (index > -1) {
      permissions.splice(index, 1);
    } else {
      permissions.push(permission);
    }
    this.api.updateGovernanceUser(user.id, { permissions }).subscribe(() => {
      this.loadUsers();
    });
  }

  hasPermission(user: any, permission: string): boolean {
    return user.permissions?.includes(permission) || false;
  }
}
