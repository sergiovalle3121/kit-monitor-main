import {
  assertPublicDomain,
  assertSeedCustomer,
  assertSeedModel,
  assertSeedPart,
  findForbiddenReason,
  isForbiddenValue,
  validateDemoCatalog,
} from './public-domain-guard';

describe('public-domain-guard (candado legal del seed)', () => {
  describe('assertPublicDomain', () => {
    it('lanza con prefijo de cliente prohibido OP-', () => {
      expect(() => assertPublicDomain('OP-520-0100')).toThrow(/dominio público/i);
    });

    it('lanza con nombres de empresas reales (palabra completa, case-insensitive)', () => {
      expect(() => assertPublicDomain('Motorola Solutions')).toThrow();
      expect(() => assertPublicDomain('Programa Optics 2024')).toThrow();
      expect(() => assertPublicDomain('placa nvidia')).toThrow();
    });

    it('NO lanza con datos del universo AXOS / commodities genéricos', () => {
      expect(() => assertPublicDomain('AX-DRIVE-100')).not.toThrow();
      expect(() => assertPublicDomain('RES-10K-0402')).not.toThrow();
      expect(() => assertPublicDomain('Axos Mobility')).not.toThrow();
      expect(() => assertPublicDomain('Capacitor 100nF 0603 X7R')).not.toThrow();
    });

    it('NO confunde subcadenas legítimas (sin falsos positivos por \\b)', () => {
      // "metadata" no contiene la palabra "meta"; "flexible" no es "flex"
      expect(isForbiddenValue('metadata flexible')).toBe(false);
      // "ACME Robotics" y "Robotics Cell" son genéricos permitidos
      expect(isForbiddenValue('ACME Robotics')).toBe(false);
      expect(isForbiddenValue('Robotics Cell 3')).toBe(false);
    });
  });

  describe('findForbiddenReason', () => {
    it('devuelve el motivo o null', () => {
      expect(findForbiddenReason('OP-520-0001')).toMatch(/prefijo/i);
      expect(findForbiddenReason('Apple Inc')).toMatch(/empresa real/i);
      expect(findForbiddenReason('AX-POWER-200')).toBeNull();
      expect(findForbiddenReason(null)).toBeNull();
    });
  });

  describe('asserts especializados', () => {
    it('assertSeedModel exige prefijo AX-', () => {
      expect(() => assertSeedModel('AX-DRIVE-100')).not.toThrow();
      expect(() => assertSeedModel('MDL-00001')).toThrow(/AX-/);
      expect(() => assertSeedModel('OP-DEVICE-900')).toThrow();
    });

    it('assertSeedPart exige prefijo permitido (AX- o commodity)', () => {
      expect(() => assertSeedPart('RES-10K-0402')).not.toThrow();
      expect(() => assertSeedPart('PCB-AX100-4L')).not.toThrow();
      expect(() => assertSeedPart('OP-520-0100')).toThrow();
      expect(() => assertSeedPart('FOO-123')).toThrow(/prefijo permitido/);
    });

    it('assertSeedCustomer exige universo Axos (o ACME)', () => {
      expect(() => assertSeedCustomer('Axos Mobility')).not.toThrow();
      expect(() => assertSeedCustomer('ACME Robotics')).not.toThrow();
      expect(() => assertSeedCustomer('Motorola')).toThrow();
      expect(() => assertSeedCustomer('Cliente Genérico')).toThrow(/universo Axos/);
    });
  });

  describe('validateDemoCatalog', () => {
    it('valida TODO el catálogo demo sin lanzar (es de dominio público)', () => {
      expect(() => validateDemoCatalog()).not.toThrow();
      expect(validateDemoCatalog()).toBeGreaterThan(0);
    });
  });
});
