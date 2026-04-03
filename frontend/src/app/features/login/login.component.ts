import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  @ViewChild('backgroundVideo') backgroundVideo?: ElementRef<HTMLVideoElement>;

  email = '';
  password = '';
  error: string | null = null;
  loading = false;
  videoReady = false;

  private videoLoadTimer: number | null = null;

  constructor(private auth: AuthService, private router: Router) {}

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;

    this.videoLoadTimer = window.setTimeout(() => {
      const video = this.backgroundVideo?.nativeElement;
      if (!video) return;

      video.src = 'assets/login/system-atmosphere.mp4';
      video.load();
      this.tryPlayVideo();
    }, 120);
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined' && this.videoLoadTimer != null) {
      window.clearTimeout(this.videoLoadTimer);
    }
  }

  onVideoReady(): void {
    this.videoReady = true;
    this.tryPlayVideo();
  }

  submit(): void {
    this.error = null;
    this.loading = true;
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigateByUrl('/kits'),
      error: () => {
        this.error = 'Credenciales incorrectas';
        this.loading = false;
      },
    });
  }

  private tryPlayVideo(): void {
    const video = this.backgroundVideo?.nativeElement;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        this.videoReady = false;
      });
    }
  }
}
