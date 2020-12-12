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

describe('#isWeekend', function() {
});
