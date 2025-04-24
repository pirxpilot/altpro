import test from 'node:test';
import findSegment from '../lib/find-segment.js';

test('find-segment', async t => {
  const data = Array.from({ length: 100 }, (_, i) => ({ elevation: i, distance: i * 10 }));

  await t.test('finds first segment', t => {
    t.assert.ok(findSegment(data, -1) < 0);
    t.assert.equal(findSegment(data, 0), 1);
    t.assert.equal(findSegment(data, 5), 1);
    t.assert.equal(findSegment(data, 10), 1);
  });

  await t.test('finds segment', t => {
    t.assert.equal(findSegment(data, 499), 50);
    t.assert.equal(findSegment(data, 500), 50);
    t.assert.equal(findSegment(data, 501), 51);
  });

  await t.test('finds last segment', t => {
    t.assert.equal(findSegment(data, 989), 99);
    t.assert.equal(findSegment(data, 990), 99);
    t.assert.ok(findSegment(data, 991) < 0);
  });
});
