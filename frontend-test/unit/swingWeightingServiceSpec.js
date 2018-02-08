'use strict';
define(['lodash', 'angular-mocks', 'mcda/preferences/preferences', 'mcda/misc'], function(_) {
  describe('Exact swing weighting service', function() {

    var scope;
    var currentScenario;
    var state = jasmine.createSpyObj('$state', ['go']);
    var orderingServiceMock = jasmine.createSpyObj('OrderingService', ['getOrderedCriteriaAndAlternatives']);
    var taskDefinition = jasmine.createSpyObj('taskDefinition', ['clean']);
    taskDefinition.clean.and.callFake(_.identity);
    var orderings = {
      criteria: [],
      alternatives: []
    };
    orderingServiceMock.getOrderedCriteriaAndAlternatives.and.returnValue({
      then: function(f) {
        f(orderings);
      }
    });
    var sliderOptions = {};

    beforeEach(module('elicit.preferences', function($provide) {
      $provide.value('$state', state);
      $provide.value('OrderingService', orderingServiceMock);
    }));


    describe('initially', function() {
      var $stateParams = {};
      var getValues = function(criteria) {
        return _.reduce(criteria, function(accum, criterion, key) {
          accum[key] = 100;
          return accum;
        }, {});
      };
      var baseTitle = 'Precise swing';
      var toBackEnd = function(mostImportantCriterion) {
        return function(value, key) {
          return {
            type: 'exact swing',
            ratio: 1 / (value / 100),
            criteria: [mostImportantCriterion, key]
          };
        };
      };
      beforeEach(inject(function($rootScope, SwingWeightingService) {
        scope = $rootScope.$new();
        scope.aggregateState = {
          problem: exampleProblem()
        };
        currentScenario = jasmine.createSpyObj('currentScenario', ['$save']);
        currentScenario.$save.and.callFake(function(_ignore, callback) {
          callback();
        });
        SwingWeightingService.initWeightingScope(scope,
          $stateParams,
          currentScenario,
          taskDefinition,
          sliderOptions,
          getValues,
          baseTitle,
          toBackEnd);
      }));
      it('scope should be initialised', function() {
        expect(scope.canSave).toBeDefined();
        expect(scope.canSave()).toBeFalsy();
        expect(scope.save).toBeDefined();
        expect(scope.cancel).toBeDefined();
        expect(scope.pvf).toBeDefined();

        //wizard shit
        expect(scope.nextStep).toBeDefined();
        expect(scope.canProceed).toBeDefined();
        expect(scope.canProceed(scope.state)).toBeFalsy();
        expect(taskDefinition.clean).toHaveBeenCalled();
      });

    });
    describe('after proceeding', function() {
      beforeEach(function() {
        scope.state.mostImportantCriterion = 'Prox DVT';
        scope.nextStep(scope.state);
        scope.$digest();
      });
      it('should initialise the sliders', function() {
        var scopeState = scope.state;
        expect(scopeState.step).toBe(2);
        expect(scopeState.values).toEqual({
          'Prox DVT': 100,
          'Dist DVT': 100,
          'Bleed': 100
        });
        expect(scopeState.sliderOptions).toBe(sliderOptions);
        expect(scopeState.sliderOptionsDisabled.disabled).toBe(true);
        expect(scope.canSave(scopeState)).toBeTruthy();
      });
      describe('save', function() {
        beforeEach(function() {
          spyOn(scope, '$emit');
          scope.save(scope.state);
          scope.$digest();
        });
        afterEach(function() {
          state.go.calls.reset();
        });
        it('should set the preferences properly and go back to the preferences screen', function() {
          expect(currentScenario.$save).toHaveBeenCalled();
          expect(state.go).toHaveBeenCalledWith('preferences');
          expect(scope.$emit).toHaveBeenCalled();
        });
      });
    });
  });
});