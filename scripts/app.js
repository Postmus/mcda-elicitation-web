define(['angular',
    'require',
    'underscore',
    'elicit/decision-problem',
    'elicit/controller',
    'components',
    'services'],
function(angular, require, _) {
  var app = angular.module('elicit', ['elicit.controller', 'elicit.problem-resource', 'elicit.components', 'elicit.services']);

  app.run(['$rootScope', function($rootScope) {
    $rootScope.$safeApply = function($scope, fn) {
      var phase = $scope.$root.$$phase;
      if(phase == '$apply' || phase == '$digest') {
        this.$eval(fn);
      }
      else {
        this.$apply(fn);
      }
    };
  }]);

  var wizard = {
    'steps' : {
      "scale-range":
      { controller: 'ScaleRangeController',
        templateUrl: "templates/scale-range.html" },
      "partial-value-function":
      { controller: 'PartialValueFunctionController',
        templateUrl: "templates/partial-value-function.html" },
      "ordinal-swing":
      { controller: 'OrdinalSwingController',
        templateUrl: 'templates/elicit-ordinal.html' },
      "interval-swing":
      { controller: 'IntervalSwingController',
        templateUrl: 'templates/elicit-ratio-bound.html' },
      "exact-swing":
      { controller: 'ExactSwingController',
        templateUrl: 'templates/elicit-exact-swing.html' },
      "choose-method":
      { controller: 'ChooseMethodController',
        templateUrl: 'templates/choose-method.html' },
      "results":
      { controller: 'ResultsController',
        templateUrl: 'templates/results-page.html' }
    }};
  
  app.constant('Wizard', wizard); 

  _.each(_.pairs(wizard.steps), function(step) { 
    var name = step[0];
    var config = step[1];
    app.controller(config.controller, ['$scope', '$injector', function($scope, $injector) { 
      require(['wizard/controller/' + name], function(controller) {
	$injector.invoke(controller, this, { '$scope' : $scope });
      });
    }]);
  });

  app.config(['Wizard', '$routeProvider', function(Wizard, $routeProvider) {
    _.each(_.pairs(Wizard.steps), function(step) { 
      var name = step[0];
      var config = step[1];
      $routeProvider.when('/' + name, {templateUrl: config.templateUrl, controller: config.controller});
    });
    $routeProvider.otherwise({redirectTo: '/'});
  }]);

  return app;
});
