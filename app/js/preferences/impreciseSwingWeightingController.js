'use strict';
define(['lodash'],
  function(_) {
    var dependencies = ['$scope', '$stateParams',
      'SwingWeightingService',
      'currentScenario',
      'taskDefinition'
    ];
    var ImpreciseSwingWeightingController = function($scope, $stateParams,
      SwingWeightingService,
      currentScenario,
      taskDefinition) {
      $scope.isImprecise = true;
      var sliderOptions = {
        floor: 1,
        ceil: 100,
        translate: function(value) {
          return value + '%';
        },
        noSwitching: true
      };

      function getValues(criteria) {
        return _.reduce(criteria, function(accum, criterion, key) {
          accum[key] = {
            low: 1,
            high: 100
          };
          return accum;
        }, {});
      }

      function toBackEnd(mostImportantCriterion) {
        return function(value, key) {
          return {
            type: 'ratio bound',
            bounds: [
              1 / (value.low / 100),
              1 / (value.high / 100)
            ],
            criteria: [mostImportantCriterion, key]
          };
        };
      }
      
      SwingWeightingService.initWeightingScope($scope,
        $stateParams,
        currentScenario,
        taskDefinition,
        sliderOptions,
        getValues,
        'Imprecise swing weighting',
        toBackEnd);
    };
    return dependencies.concat(ImpreciseSwingWeightingController);
  });