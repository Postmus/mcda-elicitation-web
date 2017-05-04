'use strict';
define(function(require) {
  var dependencies = [];
  var angular = require('angular');
  var _ = require('lodash');
  var ManualInputService = function() {
    // Exposed functions
    function createProblem(criteria, treatments, title, description, performanceTable) {
      var problem = {
        title: title,
        description: description,
        valueTree: {
          title: 'Benefit-risk balance',
          children: [{
            title: 'Favourable effects',
            criteria: _.map(_.filter(criteria, 'isFavorable'), 'name')
          }, {
            title: 'Unfavourable effects',
            criteria: _.map(_.reject(criteria, 'isFavorable'), 'name')
          }]
        },
        criteria: buildCriteria(criteria, performanceTable),
        alternatives: buildAlternatives(treatments),
        performanceTable: buildPerformanceTable(performanceTable, criteria, treatments)
      };
      return problem;
    }

    function preparePerformanceTable(criteria, treatments) {
      var inputData = {};
      _.forEach(criteria, function(criterion) {
        inputData[criterion.name] = {};
        _.forEach(treatments, function(treatment) {
          inputData[criterion.name][treatment.name] = 0;
        });
      });
      return inputData;
    }

    // Private functions
    function buildCriteria(criteria, performanceTable) {
      var newCriteria = _.map(criteria, function(criterion) {
        return {
          title: criterion.name,
          description: criterion.description,
          unitOfMeasurement: criterion.unitOfMeasurement,
          scale: getMinMax(criterion, performanceTable)
        };
      });
      return _.keyBy(newCriteria, 'title');
    }

    function buildAlternatives(treatments) {
      var alternatives = {};
      _.forEach(treatments, function(treatment) {
        alternatives[treatment.name] = {
          title: treatment.name
        };
      });
      return alternatives;
    }

    function buildPerformanceTable(performanceTable, criteria, treatments) {
      var newPerformanceTable = [];
      _.forEach(criteria, function(criterion) {
        _.forEach(treatments, function(treatment) {
          newPerformanceTable.push({
            alternative: treatment.name,
            criterion: criterion.name,
            performance: {
              type: 'exact',
              value: performanceTable[criterion.name][treatment.name]
            }
          });
        });
      });
      return newPerformanceTable;
    }

    function getMinMax(criterion, performanceTable) {
      var minimum = Infinity;
      var maximum = -Infinity;

      _.forEach(performanceTable[criterion.name], function(cell) {
        if (cell < minimum) {
          minimum = cell;
        }
        if (cell > maximum) {
          maximum = cell;
        }
      });
      return [minimum, maximum];
    }

    return {
      createProblem: createProblem,
      preparePerformanceTable: preparePerformanceTable
    };
  };

  return angular.module('elicit.manualInputService', dependencies).factory('ManualInputService', ManualInputService);
});