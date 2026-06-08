import { aggregateReactions, parseMentionTokens } from './messaging.service';

describe('aggregateReactions', () => {
  it('devuelve [] sin filas', () => {
    expect(aggregateReactions([], 'me')).toEqual([]);
  });

  it('agrupa por emoji, cuenta y preserva el orden de aparición', () => {
    const rows = [
      { emoji: '👍', userId: 'a' },
      { emoji: '❤️', userId: 'b' },
      { emoji: '👍', userId: 'c' },
    ];
    const out = aggregateReactions(rows, 'z');
    expect(out).toEqual([
      { emoji: '👍', count: 2, userIds: ['a', 'c'], mine: false },
      { emoji: '❤️', count: 1, userIds: ['b'], mine: false },
    ]);
  });

  it('marca mine cuando yo reaccioné', () => {
    const rows = [
      { emoji: '🎉', userId: 'me' },
      { emoji: '🎉', userId: 'x' },
    ];
    const out = aggregateReactions(rows, 'me');
    expect(out[0].mine).toBe(true);
    expect(out[0].count).toBe(2);
  });

  it('deduplica si llega el mismo usuario/emoji repetido', () => {
    const rows = [
      { emoji: '✅', userId: 'a' },
      { emoji: '✅', userId: 'a' },
    ];
    const out = aggregateReactions(rows, 'a');
    expect(out).toEqual([
      { emoji: '✅', count: 1, userIds: ['a'], mine: true },
    ]);
  });
});

describe('parseMentionTokens', () => {
  it('extrae handles en minúsculas, sin duplicados', () => {
    expect(parseMentionTokens('hola @Alice y @bob, @alice otra vez')).toEqual([
      'alice',
      'bob',
    ]);
  });

  it('ignora correos (@ pegado a un caracter de palabra)', () => {
    expect(parseMentionTokens('escribe a foo@bar.com porfa')).toEqual([]);
  });

  it('matchea al inicio de la cadena', () => {
    expect(parseMentionTokens('@neo despierta')).toEqual(['neo']);
  });

  it('soporta handles con punto, guion y guion bajo', () => {
    expect(parseMentionTokens('cc @ana.maria y @jose-luis y @x_1')).toEqual([
      'ana.maria',
      'jose-luis',
      'x_1',
    ]);
  });

  it('sin menciones → []', () => {
    expect(parseMentionTokens('texto sin menciones')).toEqual([]);
  });
});
