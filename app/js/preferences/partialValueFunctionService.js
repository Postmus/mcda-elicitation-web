'use strict';
define(['lodash', 'angular'], function(_, angular) {
  return angular.module('elicit.pvfService', []).factory('PartialValueFunction', function() {
    function findIndexOfFirstLargerElement(arr, val) {
      return _.indexOf(arr, _.find(arr, function(elm) {
        return elm >= val;
      })) || 1;
    }

    function findIndexOfFirstSmallerElement(arr, val) {
      return _.indexOf(arr, _.find(arr, function(elm) {
        return elm <= val;
      })) || 1;
    }

    function pvf(criterion) {
      var pvf = criterion.pvf;
      var increasing = isIncreasing(criterion);

      var cutoffs = pvf.cutoffs || [];

      cutoffs = [pvf.range[0]].concat(cutoffs);

      cutoffs.push(pvf.range[1]);

      var values = [increasing ? 0.0 : 1.0].concat(pvf.values || []);
      values.push(increasing ? 1.0 : 0.0);

      function atIndex(idx) {
        return {
          'x0': cutoffs[idx - 1],
          'x1': cutoffs[idx],
          'v0': values[idx - 1],
          'v1': values[idx]
        };
      }

      return {
        'isIncreasing': increasing,
        'values': values,
        'cutoffs': cutoffs,
        'atIndex': atIndex
      };
    }

    function map(criterion) {
      var f = pvf(criterion);
      return function(x) {
        var idx = findIndexOfFirstLargerElement(f.cutoffs, x);
        var i = f.atIndex(idx);
        return i.v0 + (x - i.x0) * ((i.v1 - i.v0) / (i.x1 - i.x0));
      };
    }

    function inv(criterion) {
      var f = pvf(criterion);
      return function(v) {
        var idx = !f.isIncreasing ? findIndexOfFirstSmallerElement(f.values, v) : findIndexOfFirstLargerElement(f.values, v);
        var i = f.atIndex(idx);
        return i.x0 + (v - i.v0) * ((i.x1 - i.x0) / (i.v1 - i.v0));
      };
    }

    function isIncreasing(criterion) {
      return criterion.pvf.direction === 'increasing';
    }

    function best(criterion) {
      return isIncreasing(criterion) ? criterion.pvf.range[1] : criterion.pvf.range[0];
    }

    function worst(criterion) {
      return isIncreasing(criterion) ? criterion.pvf.range[0] : criterion.pvf.range[1];
    }

    function getBounds(criterion) {
      return [worst(criterion), best(criterion)].sort(function(a, b) {
        return a - b;
      });
    }

    function _sortByValues(criterion) {
      /* sorts the values and cutoffs according to the values (y-axis)
       returns an object containing the values and cuttoffs */
      if(!criterion.pvf.cutoffs || !criterion.pvf.values) {
        return criterion;
      }
      var newCutoffs = criterion.pvf.cutoffs;
      var newValues = criterion.pvf.values;

      var list = [];
      for (var j = 0; j < newCutoffs.length; j++) {
        list.push({'cutoff': newCutoffs[j], 'value': newValues[j]});
      }
      list.sort(function(a,b) {
        return ((b.value < a.value) ? - 1 : ((b.value === a.value) ? 0 : 1));
      });

      for (var k = 0; k < list.length; k++) {
        newCutoffs[k] = list[k].cutoff;
        newValues[k] = list[k].value;
      }
      criterion.pvf.values = newValues;
      criterion.pvf.cutoffs = newCutoffs;
      return criterion;
    }

    function getXY(criterion) {
      var newCriterion = _sortByValues(angular.copy(criterion));

      var y = [1].concat(newCriterion.pvf.values || []).concat([0]);
      var x = [best(newCriterion)].concat(newCriterion.pvf.cutoffs || []).concat([worst(newCriterion)]);

      var values = _.map(_.zip(x, y), function(p) {
        return {
          x: p[0],
          y: p[1]
        };
      });
      return [{
        key: 'Partial Value Function',
        values: values
      }];
    }

    function standardizeCriterion(criterion) {
      var newCriterion = _.cloneDeep(criterion);
      if (newCriterion.pvf.type === 'linear') {
        delete newCriterion.pvf.values;
        delete newCriterion.pvf.cutoffs;
      } else if (newCriterion.pvf.type === 'piecewise-linear') {
        newCriterion.pvf.cutoffs = _.sortBy(newCriterion.pvf.cutoffs);
        newCriterion.pvf.values = _.sortBy(newCriterion.pvf.values);
        if (newCriterion.pvf.direction === 'decreasing') {
          newCriterion.pvf.values.reverse();
        }
      }
      return newCriterion;
    }

    return {
      isIncreasing: isIncreasing,
      map: map,
      inv: inv,
      best: best,
      worst: worst,
      getXY: getXY,
      getBounds: getBounds,
      standardizeCriterion:standardizeCriterion
    };
  });
});
