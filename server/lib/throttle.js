'use strict';

class Throttle {
  constructor(options) {
    this.options = {};
    this.options.period = options.period || 5000;
    this.options.maxCalls = options.maxCalls || 1;

    this.callHistory = [];

  }

  get record() {
    return this.callHistory.push(Date.now());
  }

  prune() {
    var windowStart = Date.now() - this.options.period;
    while(this.callHistory.length && this.callHistory[0] < windowStart) {
      this.callHistory.shift();
    }
  }

  get canCall() {
    this.prune();
    return this.callHistory.length < this.options.maxCalls;
  }

  call(func) {
    if(this.canCall) {
      this.record();
      func();
      return true;
    }
    return false;
  }
}

module.exports = Throttle;
