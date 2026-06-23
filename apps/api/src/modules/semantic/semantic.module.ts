import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricDefinition } from './entities/metric-definition.entity';
import { OntologyObjectType } from './entities/ontology-object-type.entity';
import { OntologyLinkType } from './entities/ontology-link-type.entity';
import { MetricSnapshot } from './entities/metric-snapshot.entity';
import { DecisionBrief } from './entities/decision-brief.entity';
import { SemanticController } from './semantic.controller';
import { SemanticService } from './semantic.service';
import { BriefsService } from './briefs.service';

/**
 * Semantic layer for Axos OS — a versioned metric catalog + a business ontology
 * (object types and links) over the real MES/ERP data. Powers the Intelligence
 * Center UI and grounds CIDE with shared, governed metric definitions. Live
 * values delegate to existing domain services, resolved lazily via ModuleRef,
 * so no domain module needs to export them here.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MetricDefinition,
      OntologyObjectType,
      OntologyLinkType,
      MetricSnapshot,
      DecisionBrief,
    ]),
  ],
  controllers: [SemanticController],
  providers: [SemanticService, BriefsService],
  exports: [SemanticService, BriefsService],
})
export class SemanticModule {}
