import { approvalEventDetail } from './line-approval';

describe('approvalEventDetail (Fase 50)', () => {
  it('labels the three lifecycle states in Spanish', () => {
    expect(approvalEventDetail({ status: 'draft' }).title).toBe('Cambió aprobación a borrador');
    expect(approvalEventDetail({ status: 'in_review' }).title).toBe('Cambió aprobación a en revisión');
    expect(approvalEventDetail({ status: 'approved' }).title).toBe('Cambió aprobación a aprobado');
  });

  it('stamps the grade and score when present', () => {
    const r = approvalEventDetail({ status: 'approved', grade: 'B', score: 88.4, blockers: 0 });
    expect(r.detail).toBe('grado B · 88/100');
  });

  it('appends the open blocker count (pluralised)', () => {
    expect(approvalEventDetail({ status: 'in_review', grade: 'C', score: 64, blockers: 2 }).detail)
      .toBe('grado C · 64/100 · 2 bloqueos');
    expect(approvalEventDetail({ status: 'in_review', grade: 'C', score: 64, blockers: 1 }).detail)
      .toBe('grado C · 64/100 · 1 bloqueo');
  });

  it('shows the grade alone when the score is missing', () => {
    expect(approvalEventDetail({ status: 'approved', grade: 'A' }).detail).toBe('grado A');
  });

  it('has an empty detail when no review was stamped (e.g. back to draft)', () => {
    expect(approvalEventDetail({ status: 'draft' }).detail).toBe('');
  });

  it('falls back to the raw status and is null-safe', () => {
    expect(approvalEventDetail({ status: 'weird' }).title).toBe('Cambió aprobación a weird');
    expect(approvalEventDetail(null)).toEqual({ title: 'Cambió aprobación a —', detail: '' });
    // garbage review fields never throw and never leak into the detail
    expect(approvalEventDetail({ status: 'approved', grade: 5, score: 'x', blockers: -3 }).detail).toBe('');
  });
});
