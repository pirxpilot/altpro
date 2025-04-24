import { describe, it } from 'node:test';
import findSegment from '../lib/find-segment.js';

describe('find-segment', () => {
  const data = [];
  for (let i = 0; i < 100; i++) {
    data.push({ elevation: i, distance: i * 10 });
  }

  it('finds first segment', t => {
    t.assert.ok(findSegment(data, -1) < 0);
    t.assert.equal(findSegment(data, 0), 1);
    t.assert.equal(findSegment(data, 5), 1);
    t.assert.equal(findSegment(data, 10), 1);
  });

  it('finds segment', t => {
    t.assert.equal(findSegment(data, 499), 50);
    t.assert.equal(findSegment(data, 500), 50);
    t.assert.equal(findSegment(data, 501), 51);
  });

  it('finds last segment', t => {
    t.assert.equal(findSegment(data, 989), 99);
    t.assert.equal(findSegment(data, 990), 99);
    t.assert.ok(findSegment(data, 991) < 0);
  });
});
