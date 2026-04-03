import * as XLSX from 'xlsx';
import {
  CatalogRow,
  DemandPoint,
  DemandSeries,
  OperationCapacityRow,
  StockPoint,
  StockSnapshot,
  StockSource,
  WipOrder,
  WorkbookParseResult,
  WorkbookSheetInfo,
} from './forecast.models';

type RawRows = Array<Array<string | number>>;

interface HeaderMatch {
  index: number | null;
  score: number;
}

interface SheetInspection {
  info: WorkbookSheetInfo;
  headers: string[];
  dataRows: RawRows;
}

export class ForecastWorkbookParser {
  private static readonly demandMaterialHeaders = ['material', 'np', 'material number', 'part number', 'part no', 'stock material', 'numero de material', 'numero parte', 'codigo material', 'codigo', 'sku', 'matnr'];
  private static readonly demandLocationHeaders = ['localidad', 'location', 'storage location', 'storage location stock identifier', 'storage bin', 'ubicacion', 'localizacion', 'almacen', 'rack', 'bin', 'sloc', 'lgort'];
  private static readonly demandPeriodHeaders = ['periodo', 'period', 'month', 'mes', 'fecha', 'posting date', 'document date', 'forecast history', 'calendar month', 'fiscal period'];
  private static readonly demandValueHeaders = ['demanda', 'demand', 'consumo', 'consumption', 'usage', 'withdrawal qty', 'consumption qty', 'requirement qty', 'required quantity', 'qty', 'quantity', 'valor'];
  private static readonly stockHeaders = ['stock', 'unrestricted', 'total stock', 'existencia', 'inventario', 'on hand', 'onhand', 'available stock', 'free stock'];
  private static readonly stockTransferHeaders = ['stock in tfr', 'in transfer', 'transfer stock'];
  private static readonly stockBlockedHeaders = ['blocked', 'blocked stock'];
  private static readonly stockQualityHeaders = ['in qual insp', 'in qual. insp.', 'quality', 'quality hold'];
  private static readonly modelHeaders = ['modelo', 'model', 'assembly', 'assembly mes', 'assemblymes', 'project'];
  private static readonly workOrderHeaders = ['workorder', 'work order', 'orden de trabajo', 'wo'];
  private static readonly backlogHeaders = ['backlog', 'pendiente', 'open demand', 'open qty', 'open quantity'];
  private static readonly plannedHeaders = ['planned', 'planned qty', 'planned quantity'];
  private static readonly wipHeaders = ['wip', 'started'];
  private static readonly leadTimeHeaders = ['lead time', 'leadtime', 'leedtime', 'lt', 'planned lead time', 'planned delivery time'];
  private static readonly quantityHeaders = ['quantity', 'qty', 'cantidad'];
  private static readonly criticalityHeaders = ['criticidad', 'criticality', 'critic'];
  private static readonly kitTimeHeaders = ['tiempo por kit', 'minutos por kit', 'tiempo kit', 'cycle time'];
  private static readonly bomHeaders = ['% bom disponible', 'bom disponible', 'bom available', 'bom coverage', 'component availability'];
  private static readonly clientPriorityHeaders = ['prioridad cliente', 'customer priority', 'prioridad'];
  private static readonly marginHeaders = ['margen impacto', 'margin impact', 'impacto margen', 'margen'];
  private static readonly descriptionHeaders = ['descripcion', 'description', 'material description', 'short text'];
  private static readonly typeHeaders = ['tipo', 'type', 'material type'];
  private static readonly statusHeaders = ['status', 'estado'];
  private static readonly processHeaders = ['process', 'proceso', 'nextstep', 'next step'];
  private static readonly startTimeHeaders = ['starttime', 'start time', 'fecha inicio', 'datetime'];

  static analyzeWorkbook(workbook: XLSX.WorkBook, fileName: string): WorkbookParseResult {
    const demandPoints: DemandPoint[] = [];
    const stockPoints: StockPoint[] = [];
    const catalogRows: CatalogRow[] = [];
    const wipOrders: WipOrder[] = [];
    const capacityRows: OperationCapacityRow[] = [];
    const sheets: WorkbookSheetInfo[] = [];
    const warnings: string[] = [];
    let primaryDemandSheet: string | null = null;
    let primaryStockSheet: string | null = null;
    let primaryOperationSheet: string | null = null;

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as RawRows;
      const inspection = this.inspectSheet(sheetName, rows);
      sheets.push(inspection.info);
      if (!inspection.dataRows.length) return;

      switch (inspection.info.role) {
        case 'demand-vertical':
        case 'demand-horizontal':
          primaryDemandSheet ??= sheetName;
          demandPoints.push(...this.parseDemandSheet(inspection.info.role, inspection.headers, inspection.dataRows, sheetName));
          break;
        case 'stock':
          primaryStockSheet ??= sheetName;
          stockPoints.push(...this.parseStockSheet(inspection.headers, inspection.dataRows, sheetName));
          break;
        case 'catalog':
          catalogRows.push(...this.parseCatalogSheet(inspection.headers, inspection.dataRows, sheetName));
          break;
        case 'wip':
          primaryOperationSheet ??= sheetName;
          wipOrders.push(...this.parseWipSheet(inspection.headers, inspection.dataRows, sheetName));
          break;
        case 'capacity':
          primaryOperationSheet ??= sheetName;
          capacityRows.push(...this.parseCapacitySheet(inspection.headers, inspection.dataRows, sheetName));
          break;
        default:
          break;
      }
    });

    const mergedDemandPoints = this.mergeDemandPoints(demandPoints, warnings);
    const mergedStockPoints = this.mergeStockPoints(stockPoints);
    const cleanedCatalog = this.mergeCatalogRows(catalogRows);
    if (!mergedDemandPoints.length) warnings.push('No se detecto ninguna hoja de demanda util en el workbook.');
    if (!mergedStockPoints.length) warnings.push('No se detecto stock SAP; Riesgo permitira captura manual.');
    if (!capacityRows.length && !wipOrders.length) warnings.push('No se detectaron hojas operativas o de capacidad.');

    return {
      fileName,
      sheets,
      demandPoints: mergedDemandPoints,
      stockPoints: mergedStockPoints,
      catalogRows: cleanedCatalog,
      wipOrders,
      capacityRows,
      warnings,
      primaryDemandSheet,
      primaryStockSheet,
      primaryOperationSheet,
    };
  }

  static buildDemandSeries(demandPoints: DemandPoint[], stockPoints: StockPoint[], catalogRows: CatalogRow[]): DemandSeries[] {
    const stockLookup = this.buildStockLookup(stockPoints);
    const catalogLookup = new Map(catalogRows.map((row) => [row.material, row]));
    const grouped = new Map<string, DemandPoint[]>();
    demandPoints.forEach((point) => {
      const key = this.seriesKey(point.material, point.location);
      const bucket = grouped.get(key) ?? [];
      bucket.push(point);
      grouped.set(key, bucket);
    });

    return Array.from(grouped.entries()).map(([key, points]) => {
      const material = points[0].material;
      const location = points[0].location;
      const sourceSheets = this.unique(points.map((point) => point.sourceSheet));
      const periodMap = new Map<string, number>();
      points.forEach((point) => periodMap.set(point.period, this.round((periodMap.get(point.period) ?? 0) + point.demand)));
      const periods = this.expandMonthlyPeriods(Array.from(periodMap.keys()));
      const values = periods.map((period) => this.round(periodMap.get(period) ?? 0));
      const stock = stockLookup.get(key) ?? stockLookup.get(this.seriesKey(material, null)) ?? { value: null, location, source: 'missing' as StockSource, note: 'Sin stock cargado desde workbook.' };
      const catalog = catalogLookup.get(material) ?? null;
      const sourceFormat: DemandSeries['sourceFormat'] = sourceSheets.length > 1 ? 'mixed' : 'vertical';
      return {
        key,
        material,
        displayLabel: location ? `${material} - ${location}` : material,
        location,
        periods,
        values,
        points,
        observationCount: points.length,
        missingPeriods: periods.filter((period) => !periodMap.has(period)).length,
        sourceFormat,
        sourceSheets,
        stock,
        description: catalog?.description ?? null,
        type: catalog?.type ?? null,
        periodDays: this.inferPeriodDays(periods),
      };
    }).sort((left, right) => left.material.localeCompare(right.material) || (left.location ?? '').localeCompare(right.location ?? ''));
  }

  private static inspectSheet(sheetName: string, rows: RawRows): SheetInspection {
    const headerRowIndex = this.detectHeaderRow(rows);
    if (headerRowIndex == null) {
      return { info: { sheetName, role: 'unknown', confidence: 0, headerRowIndex: null, rowCount: rows.length, headers: [], notes: ['No se encontro encabezado interpretable.'] }, headers: [], dataRows: [] };
    }
    const headers = rows[headerRowIndex].map((value, index) => this.text(value) || `Columna ${index + 1}`);
    const dataRows = rows.slice(headerRowIndex + 1).filter((row) => row.some((cell) => this.text(cell) !== ''));
    const detected = this.detectSheetRole(sheetName, headers, dataRows);
    return {
      info: { sheetName, role: detected.role, confidence: detected.confidence, headerRowIndex, rowCount: dataRows.length, headers, notes: detected.notes },
      headers,
      dataRows,
    };
  }

  private static detectHeaderRow(rows: RawRows): number | null {
    const scanLimit = Math.min(rows.length, 20);
    let bestIndex: number | null = null;
    let bestScore = 0;
    for (let index = 0; index < scanLimit; index++) {
      const headers = rows[index].map((cell) => this.text(cell));
      const nonEmpty = headers.filter(Boolean);
      if (nonEmpty.length < 2) continue;
      const semanticHits = [
        this.findHeaderMatch(headers, this.demandMaterialHeaders).score,
        this.findHeaderMatch(headers, this.demandPeriodHeaders).score,
        this.findHeaderMatch(headers, this.demandValueHeaders).score,
        this.findHeaderMatch(headers, this.stockHeaders).score,
        this.findHeaderMatch(headers, this.modelHeaders).score,
        this.findHeaderMatch(headers, this.backlogHeaders).score,
        this.findHeaderMatch(headers, this.descriptionHeaders).score,
      ].filter((value) => value >= 70).length;
      const numericRowsBelow = rows.slice(index + 1, Math.min(index + 5, rows.length)).filter((row) => row.some((cell) => this.num(cell) != null)).length;
      const score = (semanticHits * 30) + (Math.min(nonEmpty.length, 10) * 3) + (numericRowsBelow * 8);
      if (semanticHits >= 3) return index;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    return bestScore >= 45 ? bestIndex : null;
  }

  private static detectSheetRole(sheetName: string, headers: string[], dataRows: RawRows): { role: WorkbookSheetInfo['role']; confidence: number; notes: string[] } {
    const material = this.findHeaderMatch(headers, this.demandMaterialHeaders);
    const period = this.findHeaderMatch(headers, this.demandPeriodHeaders);
    const demand = this.findHeaderMatch(headers, this.demandValueHeaders);
    const location = this.findHeaderMatch(headers, this.demandLocationHeaders);
    const stock = this.findHeaderMatch(headers, this.stockHeaders);
    const model = this.findHeaderMatch(headers, this.modelHeaders);
    const workOrder = this.findHeaderMatch(headers, this.workOrderHeaders);
    const backlog = this.findHeaderMatch(headers, this.backlogHeaders);
    const planned = this.findHeaderMatch(headers, this.plannedHeaders);
    const wip = this.findHeaderMatch(headers, this.wipHeaders);
    const leadTime = this.findHeaderMatch(headers, this.leadTimeHeaders);
    const description = this.findHeaderMatch(headers, this.descriptionHeaders);
    const horizontalPeriods = headers.filter((header, index) => this.normalizePeriod(header) != null && dataRows.some((row) => this.num(row[index]) != null)).length;

    const scores = {
      'demand-vertical': material.score + period.score + demand.score + Math.round(location.score * 0.35),
      'demand-horizontal': material.score + Math.min(100, horizontalPeriods * 18) + Math.round(location.score * 0.25),
      stock: material.score + stock.score + Math.round(location.score * 0.4) + Math.round(this.findHeaderMatch(headers, this.stockTransferHeaders).score * 0.2),
      wip: model.score + workOrder.score + planned.score + wip.score + Math.round(leadTime.score * 0.25),
      capacity: model.score + backlog.score + leadTime.score + Math.round(this.findHeaderMatch(headers, this.kitTimeHeaders).score * 0.3) + Math.round(this.findHeaderMatch(headers, this.bomHeaders).score * 0.25),
      catalog: material.score + description.score + Math.round(this.findHeaderMatch(headers, this.typeHeaders).score * 0.35),
      unknown: 0,
    } satisfies Record<WorkbookSheetInfo['role'], number>;

    const nameHint = this.normalizeHeader(sheetName);
    if (nameHint.includes('stock')) scores.stock += 16;
    if (nameHint.includes('catalog')) scores.catalog += 20;
    if (nameHint.includes('wip')) scores.wip += 18;
    if (nameHint.includes('capacidad')) scores.capacity += 20;
    if (nameHint.includes('demanda')) { scores['demand-vertical'] += 12; scores['demand-horizontal'] += 12; }

    const role = (Object.keys(scores) as WorkbookSheetInfo['role'][]).filter((item) => item !== 'unknown').sort((left, right) => scores[right] - scores[left])[0];
    const confidence = scores[role] ?? 0;
    if (confidence < 120) return { role: 'unknown', confidence, notes: ['La hoja no tiene suficiente señal semantica para clasificarla.'] };
    return { role, confidence, notes: [`Rol detectado: ${role}.`, `Confianza ${confidence}.`] };
  }

  private static parseDemandSheet(role: WorkbookSheetInfo['role'], headers: string[], dataRows: RawRows, sheetName: string): DemandPoint[] {
    return role === 'demand-vertical' ? this.parseDemandVertical(headers, dataRows, sheetName) : this.parseDemandHorizontal(headers, dataRows, sheetName);
  }

  private static parseDemandVertical(headers: string[], dataRows: RawRows, sheetName: string): DemandPoint[] {
    const materialIndex = this.findHeaderMatch(headers, this.demandMaterialHeaders).index;
    const periodIndex = this.findHeaderMatch(headers, this.demandPeriodHeaders).index;
    const demandIndex = this.findHeaderMatch(headers, this.demandValueHeaders).index;
    const locationIndex = this.findHeaderMatch(headers, this.demandLocationHeaders).index;
    if (materialIndex == null || periodIndex == null || demandIndex == null) return [];
    return dataRows.flatMap((row) => {
      const material = this.normalizeMaterial(row[materialIndex]);
      const period = this.normalizePeriod(row[periodIndex]);
      const demand = this.num(row[demandIndex]);
      if (!material || !period || demand == null) return [];
      return [{ material, location: locationIndex == null ? null : this.normalizeLocation(row[locationIndex]), period, demand: this.round(Math.max(0, demand)), sourceSheet: sheetName }];
    });
  }

  private static parseDemandHorizontal(headers: string[], dataRows: RawRows, sheetName: string): DemandPoint[] {
    const materialIndex = this.findHeaderMatch(headers, this.demandMaterialHeaders).index;
    const locationIndex = this.findHeaderMatch(headers, this.demandLocationHeaders).index;
    if (materialIndex == null) return [];
    const periodColumns = headers.map((header, index) => ({ index, period: this.normalizePeriod(header) })).filter((item) => item.period != null && dataRows.some((row) => this.num(row[item.index]) != null));
    return dataRows.flatMap((row) => {
      const material = this.normalizeMaterial(row[materialIndex]);
      if (!material) return [];
      const location = locationIndex == null ? null : this.normalizeLocation(row[locationIndex]);
      return periodColumns.flatMap((column) => {
        const demand = this.num(row[column.index]);
        if (demand == null || column.period == null) return [];
        return [{ material, location, period: column.period, demand: this.round(Math.max(0, demand)), sourceSheet: sheetName }];
      });
    });
  }

  private static parseStockSheet(headers: string[], dataRows: RawRows, sheetName: string): StockPoint[] {
    const materialIndex = this.findHeaderMatch(headers, this.demandMaterialHeaders).index;
    const locationIndex = this.findHeaderMatch(headers, this.demandLocationHeaders).index;
    const stockIndex = this.findHeaderMatch(headers, this.stockHeaders).index;
    const transferIndex = this.findHeaderMatch(headers, this.stockTransferHeaders).index;
    const blockedIndex = this.findHeaderMatch(headers, this.stockBlockedHeaders).index;
    const qualityIndex = this.findHeaderMatch(headers, this.stockQualityHeaders).index;
    if (materialIndex == null || stockIndex == null) return [];
    return dataRows.flatMap((row) => {
      const material = this.normalizeMaterial(row[materialIndex]);
      const unrestricted = this.num(row[stockIndex]);
      if (!material || unrestricted == null) return [];
      return [{
        material,
        location: locationIndex == null ? null : this.normalizeLocation(row[locationIndex]),
        unrestricted: this.round(Math.max(0, unrestricted)),
        inTransfer: this.round(Math.max(0, this.num(row[transferIndex ?? -1]) ?? 0)),
        blocked: this.round(Math.max(0, this.num(row[blockedIndex ?? -1]) ?? 0)),
        qualityHold: this.round(Math.max(0, this.num(row[qualityIndex ?? -1]) ?? 0)),
        sourceSheet: sheetName,
      }];
    });
  }

  private static parseCatalogSheet(headers: string[], dataRows: RawRows, sheetName: string): CatalogRow[] {
    const materialIndex = this.findHeaderMatch(headers, this.demandMaterialHeaders).index;
    const descriptionIndex = this.findHeaderMatch(headers, this.descriptionHeaders).index;
    const locationIndex = this.findHeaderMatch(headers, this.demandLocationHeaders).index;
    const typeIndex = this.findHeaderMatch(headers, this.typeHeaders).index;
    if (materialIndex == null) return [];
    return dataRows.flatMap((row) => {
      const material = this.normalizeMaterial(row[materialIndex]);
      if (!material) return [];
      return [{ material, description: descriptionIndex == null ? null : this.text(row[descriptionIndex]) || null, location: locationIndex == null ? null : this.normalizeLocation(row[locationIndex]), type: typeIndex == null ? null : this.text(row[typeIndex]) || null, sourceSheet: sheetName }];
    });
  }

  private static parseWipSheet(headers: string[], dataRows: RawRows, sheetName: string): WipOrder[] {
    const modelIndex = this.findHeaderMatch(headers, this.modelHeaders).index;
    const workOrderIndex = this.findHeaderMatch(headers, this.workOrderHeaders).index;
    const plannedIndex = this.findHeaderMatch(headers, this.plannedHeaders).index;
    const wipIndex = this.findHeaderMatch(headers, this.wipHeaders).index;
    const leadTimeIndex = this.findHeaderMatch(headers, this.leadTimeHeaders).index;
    const quantityIndex = this.findHeaderMatch(headers, this.quantityHeaders).index;
    const processIndex = this.findHeaderMatch(headers, this.processHeaders).index;
    const statusIndex = this.findHeaderMatch(headers, this.statusHeaders).index;
    const startTimeIndex = this.findHeaderMatch(headers, this.startTimeHeaders).index;
    if (modelIndex == null) return [];
    return dataRows.flatMap((row) => {
      const model = this.normalizeMaterial(row[modelIndex]);
      if (!model) return [];
      return [{
        model,
        workOrder: workOrderIndex == null ? null : this.text(row[workOrderIndex]) || null,
        planned: this.num(row[plannedIndex ?? -1]),
        wip: this.num(row[wipIndex ?? -1]),
        leadTime: this.num(row[leadTimeIndex ?? -1]),
        quantity: this.num(row[quantityIndex ?? -1]),
        process: processIndex == null ? null : this.text(row[processIndex]) || null,
        status: statusIndex == null ? null : this.text(row[statusIndex]) || null,
        startTime: startTimeIndex == null ? null : this.dateText(row[startTimeIndex]),
        sourceSheet: sheetName,
      }];
    });
  }

  private static parseCapacitySheet(headers: string[], dataRows: RawRows, sheetName: string): OperationCapacityRow[] {
    const modelIndex = this.findHeaderMatch(headers, this.modelHeaders).index;
    const stockIndex = this.findHeaderMatch(headers, this.stockHeaders).index;
    const backlogIndex = this.findHeaderMatch(headers, this.backlogHeaders).index;
    const leadTimeIndex = this.findHeaderMatch(headers, this.leadTimeHeaders).index;
    const criticalityIndex = this.findHeaderMatch(headers, this.criticalityHeaders).index;
    const kitTimeIndex = this.findHeaderMatch(headers, this.kitTimeHeaders).index;
    const bomIndex = this.findHeaderMatch(headers, this.bomHeaders).index;
    const clientPriorityIndex = this.findHeaderMatch(headers, this.clientPriorityHeaders).index;
    const marginImpactIndex = this.findHeaderMatch(headers, this.marginHeaders).index;
    const locationIndex = this.findHeaderMatch(headers, this.demandLocationHeaders).index;
    if (modelIndex == null) return [];
    return dataRows.flatMap((row) => {
      const model = this.normalizeMaterial(row[modelIndex]);
      if (!model) return [];
      return [{
        model,
        location: locationIndex == null ? null : this.normalizeLocation(row[locationIndex]),
        currentStock: this.num(row[stockIndex ?? -1]),
        backlog: this.num(row[backlogIndex ?? -1]),
        leadTime: this.num(row[leadTimeIndex ?? -1]),
        criticality: this.priority(row[criticalityIndex ?? -1], null),
        kitTimeMinutes: this.num(row[kitTimeIndex ?? -1]),
        bomAvailable: this.percent(row[bomIndex ?? -1], null),
        clientPriority: this.priority(row[clientPriorityIndex ?? -1], null),
        marginImpact: this.priority(row[marginImpactIndex ?? -1], null),
        sourceSheet: sheetName,
      }];
    });
  }

  private static mergeDemandPoints(points: DemandPoint[], warnings: string[]): DemandPoint[] {
    const grouped = new Map<string, DemandPoint>();
    points.forEach((point) => {
      const key = `${point.material}||${point.location ?? ''}||${point.period}`;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, point);
        return;
      }
      if (existing.demand === point.demand) return;
      warnings.push(`Se detecto conflicto de demanda para ${point.material} ${point.period}; se conservó el mayor valor entre hojas.`);
      grouped.set(key, existing.demand >= point.demand ? existing : point);
    });
    return Array.from(grouped.values());
  }

  private static mergeStockPoints(points: StockPoint[]): StockPoint[] {
    const grouped = new Map<string, StockPoint>();
    points.forEach((point) => {
      const key = this.seriesKey(point.material, point.location);
      const current = grouped.get(key);
      if (!current) {
        grouped.set(key, point);
        return;
      }
      current.unrestricted = this.round(current.unrestricted + point.unrestricted);
      current.inTransfer = this.round(current.inTransfer + point.inTransfer);
      current.blocked = this.round(current.blocked + point.blocked);
      current.qualityHold = this.round(current.qualityHold + point.qualityHold);
    });
    return Array.from(grouped.values());
  }

  private static mergeCatalogRows(rows: CatalogRow[]): CatalogRow[] {
    const grouped = new Map<string, CatalogRow>();
    rows.forEach((row) => {
      const existing = grouped.get(row.material);
      if (!existing) {
        grouped.set(row.material, row);
        return;
      }
      grouped.set(row.material, {
        ...existing,
        description: existing.description ?? row.description,
        location: existing.location ?? row.location,
        type: existing.type ?? row.type,
      });
    });
    return Array.from(grouped.values());
  }

  private static buildStockLookup(points: StockPoint[]): Map<string, StockSnapshot> {
    const lookup = new Map<string, StockSnapshot>();
    points.forEach((point) => {
      const key = this.seriesKey(point.material, point.location);
      lookup.set(key, {
        value: this.round(point.unrestricted),
        location: point.location,
        source: 'workbook',
        note: point.location ? `Stock SAP desde ${point.location}.` : 'Stock SAP cargado desde workbook.',
      });
      const materialKey = this.seriesKey(point.material, null);
      const existing = lookup.get(materialKey);
      lookup.set(materialKey, {
        value: this.round((existing?.value ?? 0) + point.unrestricted),
        location: existing?.location ?? point.location,
        source: 'workbook',
        note: 'Stock agregado por material desde SAP.',
      });
    });
    return lookup;
  }

  private static inferPeriodDays(periods: string[]): number {
    if (periods.length < 2) return 30;
    const dates = periods.map((period) => this.periodDate(period)).filter((value): value is Date => value instanceof Date);
    if (dates.length < 2) return 30;
    const deltas = dates.slice(1).map((date, index) => Math.max(1, Math.round((date.getTime() - dates[index].getTime()) / 86400000)));
    return Math.max(1, Math.round(this.avg(deltas)));
  }

  private static expandMonthlyPeriods(periods: string[]): string[] {
    const valid = this.unique(periods.filter(Boolean)).sort();
    if (!valid.length) return [];
    const first = this.periodDate(valid[0]);
    const last = this.periodDate(valid[valid.length - 1]);
    if (!(first instanceof Date) || !(last instanceof Date)) return valid;
    const items: string[] = [];
    const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
    const end = new Date(last.getFullYear(), last.getMonth(), 1);
    while (cursor <= end) {
      items.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return items;
  }

  private static normalizePeriod(value: unknown): string | null {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value) && value > 20000) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}`;
    }
    const raw = this.text(value);
    if (!raw) return null;
    const normalized = this.normalizeHeader(raw);
    const months: Record<string, string> = { ene: '01', enero: '01', jan: '01', january: '01', feb: '02', febrero: '02', february: '02', mar: '03', marzo: '03', march: '03', abr: '04', abril: '04', apr: '04', april: '04', may: '05', mayo: '05', jun: '06', junio: '06', june: '06', jul: '07', julio: '07', july: '07', ago: '08', agosto: '08', aug: '08', august: '08', sep: '09', sept: '09', septiembre: '09', september: '09', oct: '10', octubre: '10', october: '10', nov: '11', noviembre: '11', november: '11', dic: '12', diciembre: '12', dec: '12', december: '12' };
    const compact = normalized.match(/^(\d{4})(\d{2})$/);
    if (compact) return `${compact[1]}-${compact[2]}`;
    const yearMonth = normalized.match(/^(\d{4})[-/.\s](\d{1,2})$/);
    if (yearMonth) return `${yearMonth[1]}-${String(Number(yearMonth[2])).padStart(2, '0')}`;
    const monthYear = normalized.match(/^(\d{1,2})[-/.\s](\d{2,4})$/);
    if (monthYear) return `${monthYear[2].length === 2 ? `20${monthYear[2]}` : monthYear[2]}-${String(Number(monthYear[1])).padStart(2, '0')}`;
    const textYear = normalized.match(/^([a-z]+)[-/.\s]?(\d{2,4})$/);
    if (textYear && months[textYear[1]]) return `${textYear[2].length === 2 ? `20${textYear[2]}` : textYear[2]}-${months[textYear[1]]}`;
    const parsedDate = Date.parse(raw);
    if (Number.isFinite(parsedDate)) {
      const date = new Date(parsedDate);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    return null;
  }

  private static periodDate(period: string): Date | null {
    const match = period.match(/^(\d{4})-(\d{2})$/);
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : null;
  }

  private static findHeaderMatch(headers: string[], aliases: string[]): HeaderMatch {
    let best: HeaderMatch = { index: null, score: 0 };
    headers.forEach((header, index) => {
      const normalizedHeader = this.normalizeHeader(header);
      aliases.forEach((alias) => {
        const score = this.headerScore(normalizedHeader, this.normalizeHeader(alias));
        if (score > best.score) best = { index, score };
      });
    });
    return best;
  }

  private static headerScore(header: string, alias: string): number {
    if (!header || !alias) return 0;
    if (header === alias) return 100;
    const headerTokens = this.tokens(header);
    const aliasTokens = this.tokens(alias);
    if (!aliasTokens.length) return 0;
    if (alias.length <= 3) return headerTokens.includes(alias) ? 95 : 0;
    if (header.includes(alias) || alias.includes(header)) return 88;
    const overlap = aliasTokens.filter((token) => headerTokens.includes(token)).length;
    if (!overlap) return 0;
    const ratio = overlap / aliasTokens.length;
    if (ratio >= 1) return 84;
    if (ratio >= 0.66 && overlap >= 2) return 76;
    if (ratio >= 0.5 && headerTokens.length <= aliasTokens.length + 1) return 72;
    return 0;
  }

  private static normalizeHeader(value: unknown): string {
    return this.text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  private static normalizeMaterial(value: unknown): string {
    return this.text(value).toUpperCase();
  }

  private static normalizeLocation(value: unknown): string | null {
    const location = this.text(value).toUpperCase();
    return location || null;
  }

  private static dateText(value: unknown): string | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 20000) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    const raw = this.text(value);
    if (!raw) return null;
    const parsedDate = Date.parse(raw);
    return Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString().slice(0, 10) : raw;
  }

  private static num(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const raw = this.text(value);
    if (!raw || /^n\/?d$/i.test(raw)) return null;
    let normalized = raw.replace(/\s+/g, '');
    if (normalized.includes(',') && normalized.includes('.')) normalized = normalized.replace(/,/g, '');
    else if (normalized.includes(',') && !normalized.includes('.')) normalized = normalized.replace(/,/g, '.');
    const parsed = Number(normalized.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private static percent(value: unknown, fallback: number | null): number | null {
    const parsed = this.num(value);
    if (parsed == null) return fallback;
    if (parsed <= 1) return this.round(parsed * 100);
    return this.round(Math.max(0, Math.min(100, parsed)));
  }

  private static priority(value: unknown, fallback: number | null): number | null {
    const parsed = this.num(value);
    if (parsed == null) return fallback;
    if (parsed <= 1) return this.round(parsed * 100);
    if (parsed <= 5) return this.round(parsed * 20);
    if (parsed <= 10) return this.round(parsed * 10);
    return this.round(Math.max(0, Math.min(100, parsed)));
  }

  private static text(value: unknown): string {
    return value == null ? '' : String(value).trim();
  }

  private static tokens(value: string): string[] {
    return value.split(' ').filter(Boolean);
  }

  private static seriesKey(material: string, location: string | null): string {
    return location ? `${material}||${location}` : material;
  }

  private static unique<T>(items: T[]): T[] {
    return Array.from(new Set(items));
  }

  private static avg(values: number[]): number {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  private static round(value: number, decimals = 2): number {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
}
