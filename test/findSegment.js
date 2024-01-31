const { describe, it } = require('node:test');
const findSegment = require('../lib/find-segment');

describe('find-segment', function () {
  const data = [];
  for (let i = 0; i < 100; i++) {
    data.push({ elevation: i, distance: i * 10 });
  }

  it('finds first segment', function () {
    findSegment(data, -1).should.be.below(0);
    findSegment(data, 0).should.eql(1);
    findSegment(data, 5).should.eql(1);
    findSegment(data, 10).should.eql(1);
  });

  it('finds segment', function () {
    findSegment(data, 499).should.eql(50);
    findSegment(data, 500).should.eql(50);
    findSegment(data, 501).should.eql(51);
  });

  it('finds last segment', function () {
    findSegment(data, 989).should.eql(99);
    findSegment(data, 990).should.eql(99);
    findSegment(data, 991).should.be.below(0);
  });

});
