const { describe, before, after, beforeEach, afterEach, it } = require('node:test');
const altpro = require('../');

describe('altpro', () => {
  let jsdom;
  let ap;

  before(() => {
    jsdom = require('jsdom-global')();
  });

  after(() => {
    jsdom();
  });

  beforeEach(() => {
    document.body.innerHTML = '<div id="test"></div>';
  });

  afterEach(() => {
    ap.destroy();
  });

  it('create canvas when attached', t => {
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

  it('display label on select', t => {
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
