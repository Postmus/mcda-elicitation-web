'use strict';
define(function(require) {
  var angular = require('angular');

  var dependencies = ['ngResource'];

  var WorkspaceResource = function($q, $resource) {

    var resource = $resource(
      window.config.workspacesRepositoryUrl + ':workspaceId', { workspaceId: '@id' }, {
        create: { method:'POST', transformRequest: function(problem) {
          return angular.toJson({
            title: problem.title,
            problem: problem
          });
        }}
      }
    );

    return resource;
  };

  return angular.module('elicit.workspaceResource', dependencies).factory('WorkspaceResource', WorkspaceResource);
});
