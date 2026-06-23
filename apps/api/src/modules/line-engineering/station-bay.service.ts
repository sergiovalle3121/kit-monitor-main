import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LineEngineeringService } from './line-engineering.service';
import { BayLayout } from '../bay-layout/entities/bay-layout.entity';

/**
 * Bridges the 2D layout to material staging (Fase 22): for each station it
 * resolves which BAY (bahía 1–6) supplies the part the station consumes, by
 * matching the station's expected part number (`npExpected`) against the
 * model's `bay_layouts` assignment. Read-only: it never writes the bay config
 * (owned by the bay-layout module), only joins it onto the routing.
 */
export interface StationBay {
  station: string;
  line: string;
  sequence: number;
  npExpected: string | null;
  bahia: number | null;
  placed: boolean;
}

export interface StationBaySummary {
  model: string;
  revision: string;
  total: number;
  mapped: number; // stations whose NP resolves to a bay
  unmapped: number; // stations with an NP but no bay assignment
  baysUsed: number[]; // distinct bays, sorted
  stations: StationBay[];
}

@Injectable()
export class StationBayService {
  constructor(
    private readonly lineEng: LineEngineeringService,
    @InjectRepository(BayLayout)
    private readonly bays: Repository<BayLayout>,
  ) {}

  async getStationBays(
    model: string,
    revision = 'A',
  ): Promise<StationBaySummary> {
    const m = (model ?? '').trim();
    const r = (revision ?? 'A').trim() || 'A';
    const route = await this.lineEng.routing(m, r);
    const bayRows = m ? await this.bays.find({ where: { model: m } }) : [];
    const bayByNp = new Map(bayRows.map((b) => [b.partNumber, b.bahia]));

    const stations: StationBay[] = route.map((s) => {
      const bahia = s.npExpected ? (bayByNp.get(s.npExpected) ?? null) : null;
      return {
        station: s.station,
        line: s.line,
        sequence: s.sequence,
        npExpected: s.npExpected,
        bahia,
        placed: s.layoutX !== null && s.layoutX !== undefined,
      };
    });
    const mapped = stations.filter((s) => s.bahia !== null).length;
    const unmapped = stations.filter(
      (s) => !!s.npExpected && s.bahia === null,
    ).length;
    const baysUsed = [
      ...new Set(stations.flatMap((s) => (s.bahia !== null ? [s.bahia] : []))),
    ].sort((a, b) => a - b);

    return {
      model: m,
      revision: r,
      total: stations.length,
      mapped,
      unmapped,
      baysUsed,
      stations,
    };
  }
}
