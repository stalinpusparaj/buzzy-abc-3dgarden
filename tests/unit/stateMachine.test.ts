import { describe, expect, it } from 'vitest';
import { StateMachine } from '../../src/core/stateMachine';

describe('StateMachine', () => {
  it('exits the old state before entering the new one, passing params', () => {
    const log: string[] = [];
    const m = new StateMachine<{ a: void; b: { n: number } }>();
    m.register('a', { enter: () => void log.push('enter a'), exit: () => void log.push('exit a') });
    m.register('b', {
      enter: (p) => void log.push(`enter b ${p.n}`),
      exit: () => void log.push('exit b'),
    });
    m.go('a', undefined);
    m.go('b', { n: 7 });
    expect(log).toEqual(['enter a', 'exit a', 'enter b 7']);
    expect(m.current).toBe('b');
  });
});
