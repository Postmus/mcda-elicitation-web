'use strict';
define(function(require) {
  var tasks = {
    'available': [{
      id: 'overview',
      title: 'Overview',
      controller: 'OverviewController',
      templateUrl: 'overview.html',
      requires: [],
      resets: []
    }, {
      id: 'scale-range',
      title: 'Define Scale Range',
      controller: 'ScaleRangeController',
      templateUrl: 'scaleRange.html',
      requires: [],
      isPreference: true,
      resets: ['partial-value-function', 'criteria-trade-offs']
    }, {
      id: 'partial-value-function',
      url: '/partial-value-function/:criterion',
      title: 'Define Partial Value Functions',
      controller: 'PartialValueFunctionController',
      templateUrl: 'partialValueFunction.html',
      requires: ['scale-range'],
      isPreference: true,
      resets: ['criteria-trade-offs']
    }, {
      id: 'ordinal-swing',
      title: 'Ordinal Swing Elicitation',
      controller: 'OrdinalSwingController',
      templateUrl: 'ordinalSwing.html',
      requires: ['partial-value-function'],
      isPreference: true,
      resets: ['non-ordinal-preferences']
    }, {
      id: 'interval-swing',
      title: 'Interval Swing Elicitation',
      controller: 'IntervalSwingController',
      templateUrl: 'intervalSwing.html',
      isPreference: true,
      requires: ['complete-criteria-ranking'],
      resets: ['non-ordinal-preferences']
    }, {
      id: 'exact-swing',
      title: 'Exact Swing Elicitation',
      controller: 'ExactSwingController',
      templateUrl: 'exactSwing.html',
      isPreference: true,
      requires: ['complete-criteria-ranking'],
      resets: ['non-ordinal-preferences']
    }, {
      id: 'preferences',
      title: 'Preferences',
      controller: 'PreferencesController',
      templateUrl: 'preferences.html',
      requires: [],
      resets: []
    }, {
      id: 'results',
      title: 'Results',
      controller: 'ResultsController',
      templateUrl: 'results.html',
      requires: ['scale-range', 'partial-value-function'],
      resets: []
    }, {
      id: 'effects-table',
      title: 'Effects table',
      controller: 'EffectsTableController',
      templateUrl: 'effectsTable.html',
      requires: ['scale-range', 'partial-value-function'],
      resets: []
    }]
  };

  var defaultView = 'overview';

  return {
    tasks: tasks,
    defaultView: defaultView,
    pataviService: 'smaa_v2'
  };
});
