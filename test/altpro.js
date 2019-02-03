const should = require('should');
const altpro = require('../');

describe('altpro', function () {
  before(function () {
    this.jsdom = require('jsdom-global')();
  });

  after(function () {
    this.jsdom();
  });

  beforeEach(function () {
    document.body.innerHTML = '<div id="test"></div>';
  });

  afterEach(function () {
    this.ap.destroy();
  });

  it('create canvas when attached', function () {
    const parent = document.getElementById('test');
    const data = [
      { elevation: 10, distance: 0 },
      { elevation: 20, distance: 10 },
      { elevation: 30, distance: 15 }
    ];

    this.ap = altpro(parent, data);
    parent.querySelectorAll('canvas').should.have.length(2);
    should.exist(parent.querySelector('.altpro-label'));
  });

  it('display label on select', function () {
    const parent = document.getElementById('test');
    const data = [
      { elevation: 10, distance: 0 },
      { elevation: 20, distance: 10 },
      { elevation: 30, distance: 15 }
    ];

    this.ap = altpro(parent, data);
    const label = parent.querySelector('.altpro-label');

    this.ap.select(1);
    label.innerText.should.eql('20');
  });

});
