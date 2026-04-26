import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-focused-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './focused-layout.html',
  styleUrls: ['./focused-layout.css'],
})
export class FocusedLayoutComponent {
  constructor(private readonly router: Router, private readonly location: Location) {}

  exitToShell(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/dashboard']);
    }
  }
}
