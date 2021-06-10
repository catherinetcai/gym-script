const assert = require('assert');
const login = require('../login.js');
const expect = require("chai").expect;

describe('#parseLogins', function() {
  context('with string formatting', function() {
    it('should return an array of credentials', function() {
      expect(login.parseLogins("foo:bar,baz:poo")).to.deep.equal([["foo", "bar"], ["baz", "poo"]])
    });
  });
});

// If you decided to look up these dates, you'll notice that none of those are weekends.
// Well surprise! JS is being JS and the Date constructor has month be 0 indexed. THIS IS FINE.
describe('#isWeekend', function() {
  context('when saturday', function() {
    it('should return true', function() {
      let saturday = new Date(2021, 4, 22);
      expect(login.isWeekend(saturday)).to.be.true;
    });
  });
  context('when sunday', function() {
    it('should return true', function() {
      let sunday = new Date(2021, 4, 23);
      expect(login.isWeekend(sunday)).to.be.true;
    });
  });
  context('when not a weekend', function() {
    it('should return true', function() {
      let monday = new Date(2021, 4, 24);
      expect(login.isWeekend(monday)).to.be.false;
    });
  });
});
