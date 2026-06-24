import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DefectCode } from './entities/defect-code.entity';
import { DefectCodesService } from './defect-codes.service';
import { DefectCodesController } from './defect-codes.controller';

/**
 * Catálogo de códigos de defecto — área additiva y autocontenida. Es el cimiento
 * del Pareto/PPM del tablero analítico de calidad. No depende de ningún otro
 * módulo de calidad (solo expone el catálogo); la analítica y la clasificación de
 * NCR lo consumen.
 */
@Module({
  imports: [TypeOrmModule.forFeature([DefectCode])],
  controllers: [DefectCodesController],
  providers: [DefectCodesService],
  exports: [DefectCodesService],
})
export class DefectCodesModule {}
