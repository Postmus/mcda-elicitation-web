'use strict';
define(['lodash', 'angular'], function(_) {
  var dependencies = ['ScalesService', 'sortCriteriaWithW'];

  var WorkspaceService = function(ScalesService, sortCriteriaWithW) {

    function buildValueTree(problem) {
      if (problem.valueTree) {
        return problem.valueTree;
      } else {
        return {
          'title': 'Overall value',
          'criteria': _.keys(problem.criteria)
        };
      }
    }

    function buildTheoreticalScales(problem) {
      return _.fromPairs(_.map(problem.criteria, function(val, key) {
        var scale = val.scale || [null, null];
        scale[0] = _.isNull(scale[0]) ? -Infinity : scale[0];
        scale[1] = _.isNull(scale[1]) ? Infinity : scale[1];
        return [key, scale];
      }));
    }

    function getObservedScales(scope, problem) {
      return ScalesService.getObservedScales(scope, problem);
    }

    function reduceProblem(problem) {
      var criteria = _.reduce(problem.criteria, function(accum, criterion, key) {
        accum[key] = _.pick(criterion, ['scale', 'pvf']);
        return accum;
      }, {});
      return {
        criteria: criteria
      };
    }

    function mergeBaseAndSubProblem(baseProblem, subProblemDefinition) {
      var newProblem = _.cloneDeep(baseProblem);
      if (subProblemDefinition.excludedCriteria) {
        newProblem.criteria = _.omit(newProblem.criteria, subProblemDefinition.excludedCriteria);
        newProblem.performanceTable = _.reject(newProblem.performanceTable, function(performanceEntry) {
          return _.includes(subProblemDefinition.excludedCriteria, performanceEntry.criterionUri) ||
            _.includes(subProblemDefinition.excludedCriteria, performanceEntry.criterion); // addis/mcda standalone difference
        });
      }

      if (subProblemDefinition.excludedAlternatives) {
        newProblem.alternatives = _.reduce(newProblem.alternatives, function(accum, alternative, key) {
          if (!_.includes(subProblemDefinition.excludedAlternatives, key)) {
            accum[key] = alternative;
          }
          return accum;
        }, {});

        var excludedAlternativeNames = subProblemDefinition.excludedAlternatives;
        // remove all exact entries that are excluded
        newProblem.performanceTable = _.reject(newProblem.performanceTable, function(performanceEntry) {
          return performanceEntry.performance.type === 'exact' && _.includes(excludedAlternativeNames, performanceEntry.alternative);
        });
        // remove all survival entries that are excluded
        newProblem.performanceTable = _.reject(newProblem.performanceTable, function(performanceEntry) {
          return performanceEntry.performance.type === 'dsurv' && _.includes(excludedAlternativeNames, performanceEntry.alternative);
        });

        // remove all relative entries that are excluded
        _.forEach(newProblem.performanceTable, function(performanceEntry) {
          if (performanceEntry.performance.type !== 'exact' && performanceEntry.performance.type !== 'dsurv' &&
            performanceEntry.performance.parameters.relative) {
            performanceEntry.performance.parameters.relative.cov =
              reduceCov(performanceEntry.performance.parameters.relative.cov, excludedAlternativeNames);
            performanceEntry.performance.parameters.relative.mu = reduceMu(performanceEntry.performance.parameters.relative.mu,
              subProblemDefinition.excludedAlternatives);
          }
        });
      }

      newProblem.criteria = _.merge(newProblem.criteria, subProblemDefinition.ranges);
      return newProblem;
    }

    function reduceCov(oldCov, names) {
      var newCov = _.cloneDeep(oldCov);
      _.forEach(names, function(name) {
        var idx = newCov.colnames.indexOf(name);
        newCov.colnames.splice(idx, 1);
        newCov.rownames.splice(idx, 1);
        newCov.data = reduceMatrix(newCov.data, idx);
      });
      return newCov;
    }

    function reduceMatrix(cov, idx) {
      var newCov = _.cloneDeep(cov);
      newCov.splice(idx, 1);
      _.forEach(newCov, function(row) {
        row = row.splice(idx, 1);
      });
      return newCov;
    }

    function reduceMu(mu, excludedAlternatives) {
      return _.reduce(mu, function(accum, muValue, key) {
        if (!_.includes(excludedAlternatives, key)) {
          accum[key] = muValue;
        }
        return accum;
      }, {});
    }

    function buildAggregateState(baseProblem, subProblem, scenario) {
      var newState = _.merge({}, {
        problem: mergeBaseAndSubProblem(baseProblem, subProblem.definition)
      }, scenario.state);
      _.forEach(newState.problem.criteria, function(criterion, key) {
        newState.problem.criteria[key] = _.merge({}, criterion, _.omit(baseProblem.criteria[key], ['pvf']));
        // omit because we don't want the base problem pvf to overwrite the current one
      });
      _.forEach(newState.problem.alternatives, function(alternative, key) {
        newState.problem.alternatives[key] = _.merge({}, alternative, baseProblem.alternatives[key]);
      });
      newState.problem.criteria = _.keyBy(sortCriteriaWithW(newState.problem.criteria), 'id');
      return newState;
    }

    function setDefaultObservedScales(problem, observedScales) {
      var newProblem = _.cloneDeep(problem);
      _.forEach(newProblem.criteria, function(criterion, key) {
        var scale = observedScales[key];
        if (!criterion.pvf || _.isEmpty(criterion.pvf.range)) {
          criterion.pvf = {
            range: getMinMax(scale)
          };
        }
      });
      return newProblem;
    }

    function getMinMax(scales) {
      var minimum = Infinity;
      var maximum = -Infinity;
      _.forEach(scales, function(scale) {
        _.forEach(scale, function(value) {
          if (value < minimum) {
            minimum = value;
          }
          if (value > maximum) {
            maximum = value;
          }
        });
      });
      return [minimum, maximum];
    }

    function filterScenariosWithResults(baseProblem, currentSubProblem, scenarios) {
      return _.filter(scenarios, function(scenario) {
        var hasPvf = true;
        var state = buildAggregateState(baseProblem, currentSubProblem, scenario);
        if (state.problem) {
          _.forEach(state.problem.criteria, function(criterion) {
            if (!criterion.pvf || !criterion.pvf.direction) {
              hasPvf = false;
            }
          });
          return hasPvf;
        } else {
          return false;
        }
      });
    }

    /*
     * workspace should have:
     * - title
     * - criteria
     * - alternatives
     * - performanceTable
     * optional:
     * - description
     * - preferences
     */
    function validateWorkspace(workspace) {
      var constraints = [missingProperties,
        tooFewCriteria,
        tooFewAlternatives,
        criterionLackingTitle,
        alternativeLackingTitle,
        performanceTableWithInvalidAlternative,
        performanceTableWithInvalidCriterion,
        performanceTableWithMissingData,
        preferencesWithUnfoundCriterion,
        mixedPreferenceTypes,
        inconsistentOrdinalPreferences,
        inconsistentExactPreferences,
        relativePerformanceLackingBaseline,
        relativePerformanceWithBadMu,
        relativePerformanceWithBadCov

      ];
      var triggeredConstraint;
      try {
        triggeredConstraint = _.find(constraints, function(constraint) {
          return constraint(workspace);
        });
      } catch (exception) {
        console.log(exception);
        return {
          isValid: false,
          errorMessage: 'Exception while reading problem. Please make sure the file follows the specifications as laid out in the manual'
        };
      }
      return {
        isValid: !triggeredConstraint,
        errorMessage: triggeredConstraint ? triggeredConstraint(workspace) : undefined
      };
    }

    // privates
    function missingProperties(workspace) { // required properties
      var requiredProperties = ['title',
        'criteria',
        'alternatives',
        'performanceTable'
      ];

      var missingProperties = _.reject(requiredProperties, function(property) {
        return workspace[property];
      });

      if (missingProperties.length === 1) {
        return 'Missing workspace property: ' + missingProperties[0];
      } else if (missingProperties.length > 1) {
        return 'Missing workspace properties: ' + missingProperties.join(', ');
      }
    }

    function tooFewCriteria(workspace) {
      if (_.size(workspace.criteria) < 2) {
        return 'Two or more criteria required';
      }
    }

    function tooFewAlternatives(workspace) {
      if (_.size(workspace.alternatives) < 2) {
        return 'Two or more alternatives required';
      }
    }

    function performanceTableWithInvalidAlternative(workspace) {
      var entry = _.find(workspace.performanceTable, function(tableEntry) {
        return isAbsolutePerformance(tableEntry) && !workspace.alternatives[tableEntry.alternative];
      });
      if (entry) {
        return 'Performance table contains data for nonexistent alternative: "' + entry.alternative + '"';
      }
    }

    function performanceTableWithInvalidCriterion(workspace) {
      var entry = _.find(workspace.performanceTable, function(tableEntry) {
        return !workspace.criteria[tableEntry.criterion];
      });
      if (entry) {
        return 'Performance table contains data for nonexistent criterion: "' + entry.criterion + '"';
      }
    }

    function performanceTableWithMissingData(workspace) {
      var alternatives = _.keys(workspace.alternatives);
      var criteria = _.keys(workspace.criteria);
      var criteriaWithAbsolutePerformance = _.filter(criteria, function(criterion) {
        return _.find(workspace.performanceTable, function(tableEntry) {
          return tableEntry.criterion === criterion && isAbsolutePerformance(tableEntry);
        });
      });
      var critAltCombinations = _.reduce(criteriaWithAbsolutePerformance, function(acc, criterion) {
        return acc.concat(_.map(alternatives, function(alternative) {
          return {
            criterion: criterion,
            alternative: alternative
          };
        }));
      }, []);
      var missingPair = _.find(critAltCombinations, function(critAltCombo) {
        return !_.find(workspace.performanceTable, function(tableEntry) {
          return tableEntry.alternative === critAltCombo.alternative && tableEntry.criterion === critAltCombo.criterion;
        });
      });
      if (missingPair) {
        return 'Performance table is missing data for criterion "' + missingPair.criterion +
          '" and alternative "' + missingPair.alternative + '"';
      }
    }

    function preferencesWithUnfoundCriterion(workspace) {
      var crit;
      _.find(workspace.preferences, function(preference) {
        return _.find(preference.criteria, function(criterion) {
          if (!workspace.criteria[criterion]) {
            crit = criterion;
            return true;
          } else {
            return false;
          }
        });
      });
      if (crit) {
        return 'Preferences contain data for nonexistent criterion: "' + crit + '"';
      }
    }

    function mixedPreferenceTypes(workspace) {
      if (hasNoPreferences(workspace)) {
        return;
      }
      var firstType = workspace.preferences[0].type;
      if (_.find(workspace.preferences, function(preference) {
          return preference.type !== firstType;
        })) {
        return 'Preferences should all be the same type';
      }
    }

    function inconsistentOrdinalPreferences(workspace) {
      if (!workspace.preferences || _.isEmpty(workspace.preferences) || _.find(workspace.preferences, function(preference) {
          return preference.type !== 'ordinal';
        })) {
        return;
      }
      if (workspace.preferences.length !== _.size(workspace.criteria) - 1) {
        return 'Inconsistent ordinal preferences';
      }

      var visitCount = _.cloneDeep(workspace.criteria);
      _.forEach(visitCount, function(node) {
        node.visits = 0;
      });

      // always visit beginning of path
      ++visitCount[workspace.preferences[0].criteria[0]].visits;

      var badPath = false;
      _.forEach(workspace.preferences, function(preference, index) {
        var origin = preference.criteria[0];
        var destination = preference.criteria[1];
        ++visitCount[destination].visits;
        if (index > 0) {
          var previousDestination = workspace.preferences[index - 1].criteria[1];
          badPath = origin !== previousDestination;
        }
      });

      var badCoverage = _.find(visitCount, ['visits', 0]) || _.find(visitCount, function(node) {
        return node.visits > 1;
      });

      if (badPath || badCoverage) {
        return 'Inconsistent ordinal preferences';
      }
    }

    function inconsistentExactPreferences(workspace) {
      if (hasNoPreferences(workspace) || workspace.preferences[0].type !== 'exact swing') {
        return;
      }

      var first = workspace.preferences[0].criteria[0];
      if (_.find(workspace.preferences, function(preference) {
          return preference.criteria[0] !== first ||
            preference.criteria[0] === preference.criteria[1] ||
            preference.ratio > 1 ||
            preference.ratio <= 0;
        })) {
        return 'Inconsistent exact weighting preferences';
      }
    }

    function hasNoPreferences(workspace) {
      return !workspace.preferences || _.isEmpty(workspace.preferences);
    }

    function isAbsolutePerformance(tableEntry) {
      return tableEntry.performance.type.indexOf('relative') !== 0;
    }

    function criterionLackingTitle(workspace) {
      var key;
      var crit = _.find(workspace.criteria, function(criterion, critKey) {
        key = critKey;
        return !criterion.title;
      });
      if (crit) {
        return 'Missing title for criterion: "' + key + '"';
      }
    }

    function alternativeLackingTitle(workspace) {
      var key;
      var alt = _.find(workspace.alternatives, function(alternative, critKey) {
        key = critKey;
        return !alternative.title;
      });
      if (alt) {
        return 'Missing title for alternative: "' + key + '"';
      }
    }

    function relativePerformanceLackingBaseline(workspace) {
      var entryLackingBaseline = _.find(workspace.performanceTable, function(tableEntry) {
        return !isAbsolutePerformance(tableEntry) && !tableEntry.performance.parameters.baseline;
      });
      if (entryLackingBaseline) {
        return 'Missing baseline for criterion: "' + entryLackingBaseline.criterion + '"';
      }
    }

    function relativePerformanceWithBadMu(workspace) {
      var alternativeKey;
      var entryWithBadMu = _.find(workspace.performanceTable, function(tableEntry) {
        return !isAbsolutePerformance(tableEntry) && _.find(tableEntry.performance.parameters.relative.mu, function(muValue, muKey) {
          alternativeKey = muKey;
          return !workspace.alternatives[muKey];
        });
      });
      if (entryWithBadMu) {
        return 'The mu of the performance of criterion: "' + entryWithBadMu.criterion + '" refers to nonexistent alternative: "' + alternativeKey + '"';
      }
    }

    function relativePerformanceWithBadCov(workspace) {
      var alternativeKey;
      var entryWithBadCov = _.find(workspace.performanceTable, function(tableEntry) {
        return !isAbsolutePerformance(tableEntry) && (_.find(tableEntry.performance.parameters.relative.cov.rownames, function(rowVal) {
          alternativeKey = rowVal;
          return !workspace.alternatives[rowVal];
        }) || _.find(tableEntry.performance.parameters.relative.cov.colnames, function(colVal) {
          alternativeKey = colVal;
          return !workspace.alternatives[colVal];
        }));
      });
      if (entryWithBadCov) {
        return 'The covariance matrix of criterion: "' + entryWithBadCov.criterion + '" refers to nonexistent alternative: "' + alternativeKey + '"';
      }
    }

    return {
      getObservedScales: getObservedScales,
      buildTheoreticalScales: buildTheoreticalScales,
      buildValueTree: buildValueTree,
      reduceProblem: reduceProblem,
      buildAggregateState: buildAggregateState,
      mergeBaseAndSubProblem: mergeBaseAndSubProblem,
      setDefaultObservedScales: setDefaultObservedScales,
      filterScenariosWithResults: filterScenariosWithResults,
      validateWorkspace: validateWorkspace
    };
  };

  return dependencies.concat(WorkspaceService);
});