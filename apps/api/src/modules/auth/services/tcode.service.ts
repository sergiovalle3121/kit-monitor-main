import { Injectable } from '@nestjs/common';
import { ExecuteTCodeDto } from '../dto/execute-tcode.dto';

export interface TCodeResult {
  success: boolean;
  data?: any;
  message: string;
  action?: string;
}

@Injectable()
export class TCodeService {
  private tCodes: Map<string, { description: string; category: string; handler: (params?: any) => Promise<TCodeResult> }> = new Map();

  constructor() {
    this.registerStandardTCodes();
  }

  private registerStandardTCodes() {
    // Logística - Gestión de Stock
    this.tCodes.set('MB52', {
      description: 'Visualizar stock de almacén',
      category: 'Logística',
      handler: async (params) => await this.handleMB52(params),
    });

    this.tCodes.set('MB51', {
      description: 'Lista de movimientos de material',
      category: 'Logística',
      handler: async (params) => await this.handleMB51(params),
    });

    this.tCodes.set('MMBE', {
      description: 'Resumen de stock de material',
      category: 'Logística',
      handler: async (params) => await this.handleMMBE(params),
    });

    // Compras
    this.tCodes.set('ME23N', {
      description: 'Visualizar pedido de compra',
      category: 'Compras',
      handler: async (params) => await this.handleME23N(params),
    });

    this.tCodes.set('ME2N', {
      description: 'Pedidos de compra por número de pedido',
      category: 'Compras',
      handler: async (params) => await this.handleME2N(params),
    });

    // Producción
    this.tCodes.set('CO03', {
      description: 'Visualizar orden de fabricación',
      category: 'Producción',
      handler: async (params) => await this.handleCO03(params),
    });

    this.tCodes.set('COOIS', {
      description: 'Sistema de información de órdenes',
      category: 'Producción',
      handler: async (params) => await this.handleCOOIS(params),
    });

    // Finanzas
    this.tCodes.set('FB03', {
      description: 'Visualizar documento contable',
      category: 'Finanzas',
      handler: async (params) => await this.handleFB03(params),
    });

    this.tCodes.set('FBL3N', {
      description: 'Cuentas de proveedor',
      category: 'Finanzas',
      handler: async (params) => await this.handleFBL3N(params),
    });

    // Calidad
    this.tCodes.set('QE51N', {
      description: 'Lista de resultados de inspección',
      category: 'Calidad',
      handler: async (params) => await this.handleQE51N(params),
    });

    // Ventas
    this.tCodes.set('VA03', {
      description: 'Visualizar pedido de venta',
      category: 'Ventas',
      handler: async (params) => await this.handleVA03(params),
    });

    // T-Code genérico para desarrollo futuro
    this.tCodes.set('HELP', {
      description: 'Mostrar ayuda de T-Codes disponibles',
      category: 'Sistema',
      handler: async () => await this.handleHelp(),
    });
  }

  async executeTCode(dto: ExecuteTCodeDto): Promise<TCodeResult> {
    const tcode = dto.tcode.toUpperCase();
    const tcodeInfo = this.tCodes.get(tcode);

    if (!tcodeInfo) {
      return {
        success: false,
        message: `T-Code '${dto.tcode}' no encontrado. Usa HELP para ver la lista disponible.`,
      };
    }

    try {
      const result = await tcodeInfo.handler(dto.params);
      return {
        ...result,
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error ejecutando ${tcode}: ${error.message}`,
      };
    }
  }

  getAllTCodes() {
    const result: Array<{ code: string; description: string; category: string; handler: (params?: any) => Promise<TCodeResult> }> = [];
    for (const [code, info] of this.tCodes.entries()) {
      result.push({ code, ...info });
    }
    return result;
  }

  searchTCodes(query: string) {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.tCodes.entries())
      .filter(([code, info]) => 
        code.toLowerCase().includes(lowerQuery) || 
        info.description.toLowerCase().includes(lowerQuery) ||
        info.category.toLowerCase().includes(lowerQuery)
      )
      .map(([code, info]) => ({ code, ...info }));
  }

  // Handlers específicos - Aquí iría la lógica real conectada a BD
  private async handleMB52(params?: any): Promise<TCodeResult> {
    // Simulación de consulta de stock
    return {
      success: true,
      message: 'Stock visualizado correctamente',
      action: 'VIEW_STOCK',
      data: {
        materials: [
          { material: 'MAT-001', description: 'Componente A', stock: 1500, unit: 'PCS', plant: 'PL01' },
          { material: 'MAT-002', description: 'Componente B', stock: 850, unit: 'PCS', plant: 'PL01' },
          { material: 'MAT-003', description: 'Materia Prima X', stock: 5000, unit: 'KG', plant: 'PL02' },
        ],
      },
    };
  }

  private async handleMB51(params?: any): Promise<TCodeResult> {
    return {
      success: true,
      message: 'Movimientos recuperados',
      action: 'VIEW_MOVEMENTS',
      data: {
        movements: [
          { date: '2024-06-01', material: 'MAT-001', movement: '101', quantity: 500, text: 'Entrada mercancías' },
          { date: '2024-06-02', material: 'MAT-002', movement: '261', quantity: 200, text: 'Salida para producción' },
        ],
      },
    };
  }

  private async handleMMBE(params?: any): Promise<TCodeResult> {
    return {
      success: true,
      message: 'Resumen de stock obtenido',
      action: 'STOCK_SUMMARY',
      data: { summary: 'Datos consolidados de stock por almacenes' },
    };
  }

  private async handleME23N(params?: any): Promise<TCodeResult> {
    return {
      success: true,
      message: 'Pedido de compra visualizado',
      action: 'VIEW_PO',
      data: { po: { number: '4500000001', vendor: 'PROVEEDOR A', total: 15000 } },
    };
  }

  private async handleME2N(params?: any): Promise<TCodeResult> {
    return {
      success: true,
      message: 'Lista de pedidos obtenida',
      action: 'LIST_PO',
      data: { orders: [{ number: '4500000001', vendor: 'PROVEEDOR A' }, { number: '4500000002', vendor: 'PROVEEDOR B' }] },
    };
  }

  private async handleCO03(params?: any): Promise<TCodeResult> {
    return {
      success: true,
      message: 'Orden de fabricación visualizada',
      action: 'VIEW_PRODUCTION_ORDER',
      data: { order: { number: '10000001', material: 'PROD-FINAL', quantity: 100, status: 'LIBERADA' } },
    };
  }

  private async handleCOOIS(params?: any): Promise<TCodeResult> {
    return {
      success: true,
      message: 'Información de órdenes obtenida',
      action: 'PRODUCTION_INFO',
      data: { orders: [{ number: '10000001', status: 'LIBERADA' }, { number: '10000002', status: 'EN PROCESO' }] },
    };
  }

  private async handleFB03(params?: any): Promise<TCodeResult> {
    return {
      success: true,
      message: 'Documento contable visualizado',
      action: 'VIEW_ACCOUNTING_DOC',
      data: { document: { number: '1000000001', amount: 5000, currency: 'USD' } },
    };
  }

  private async handleFBL3N(params?: any): Promise<TCodeResult> {
    return {
      success: true,
      message: 'Cuentas de proveedor obtenidas',
      action: 'VENDOR_ACCOUNTS',
      data: { accounts: [{ vendor: 'PROVEEDOR A', balance: 15000 }, { vendor: 'PROVEEDOR B', balance: 8500 }] },
    };
  }

  private async handleQE51N(params?: any): Promise<TCodeResult> {
    return {
      success: true,
      message: 'Resultados de inspección obtenidos',
      action: 'QUALITY_RESULTS',
      data: { results: [{ lot: '0100000001', status: 'ACEPTADO' }, { lot: '0100000002', status: 'RECHAZADO' }] },
    };
  }

  private async handleVA03(params?: any): Promise<TCodeResult> {
    return {
      success: true,
      message: 'Pedido de venta visualizado',
      action: 'VIEW_SALES_ORDER',
      data: { order: { number: '100000001', customer: 'CLIENTE A', total: 25000 } },
    };
  }

  private async handleHelp(): Promise<TCodeResult> {
    const tcodes = this.getAllTCodes();
    return {
      success: true,
      message: 'T-Codes disponibles',
      action: 'HELP',
      data: { tcodes },
    };
  }
}
