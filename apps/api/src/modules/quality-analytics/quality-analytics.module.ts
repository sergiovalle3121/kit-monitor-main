import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NCR } from '../ncr/entities/ncr.entity';
import { IQCInspection } from '../quality/entities/iqc-inspection.entity';
import { CAPA } from '../quality/entities/capa.entity';
import { FinalInspection } from '../quality/entities/final-inspection.entity';
import { Disposition } from '../quality/entities/disposition.entity';
import { DefectCode } from '../defect-codes/entities/defect-code.entity';
import { QualityCharacteristic } from '../quality/entities/quality-characteristic.entity';
import { FloorQualityModule } from '../floor-quality/floor-quality.module';
import { RmaModule } from '../rma/rma.module';
import { GenealogyModule } from '../genealogy/genealogy.module';
import { TestingModule } from '../testing/testing.module';
import { QualityAnalyticsService } from './quality-analytics.service';
import { QualityAnalyticsController } from './quality-analytics.controller';

/**
 * Área de SOLO LECTURA que compone el tablero analítico de calidad a partir de
 * las entidades que ya existen (NCR, IQC, final, disposiciones, CAPA) y de las
 * pruebas (vía TestingService, que respeta el scope de tenant). No muta nada ni
 * cambia la captura: solo lee y agrega.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NCR,
      IQCInspection,
      CAPA,
      FinalInspection,
      Disposition,
      DefectCode,
      QualityCharacteristic,
    ]),
    TestingModule,
    FloorQualityModule,
    RmaModule,
    GenealogyModule,
  ],
  controllers: [QualityAnalyticsController],
  providers: [QualityAnalyticsService],
  exports: [QualityAnalyticsService],
})
export class QualityAnalyticsModule {}
