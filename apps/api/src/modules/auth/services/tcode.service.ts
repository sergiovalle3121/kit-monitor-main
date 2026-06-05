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
    // ==================== LOGÍSTICA Y GESTIÓN DE MATERIALES (MM) ====================
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

    this.tCodes.set('MIGO', {
      description: 'Movimiento de mercancías',
      category: 'Logística',
      handler: async (params) => await this.handleMIGO(params),
    });

    this.tCodes.set('MB1A', {
      description: 'Emisión de mercancías',
      category: 'Logística',
      handler: async (params) => await this.handleMB1A(params),
    });

    this.tCodes.set('MB1C', {
      description: 'Recepción de mercancías',
      category: 'Logística',
      handler: async (params) => await this.handleMB1C(params),
    });

    this.tCodes.set('MB1B', {
      description: 'Traslado de puesto/transferencia',
      category: 'Logística',
      handler: async (params) => await this.handleMB1B(params),
    });

    this.tCodes.set('MIRO', {
      description: 'Introducir factura entrante',
      category: 'Logística',
      handler: async (params) => await this.handleMIRO(params),
    });

    this.tCodes.set('MIR4', {
      description: 'Mostrar documento de factura',
      category: 'Logística',
      handler: async (params) => await this.handleMIR4(params),
    });

    this.tCodes.set('MM01', {
      description: 'Crear maestro de materiales',
      category: 'Logística',
      handler: async (params) => await this.handleMM01(params),
    });

    this.tCodes.set('MM02', {
      description: 'Modificar maestro de materiales',
      category: 'Logística',
      handler: async (params) => await this.handleMM02(params),
    });

    this.tCodes.set('MM03', {
      description: 'Visualizar maestro de materiales',
      category: 'Logística',
      handler: async (params) => await this.handleMM03(params),
    });

    // ==================== COMPRAS ====================
    this.tCodes.set('ME21N', {
      description: 'Crear orden de compra',
      category: 'Compras',
      handler: async (params) => await this.handleME21N(params),
    });

    this.tCodes.set('ME22N', {
      description: 'Modificar orden de compra',
      category: 'Compras',
      handler: async (params) => await this.handleME22N(params),
    });

    this.tCodes.set('ME23N', {
      description: 'Visualizar pedido de compra',
      category: 'Compras',
      handler: async (params) => await this.handleME23N(params),
    });

    this.tCodes.set('ME51N', {
      description: 'Crear solicitud de compra',
      category: 'Compras',
      handler: async (params) => await this.handleME51N(params),
    });

    this.tCodes.set('ME52N', {
      description: 'Modificar solicitud de compra',
      category: 'Compras',
      handler: async (params) => await this.handleME52N(params),
    });

    this.tCodes.set('ME53N', {
      description: 'Visualizar solicitud de compra',
      category: 'Compras',
      handler: async (params) => await this.handleME53N(params),
    });

    this.tCodes.set('ME2N', {
      description: 'Pedidos de compra por número de pedido',
      category: 'Compras',
      handler: async (params) => await this.handleME2N(params),
    });

    this.tCodes.set('ME2L', {
      description: 'Órdenes de compra por proveedor',
      category: 'Compras',
      handler: async (params) => await this.handleME2L(params),
    });

    this.tCodes.set('ME5A', {
      description: 'Lista de solicitudes de compra',
      category: 'Compras',
      handler: async (params) => await this.handleME5A(params),
    });

    this.tCodes.set('ME01', {
      description: 'Crear lista de fuentes',
      category: 'Compras',
      handler: async (params) => await this.handleME01(params),
    });

    // ==================== VENTAS Y DISTRIBUCIÓN (SD) ====================
    this.tCodes.set('VA01', {
      description: 'Crear pedido de venta',
      category: 'Ventas',
      handler: async (params) => await this.handleVA01(params),
    });

    this.tCodes.set('VA02', {
      description: 'Modificar pedido de venta',
      category: 'Ventas',
      handler: async (params) => await this.handleVA02(params),
    });

    this.tCodes.set('VA03', {
      description: 'Visualizar pedido de venta',
      category: 'Ventas',
      handler: async (params) => await this.handleVA03(params),
    });

    this.tCodes.set('VF01', {
      description: 'Crear documento de facturación',
      category: 'Ventas',
      handler: async (params) => await this.handleVF01(params),
    });

    this.tCodes.set('VF02', {
      description: 'Modificar documento de facturación',
      category: 'Ventas',
      handler: async (params) => await this.handleVF02(params),
    });

    this.tCodes.set('VF03', {
      description: 'Visualizar documento de facturación',
      category: 'Ventas',
      handler: async (params) => await this.handleVF03(params),
    });

    this.tCodes.set('VL01N', {
      description: 'Crear entrega saliente',
      category: 'Ventas',
      handler: async (params) => await this.handleVL01N(params),
    });

    this.tCodes.set('VL02N', {
      description: 'Modificar entrega saliente',
      category: 'Ventas',
      handler: async (params) => await this.handleVL02N(params),
    });

    this.tCodes.set('VL03N', {
      description: 'Visualizar entrega saliente',
      category: 'Ventas',
      handler: async (params) => await this.handleVL03N(params),
    });

    this.tCodes.set('VK11', {
      description: 'Crear condiciones de precios',
      category: 'Ventas',
      handler: async (params) => await this.handleVK11(params),
    });

    // ==================== PLANIFICACIÓN DE PRODUCCIÓN (PP) ====================
    this.tCodes.set('CO01', {
      description: 'Crear orden de producción',
      category: 'Producción',
      handler: async (params) => await this.handleCO01(params),
    });

    this.tCodes.set('CO02', {
      description: 'Modificar orden de producción',
      category: 'Producción',
      handler: async (params) => await this.handleCO02(params),
    });

    this.tCodes.set('CO03', {
      description: 'Visualizar orden de fabricación',
      category: 'Producción',
      handler: async (params) => await this.handleCO03(params),
    });

    this.tCodes.set('MD04', {
      description: 'Mostrar lista de requisitos de existencias (MRP)',
      category: 'Producción',
      handler: async (params) => await this.handleMD04(params),
    });

    this.tCodes.set('CO15', {
      description: 'Confirmación de orden de producción',
      category: 'Producción',
      handler: async (params) => await this.handleCO15(params),
    });

    this.tCodes.set('COOIS', {
      description: 'Sistema de información de órdenes',
      category: 'Producción',
      handler: async (params) => await this.handleCOOIS(params),
    });

    // ==================== CONTABILIDAD FINANCIERA (FI) ====================
    this.tCodes.set('FB01', {
      description: 'Documento financiero posterior',
      category: 'Finanzas',
      handler: async (params) => await this.handleFB01(params),
    });

    this.tCodes.set('FB50', {
      description: 'Introducir asiento contable en cuenta de mayor',
      category: 'Finanzas',
      handler: async (params) => await this.handleFB50(params),
    });

    this.tCodes.set('FBL1N', {
      description: 'Mostrar artículos de línea del proveedor',
      category: 'Finanzas',
      handler: async (params) => await this.handleFBL1N(params),
    });

    this.tCodes.set('FBL3N', {
      description: 'Mostrar partidas individuales de cuenta de mayor',
      category: 'Finanzas',
      handler: async (params) => await this.handleFBL3N(params),
    });

    this.tCodes.set('FBL5N', {
      description: 'Mostrar partidas del cliente',
      category: 'Finanzas',
      handler: async (params) => await this.handleFBL5N(params),
    });

    this.tCodes.set('F-53', {
      description: 'Pagos salientes',
      category: 'Finanzas',
      handler: async (params) => await this.handleF53(params),
    });

    this.tCodes.set('F-28', {
      description: 'Pagos entrantes',
      category: 'Finanzas',
      handler: async (params) => await this.handleF28(params),
    });

    this.tCodes.set('FS10N', {
      description: 'Mostrar saldo de cuenta de mayor',
      category: 'Finanzas',
      handler: async (params) => await this.handleFS10N(params),
    });

    this.tCodes.set('FB60', {
      description: 'Introducir factura del proveedor',
      category: 'Finanzas',
      handler: async (params) => await this.handleFB60(params),
    });

    this.tCodes.set('FB70', {
      description: 'Introducir factura del cliente',
      category: 'Finanzas',
      handler: async (params) => await this.handleFB70(params),
    });

    this.tCodes.set('FD32', {
      description: 'Gestión del crédito al cliente',
      category: 'Finanzas',
      handler: async (params) => await this.handleFD32(params),
    });

    // ==================== DATOS MAESTROS ====================
    this.tCodes.set('XD01', {
      description: 'Crear maestro de clientes',
      category: 'Datos Maestros',
      handler: async (params) => await this.handleXD01(params),
    });

    this.tCodes.set('XD02', {
      description: 'Modificar datos maestros del cliente',
      category: 'Datos Maestros',
      handler: async (params) => await this.handleXD02(params),
    });

    this.tCodes.set('XD03', {
      description: 'Visualizar maestro de clientes',
      category: 'Datos Maestros',
      handler: async (params) => await this.handleXD03(params),
    });

    this.tCodes.set('XK01', {
      description: 'Crear maestro de proveedores',
      category: 'Datos Maestros',
      handler: async (params) => await this.handleXK01(params),
    });

    this.tCodes.set('XK02', {
      description: 'Modificar maestro de proveedores',
      category: 'Datos Maestros',
      handler: async (params) => await this.handleXK02(params),
    });

    this.tCodes.set('XK03', {
      description: 'Visualizar maestro de proveedores',
      category: 'Datos Maestros',
      handler: async (params) => await this.handleXK03(params),
    });

    // ==================== SISTEMA Y BASIS ====================
    this.tCodes.set('SM37', {
      description: 'Monitoreo de trabajos en segundo plano',
      category: 'Sistema',
      handler: async (params) => await this.handleSM37(params),
    });

    this.tCodes.set('SM12', {
      description: 'Entradas de bloqueo (Lock entries)',
      category: 'Sistema',
      handler: async (params) => await this.handleSM12(params),
    });

    this.tCodes.set('SE11', {
      description: 'Diccionario de datos ABAP',
      category: 'Sistema',
      handler: async (params) => await this.handleSE11(params),
    });

    this.tCodes.set('SQVI', {
      description: 'Visor rápido de informes',
      category: 'Sistema',
      handler: async (params) => await this.handleSQVI(params),
    });

    this.tCodes.set('SU01', {
      description: 'Mantenimiento de usuarios',
      category: 'Sistema',
      handler: async (params) => await this.handleSU01(params),
    });

    // ==================== PAGOS DIGITALES (Digital Payment Add-on) ====================
    // Códigos de estado de transacción
    this.tCodes.set('DPTR01', {
      description: 'Transacción correcta (Digital Payment)',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handleDigitalPaymentStatus(params),
    });

    this.tCodes.set('DPTR02', {
      description: 'Transacción incorrecta (Digital Payment)',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handleDigitalPaymentStatus(params),
    });

    this.tCodes.set('DPTR03', {
      description: 'Transacción pendiente (Digital Payment)',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handleDigitalPaymentStatus(params),
    });

    this.tCodes.set('DPTR04', {
      description: 'Tiempo de espera finalizado (Digital Payment)',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handleDigitalPaymentStatus(params),
    });

    this.tCodes.set('DPTR05', {
      description: 'Transacción cancelada (Digital Payment)',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handleDigitalPaymentStatus(params),
    });

    // Estados de procesamiento
    this.tCodes.set('DPPS100', {
      description: 'Procesamiento finalizado correctamente',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handleProcessingStatus(params),
    });

    this.tCodes.set('DPPS201', {
      description: 'Límite de tarjeta/cuenta superado',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handleProcessingStatus(params),
    });

    this.tCodes.set('DPPS213', {
      description: 'Procesamiento cancelado por fraude',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handleProcessingStatus(params),
    });

    // Métodos de pago
    this.tCodes.set('DPMCC', {
      description: 'Tarjeta de crédito',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handlePaymentMethods(params),
    });

    this.tCodes.set('DPMPP', {
      description: 'PayPal',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handlePaymentMethods(params),
    });

    this.tCodes.set('DPMAP', {
      description: 'Apple Pay',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handlePaymentMethods(params),
    });

    this.tCodes.set('DPMGP', {
      description: 'Google Pay',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handlePaymentMethods(params),
    });

    this.tCodes.set('DPMKL', {
      description: 'Klarna',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handlePaymentMethods(params),
    });

    // Tipos de tarjeta
    this.tCodes.set('DPCVI', {
      description: 'Visa',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handleCardTypes(params),
    });

    this.tCodes.set('DPCMC', {
      description: 'Mastercard',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handleCardTypes(params),
    });

    this.tCodes.set('DPCAM', {
      description: 'American Express',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handleCardTypes(params),
    });

    // Proveedores de servicio de pago
    this.tCodes.set('DPSPADY', {
      description: 'Adyen',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handlePaymentProviders(params),
    });

    this.tCodes.set('DPSPSTR', {
      description: 'Stripe',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handlePaymentProviders(params),
    });

    this.tCodes.set('DPSP PYPL', {
      description: 'PayPal Braintree',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handlePaymentProviders(params),
    });

    // Riesgo de fraude
    this.tCodes.set('DPFRNONE', {
      description: 'Sin riesgo de fraude',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handleFraudRisk(params),
    });

    this.tCodes.set('DPFRELEV', {
      description: 'Riesgo de fraude elevado',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handleFraudRisk(params),
    });

    this.tCodes.set('DPFRSEV', {
      description: 'Riesgo de fraude grave',
      category: 'Pagos Digitales',
      handler: async (params) => await this.handleFraudRisk(params),
    });

    // T-Codes personalizados AXOS
    this.tCodes.set('ZSTOCK', {
      description: 'Reporte ejecutivo de inventario',
      category: 'Reportes AXOS',
      handler: async (params) => await this.handleZSTOCK(params),
    });

    this.tCodes.set('ZPROD', {
      description: 'KPIs de producción en tiempo real',
      category: 'Reportes AXOS',
      handler: async (params) => await this.handleZPROD(params),
    });

    this.tCodes.set('ZFIN', {
      description: 'Dashboard financiero consolidado',
      category: 'Reportes AXOS',
      handler: async (params) => await this.handleZFIN(params),
    });

    // Ayuda
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
