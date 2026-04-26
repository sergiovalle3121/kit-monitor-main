import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ConfirmModalOptions {
  title: string;
  message: string;
  confirmText?: string;
  type?: 'destructive' | 'neutral';
  cancelText?: string;
}

interface ConfirmModalState extends Required<ConfirmModalOptions> {
  open: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmModalService {
  private resolver: ((value: boolean) => void) | null = null;

  private readonly initialState: ConfirmModalState = {
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    type: 'neutral',
  };

  readonly state$ = new BehaviorSubject<ConfirmModalState>(this.initialState);

  open(options: ConfirmModalOptions): Promise<boolean> {
    if (this.resolver) {
      this.resolver(false);
      this.resolver = null;
    }

    this.state$.next({
      open: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText ?? 'Confirmar',
      cancelText: options.cancelText ?? 'Cancelar',
      type: options.type ?? 'neutral',
    });

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  resolve(result: boolean): void {
    this.state$.next(this.initialState);
    if (this.resolver) {
      this.resolver(result);
      this.resolver = null;
    }
  }
}
