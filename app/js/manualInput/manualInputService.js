'use strict';
define(['lodash', 'angular'], function(_) {
  var dependencies = ['numberFilter'];
  var ManualInputService = function(numberFilter) {
    var distributionKnowledge = {
      exact: {
        toString: function(input) {
          if (distributionKnowledge.exact.isInvalidInput(input)) {
            return 'Missing or invalid input';
          } else {
            return 'exact(' + input.value + ')';
          }
        },
        isInvalidInput: function(input) {
          return isNullNaNOrUndefined(input.value);
        },
        buildPerformance: function(data) {
          return _.pick(data, ['type', 'value']);
        }
      },
      dnorm: {
        toString: function(input) {
          if (distributionKnowledge.dnorm.isInvalidInput(input)) {
            return 'Missing or invalid input';
          } else {
            return 'N(' + numberFilter(input.mu, 3) + ', ' + input.sigma + ')';
          }
        },
        isInvalidInput: function(input) {
          return isNullNaNOrUndefined(input.mu) || isNullNaNOrUndefined(input.sigma);
        },
        buildPerformance: function(data) {
          return {
            type: data.type,
            parameters: _.pick(data, ['mu', 'sigma'])
          };
        }
      },
      dbeta: {
        toString: function(input) {
          if (distributionKnowledge.dbeta.isInvalidInput(input)) {
            return 'Missing or invalid input';
          } else {
            return 'Beta(' + input.alpha + ', ' + input.beta + ')';
          }
        },
        isInvalidInput: function(input) {
          return isNullNaNOrUndefined(input.alpha) || input.alpha <= 0 || isNullNaNOrUndefined(input.beta) || input.beta <= 0;
        },
        buildPerformance: function(data) {
          return {
            type: data.type,
            parameters: _.pick(data, ['alpha', 'beta'])
          };
        }
      },
      dt: {
        toString: function(input) {
          if (distributionKnowledge.dt.isInvalidInput(input)) {
            return 'Missing or invalid input';
          } else {
            return 't(' + input.mu + ', ' + input.stdErr + ', ' + input.dof + ')';
          }
        },
        isInvalidInput: function(input) {
          return isNullNaNOrUndefined(input.mu) || isNullNaNOrUndefined(input.stdErr) || isNullNaNOrUndefined(input.dof);
        },
        buildPerformance: function(data) {
          return {
            type: data.type,
            parameters: _.pick(data, ['mu', 'stdErr', 'dof'])
          };
        }
      },
      dsurv: {
        toString: function(input) {
          if (distributionKnowledge.dsurv.isInvalidInput(input)) {
            return 'Missing or invalid input';
          } else {
            return 'Gamma(' + input.alpha + ', ' + input.beta + ')';
          }
        },
        isInvalidInput: function(input) {
          return isNullNaNOrUndefined(input.alpha) || input.alpha <= 0 || isNullNaNOrUndefined(input.beta) || input.beta <= 0;
        },
        buildPerformance: function(data, criterion) {
          var parameters = _.pick(data, ['alpha', 'beta']);
          parameters.summaryMeasure = criterion.summaryMeasure;
          if (criterion.summaryMeasure === 'survivalAtTime') {
            parameters.time = criterion.timePointOfInterest;
          }
          return {
            type: data.type,
            parameters: parameters
          };
        }
      }
    };

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
        criteria: buildCriteria(criteria),
        alternatives: buildAlternatives(treatments),
        performanceTable: buildPerformanceTable(performanceTable, criteria, treatments)
      };
      return problem;
    }

    function isOldDataInconsistent(newDataType, oldInput) {
      return newDataType === 'survival' && oldInput.type !== 'dsurv' ||
        oldInput.type === 'dsurv' && newDataType !== 'survival';
    }

    function determineInitialDistributionType(source, criterion) {
      if (source === 'study') {
        if (criterion.dataType === 'survival') {
          return 'dsurv';
        } else if (criterion.dataType === 'dichotomous') {
          return 'dbeta';
        } else if (criterion.dataType === 'continuous') {
          return 'dt';
        }
      } else { // direct distribution input
        return criterion.dataType === 'survival' ? 'dsurv' : 'exact';
      }

    }

    function prepareInputData(criteria, treatments, source, oldInputData) {
      var inputData = {};
      _.forEach(criteria, function(criterion) {
        inputData[criterion.hash] = {};
        var defaultData = {
          type: determineInitialDistributionType(source, criterion),
          value: undefined,
          source: source,
          isInvalid: true
        };
        _.forEach(treatments, function(treatment) {
          if (oldInputData && oldInputData[criterion.hash] && oldInputData[criterion.hash][treatment.hash]) {
            var oldInput = oldInputData[criterion.hash][treatment.hash];
            inputData[criterion.hash][treatment.hash] = isOldDataInconsistent(criterion.dataType, oldInput) ?
              defaultData : oldInput;
          } else {
            inputData[criterion.hash][treatment.hash] = defaultData;
          }
        });
      });
      return inputData;
    }

    function createDistribution(inputState, criterionType) {
      // Distribution input
      if (inputState.source === 'distribution') {
        return inputState;
      }

      // Study data input
      var newData = {};
      if (criterionType === 'dichotomous') {
        newData.alpha = inputState.count + 1;
        newData.beta = inputState.sampleSize - inputState.count + 1;
        newData.type = 'dbeta';
      } else if (criterionType === 'continuous') {
        newData.mu = inputState.mu; // All these possibilities have a mu
        if (inputState.continuousType === 'SEnorm') {
          newData.sigma = inputState.stdErr;
          newData.type = 'dnorm';
        } else if (inputState.continuousType === 'SDnorm') {
          newData.sigma = inputState.sigma / Math.sqrt(inputState.sampleSize);
          newData.type = 'dnorm';
        } else if (inputState.continuousType === 'SEt') {
          newData.stdErr = inputState.stdErr;
          newData.dof = inputState.sampleSize - 1;
          newData.type = 'dt';
        } else if (inputState.continuousType === 'SDt') {
          newData.stdErr = inputState.sigma / Math.sqrt(inputState.sampleSize);
          newData.dof = inputState.sampleSize - 1;
          newData.type = 'dt';
        }
      } else if (criterionType === 'survival') {
        // survival
        if (_.isNumber(inputState.events) && _.isNumber(inputState.exposure)) {
          newData.alpha = inputState.events + 0.001;
          newData.beta = inputState.exposure + 0.001;
        }
        newData.type = 'dsurv';
      }
      return newData;
    }

    function isInvalidCell(cell) {
      return distributionKnowledge[cell.type].isInvalidInput(cell);
    }

    function buildScale(criterion) {
      var scale;
      if (criterion.dataType === 'dichotomous') {
        scale = [0, 1];
      } else if (criterion.dataType === 'continuous') {
        scale = [-Infinity, Infinity];
      } else if (criterion.dataType === 'survival') {
        if (criterion.summaryMeasure === 'mean' || criterion.summaryMeasure === 'median') {
          scale = [0, Infinity];
        } else if (criterion.summaryMeasure === 'survivalAtTime') {
          scale = [0, 1];
        }
      } else {
        scale = [-Infinity, Infinity];
      }
      return scale;
    }

    // Private functions
    function buildCriteria(criteria) {
      var newCriteria = _.map(criteria, function(criterion) {
        return {
          title: criterion.name,
          description: criterion.description,
          unitOfMeasurement: criterion.unitOfMeasurement,
          scale: buildScale(criterion),
          source: criterion.source,
          sourceLink: criterion.sourceLink
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

    function buildPerformanceTable(inputData, criteria, treatments) {
      var newPerformanceTable = [];
      _.forEach(criteria, function(criterion) {
        _.forEach(treatments, function(treatment) {
          var data = createDistribution(inputData[criterion.hash][treatment.hash], criterion.dataType);
          newPerformanceTable.push({
            alternative: treatment.name,
            criterion: criterion.name,
            performance: distributionKnowledge[data.type].buildPerformance(data, criterion)
          });
        });
      });
      return newPerformanceTable;
    }

    function isNullNaNOrUndefined(value) {
      return isNullOrUndefined(value) || isNaN(value);
    }

    function isNullOrUndefined(value) {
      return value === null || value === undefined;
    }

    function inputToString(inputData) {
      return distributionKnowledge[inputData.type].toString(inputData);
    }

    return {
      createProblem: createProblem,
      createDistribution: createDistribution,
      prepareInputData: prepareInputData,
      inputToString: inputToString,
      isInvalidCell: isInvalidCell
    };
  };

  return dependencies.concat(ManualInputService);
});