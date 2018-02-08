'use strict';
define(function() {
  var tasks = {
    'available': [{
      id: 'evidence',
      title: 'Evidence',
      controller: 'EvidenceController',
      templateUrl: 'evidence.html',
      activeTab: 'evidence',
      requires: [],
      resets: []
    }, {
      id: 'partial-value-function',
      url: '/partial-value-function/:criterion',
      title: 'Define Partial Value Functions',
      controller: 'PartialValueFunctionController',
      templateUrl: 'partialValueFunction.html',
      activeTab: 'preferences',
      requires: [],
      resets: ['criteria-trade-offs']
    }, {
      id: 'ordinal-swing',
      title: 'Ranking',
      controller: 'OrdinalSwingController',
      templateUrl: 'ordinalSwing.html',
      activeTab: 'preferences',
      requires: ['partial-value-function'],
      resets: ['criteria-trade-offs']
    }, {
      id: 'swing-weighting',
      title: 'Swing Weighting Elicitation',
      controller: 'SwingWeightingController',
      templateUrl: 'swingWeighting.html',
      activeTab: 'preferences',
      requires: ['partial-value-function'],
      resets: ['criteria-trade-offs']
    }, {
      id: 'imprecise-swing-weighting',
      title: 'Imprecise Swing Weighting Elicitation',
      controller: 'ImpreciseSwingWeightingController',
      templateUrl: 'swingWeighting.html',
      activeTab: 'preferences',
      requires: ['partial-value-function'],
      resets: ['criteria-trade-offs']
    }, {
      id: 'preferences',
      title: 'Preferences',
      controller: 'PreferencesController',
      templateUrl: 'preferences.html',
      activeTab: 'preferences',
      requires: ['scale-range'],
      resets: []
    }, {
      id: 'results',
      title: 'Results',
      requires: ['partial-value-function'],
      redirectTo: 'smaa-results',
      resets: []
    }, {
      id: 'smaa-results',
      title: 'Smaa results',
      controller: 'SmaaResultsController',
      templateUrl: 'smaaResults.html',
      activeTab: 'smaa-results',
      requires: ['partial-value-function'],
      resets: []
    }, {
      id: 'deterministic-results',
      title: 'Deterministic results',
      controller: 'DeterministicResultsController',
      templateUrl: 'deterministicResults.html',
      activeTab: 'deterministic-results',
      requires: ['partial-value-function'],
      resets: []
    }, {
      id: 'problem',
      title: 'Problem',
      controller: 'SubProblemController',
      templateUrl: 'subProblem.html',
      activeTab: 'problem',
      requires: [],
      resets: []
    }]
  };

  var defaultView = 'evidence';

  return {
    tasks: tasks,
    defaultView: defaultView
  };
});