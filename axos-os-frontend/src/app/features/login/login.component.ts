import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';

/**
 * LoginComponent – direct page route kept as fallback.
 * The primary login experience is the modal on LandingComponent.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  email = '';
  password = '';
  error: string | null = null;
  loading = false;
  showPassword = false;

  constructor(private auth: AuthService, private router: Router) {}

  submit(): void {
    this.error = null;
    this.loading = true;
    this.auth.login(this.email.trim(), this.password.trim()).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.error = 'Credenciales incorrectas';
        } else if (err.status === 403) {
          this.error = 'Acceso bloqueado.';
        } else if (err.status === 0) {
          this.error = 'No se pudo conectar al backend.';
        } else {
          this.error = err?.error?.message || 'No se pudo iniciar sesión';
        }
        this.loading = false;
      },
    });
  }
}
