import {
  computeAgingMinutes,
  effectiveSla,
  isSlaBreached,
  pullSemaphore,
  DEFAULT_PULL_SLA_MINUTES,
} from './pull.util';

/**
 * Cálculo de AGING y SLA del pull (semáforo del monitor). Funciones puras: se
 * prueban directo sin repos ni Nest.
 */
describe('pull.util — aging / SLA', () => {
  const now = new Date('2026-06-23T12:00:00Z');

  describe('computeAgingMinutes', () => {
    it('cuenta de createdAt a ahora cuando el pull sigue abierto', () => {
      const created = new Date('2026-06-23T11:00:00Z'); // 60 min antes
      expect(computeAgingMinutes(created, null, now)).toBe(60);
    });

    it('cuenta de createdAt a deliveredAt cuando el pull ya cerró', () => {
      const created = new Date('2026-06-23T10:00:00Z');
      const delivered = new Date('2026-06-23T10:45:00Z'); // 45 min de suministro
      expect(computeAgingMinutes(created, delivered, now)).toBe(45);
    });

    it('nunca es negativo y tolera fechas inválidas/ausentes', () => {
      expect(computeAgingMinutes(null, null, now)).toBe(0);
      expect(computeAgingMinutes('no-fecha', null, now)).toBe(0);
      const future = new Date('2026-06-23T13:00:00Z');
      expect(computeAgingMinutes(future, null, now)).toBe(0);
    });
  });

  describe('effectiveSla', () => {
    it('usa el SLA del pull cuando es válido', () => {
      expect(effectiveSla(30)).toBe(30);
    });
    it('cae al default cuando no hay SLA o es <= 0', () => {
      expect(effectiveSla(undefined)).toBe(DEFAULT_PULL_SLA_MINUTES);
      expect(effectiveSla(0)).toBe(DEFAULT_PULL_SLA_MINUTES);
      expect(effectiveSla(null)).toBe(DEFAULT_PULL_SLA_MINUTES);
    });
  });

  describe('isSlaBreached', () => {
    it('rojo cuando el aging supera el SLA del pull', () => {
      expect(isSlaBreached(61, 60)).toBe(true);
      expect(isSlaBreached(60, 60)).toBe(false);
    });
    it('aplica el SLA por defecto cuando el pull no trae uno', () => {
      expect(isSlaBreached(DEFAULT_PULL_SLA_MINUTES + 1, undefined)).toBe(true);
      expect(isSlaBreached(DEFAULT_PULL_SLA_MINUTES - 1, undefined)).toBe(false);
    });
  });

  describe('pullSemaphore', () => {
    it('verde / ámbar (>=75% del SLA) / rojo (>SLA)', () => {
      expect(pullSemaphore(10, 100)).toBe('green');
      expect(pullSemaphore(75, 100)).toBe('amber');
      expect(pullSemaphore(90, 100)).toBe('amber');
      expect(pullSemaphore(101, 100)).toBe('red');
    });
  });
});
