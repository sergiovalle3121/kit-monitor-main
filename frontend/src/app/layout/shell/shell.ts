import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { filter } from 'rxjs';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrls: ['./shell.css'],
})
export class ShellComponent {
  collapsed = false;
  openSection: string | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {
    this.syncSection(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.syncSection(event.urlAfterRedirects));
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
  }

  toggleSection(section: string): void {
    this.openSection = this.openSection === section ? null : section;
  }

  logout(): void {
    this.auth.logout();
  }

  private syncSection(url: string): void {
    if (url.startsWith('/plan') || url.startsWith('/forecast')) {
      this.openSection = 'plan';
      return;
    }

    if (url.startsWith('/bom') || url.startsWith('/kits') || url.startsWith('/conteos')) {
      this.openSection = 'ic';
      return;
    }

    if (url.startsWith('/production')) {
      this.openSection = 'prod';
      return;
    }

    if (url.startsWith('/visual-aids') || url.startsWith('/disposition')) {
      this.openSection = 'ie';
      return;
    }

    this.openSection = null;
  }
}
