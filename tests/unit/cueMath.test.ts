import { describe, expect, it } from 'vitest';
import { CuesSchema } from '../../src/data/schema';
import { buildCues } from '../../src/dev/cueMath';

describe('Cue Recorder export', () => {
  it('produces schema-valid, sorted, de-duplicated cues', () => {
    const cues = buildCues(
      [
        { id: 'B', t: 7.612 },
        { id: 'A', t: 4.004 },
        { id: 'A', t: 4.5 },
        { id: 'Z', t: 9 },
        { id: 'C', t: Number.NaN },
      ],
      ['A', 'B', 'C'],
    );
    expect(cues).toEqual([
      { id: 'A', t: 4 },
      { id: 'B', t: 7.61 },
    ]);
    expect(CuesSchema.safeParse(cues).success).toBe(true);
  });
});
