import {
  assertPublicDomain,
  assertSeedCustomer,
  assertSeedModel,
  assertSeedPart,
  findForbiddenReason,
  isForbiddenValue,
  scrubForbidden,
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

  describe('scrubForbidden (anonimización para la purga)', () => {
    it('redacta el identificador completo si empieza con prefijo prohibido', () => {
      expect(scrubForbidden('OP-520-0100')).toBe('[REDACTED]');
    });

    it('redacta sólo el nombre de empresa real en texto libre', () => {
      expect(scrubForbidden('Resistencia para programa Optics')).toBe('Resistencia para programa [REDACTED]');
      expect(scrubForbidden('placa Motorola y Nvidia')).toBe('placa [REDACTED] y [REDACTED]');
    });

    it('NO toca texto de dominio público', () => {
      expect(scrubForbidden('AX-DRIVE-100')).toBe('AX-DRIVE-100');
      expect(scrubForbidden('ACME Robotics')).toBe('ACME Robotics');
    });

    it('el resultado YA NO es prohibido y es idempotente', () => {
      for (const v of ['OP-520-0100', 'placa Motorola', 'cliente Optics 2024']) {
        const once = scrubForbidden(v);
        expect(findForbiddenReason(once)).toBeNull();
        expect(scrubForbidden(once)).toBe(once);
      }
    });
  });

  describe('validateDemoCatalog', () => {
    it('valida TODO el catálogo demo sin lanzar (es de dominio público)', () => {
      expect(() => validateDemoCatalog()).not.toThrow();
      expect(validateDemoCatalog()).toBeGreaterThan(0);
    });
  });
});
