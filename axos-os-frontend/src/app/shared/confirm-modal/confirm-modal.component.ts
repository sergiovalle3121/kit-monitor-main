import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { ConfirmModalService } from './confirm-modal.service';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-modal.component.html',
  styleUrl: './confirm-modal.component.css',
})
export class ConfirmModalComponent {
  readonly state$;

  constructor(private readonly confirm: ConfirmModalService) {
    this.state$ = this.confirm.state$;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirm.state$.value.open) {
      this.cancel();
    }
  }

  cancel(): void {
    this.confirm.resolve(false);
  }

  confirmAction(): void {
    this.confirm.resolve(true);
  }
}
