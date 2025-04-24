import test from 'node:test';
import JSDOM from 'jsdom-global';
import altpro from '../lib/altpro.js';

test('altpro', async t => {
  let jsdom;
  let ap;

  t.before(() => {
    jsdom = JSDOM();
  });

  t.after(() => {
    jsdom();
  });

  t.beforeEach(() => {
    document.body.innerHTML = '<div id="test"></div>';
  });

  t.afterEach(() => {
    ap.destroy();
  });

  await t.test('create canvas when attached', t => {
    const parent = document.getElementById('test');
    const data = [
      { elevation: 10, distance: 0 },
      { elevation: 20, distance: 10 },
      { elevation: 30, distance: 15 }
    ];

    ap = altpro(parent, data);
    t.assert.equal(parent.querySelectorAll('canvas').length, 2);
    t.assert.ok(parent.querySelector('.altpro-label'));
  });

  await t.test('display label on select', t => {
    const parent = document.getElementById('test');
    const data = [
      { elevation: 10, distance: 0 },
      { elevation: 20, distance: 10 },
      { elevation: 30, distance: 15 }
    ];

    ap = altpro(parent, data);
    const label = parent.querySelector('.altpro-label');

    ap.select(1);
    t.assert.equal(label.innerText, '20');
  });
});
