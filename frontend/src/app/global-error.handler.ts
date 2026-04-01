import { ErrorHandler, Injectable } from '@angular/core';
import { LoggerService } from './logger.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private logger: LoggerService) {}

  handleError(error: any): void {
    this.logger.log(`Error global: ${error.message}`);
    // Aquí puedes agregar más lógica para el manejo de errores
  }
}