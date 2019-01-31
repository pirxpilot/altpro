const findSegment = require('../lib/find-segment');

describe('find-segment', function () {
  before(function() {
    this.data = [];
    for (let i = 0; i < 100; i++) {
      this.data.push({ elevation: i, distance: i * 10});
    }
  });

  it('finds first segment', function () {
    findSegment(this.data, -1).should.be.below(0);
    findSegment(this.data, 0).should.eql(1);
    findSegment(this.data, 5).should.eql(1);
    findSegment(this.data, 10).should.eql(1);
  });

  it('finds segment', function () {
    findSegment(this.data, 499).should.eql(50);
    findSegment(this.data, 500).should.eql(50);
    findSegment(this.data, 501).should.eql(51);
  });

  it('finds last segment', function () {
    findSegment(this.data, 989).should.eql(99);
    findSegment(this.data, 990).should.eql(99);
    findSegment(this.data, 991).should.be.below(0);
  });

});
