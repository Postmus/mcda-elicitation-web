function ScaleRangeHandler(problem, Tasks) {
  this.fields = [];

  var log10 = function(x) { return Math.log(x) / Math.log(10); };
  var nice = function(x) {
    var negative = x < 0;
    x = Math.abs(x);
    var val = Math.pow(10, Math.floor(log10(x)));
    var nice = _.find(_.range(1, 11), function(n) {
      return x <= val * n;
    });
    return (negative ? -1 : 1) * (val * nice);
  }

  this.initialize = function(state) {
    var data = _.extend(angular.copy(problem), { "method": "scales" });
    var task = Tasks.submit("smaa", data);
    var scales = {};
    var choices = {};
    task.results.then(function(results) {
      _.map(_.pairs(results.body[0]), function(criterion) {
        var from = criterion[1]["2.5%"], to = criterion[1]["97.5%"];
        var margin = 0.25;
        // Set inital model value
        var problemRange = problem.criteria[criterion[0]].pvf.range;
        if (problemRange) {
          choices[criterion[0]] = { lower: problemRange[0], upper: problemRange[1] };
        } else {
          choices[criterion[0]] = { lower: from, upper: to};
        }
        // Set scales for slider
        scales[criterion[0]] =
          { restrictFrom: from,
            restrictTo: to,
            from: nice(from) - (((from < 0) ? -1 : 1) * (nice(from) * margin)),
            to: nice(to) + (((from < 0) ? -1 : 1) * (nice(from) * margin)),
            rightOpen: true };
      });
    });
    return {
      title: "Measurement scales",
      type: "scale range",
      scales: scales,
      choice: choices
    };
  }

  this.validChoice = function(currentState) {
    return true;
  }

  this.nextState = function(currentState) {
    if(!this.validChoice(currentState)) {
      return;
    }

    // Rewrite scale information
    _.each(_.pairs(currentState.choice), function(choice) {
      problem.criteria[choice[0]].pvf.range = [choice[1].lower, choice[1].upper];
    });

    var nextState = angular.copy(currentState);
    nextState.type = "ordinal"
    return nextState;
  }

  return this;
}
