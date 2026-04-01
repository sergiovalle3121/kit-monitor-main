import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { KitsComponent } from './pages/kits/kits.component';
import { ShellComponent } from './layout/shell/shell';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'kits', component: KitsComponent },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
