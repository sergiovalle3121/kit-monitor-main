import { aggregateReactions } from './messaging.service';

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
