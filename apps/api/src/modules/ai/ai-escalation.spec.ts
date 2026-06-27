import { chooseModel, shouldEscalate } from './ai-escalation';

describe('shouldEscalate', () => {
  it('keeps short factual questions on the default model', () => {
    expect(shouldEscalate('¿Cómo está el inventario?')).toBe(false);
    expect(shouldEscalate('¿Cómo va la planta hoy?')).toBe(false);
    expect(shouldEscalate('')).toBe(false);
  });

  it('escalates clearly analytical asks (two or more cues)', () => {
    expect(
      shouldEscalate('Analiza por qué bajó el OEE y compara con el mes pasado'),
    ).toBe(true);
    expect(
      shouldEscalate('Recomienda una estrategia para optimizar el inventario'),
    ).toBe(true);
  });

  it('escalates a single analytical cue on a long prompt', () => {
    const long =
      'Necesito que analices el comportamiento de la línea SMT durante el ' +
      'último trimestre considerando los paros no planeados y el scrap por turno';
    expect(shouldEscalate(long)).toBe(true);
  });

  it('escalates very long prompts even without explicit cues', () => {
    expect(shouldEscalate('detalle '.repeat(40))).toBe(true);
  });

  it('does not escalate a single cue on a short prompt', () => {
    expect(shouldEscalate('compara A y B')).toBe(false);
  });
});

describe('chooseModel', () => {
  const base = {
    defaultModel: 'qwen2.5:7b',
    escalationModel: 'qwen2.5:32b',
  };

  it('honours an explicit model and never escalates it', () => {
    const r = chooseModel({
      ...base,
      explicit: 'qwen2.5:14b',
      message: 'Analiza la causa raíz y compara tendencias',
      autoEscalate: true,
    });
    expect(r).toEqual({ model: 'qwen2.5:14b', escalated: false });
  });

  it('uses the default model when auto-escalation is off', () => {
    const r = chooseModel({
      ...base,
      message: 'Analiza la causa raíz y compara tendencias',
      autoEscalate: false,
    });
    expect(r).toEqual({ model: 'qwen2.5:7b', escalated: false });
  });

  it('escalates analytical asks when enabled', () => {
    const r = chooseModel({
      ...base,
      message: 'Analiza la causa raíz y compara tendencias del scrap',
      autoEscalate: true,
    });
    expect(r).toEqual({ model: 'qwen2.5:32b', escalated: true });
  });

  it('stays on default for simple asks even when enabled', () => {
    const r = chooseModel({
      ...base,
      message: '¿Cómo está el inventario?',
      autoEscalate: true,
    });
    expect(r).toEqual({ model: 'qwen2.5:7b', escalated: false });
  });

  it('does not escalate when both tiers are the same model', () => {
    const r = chooseModel({
      defaultModel: 'qwen2.5:7b',
      escalationModel: 'qwen2.5:7b',
      message: 'Analiza la causa raíz y compara tendencias',
      autoEscalate: true,
    });
    expect(r).toEqual({ model: 'qwen2.5:7b', escalated: false });
  });
});
