'use strict';
define(['angular'], function(angular) {
  var dependencies = [
    '$scope',
    '$cookies',
    '$stateParams',
    'WorkspaceResource',
    'SchemaService',
    'currentWorkspace',
    'currentSchemaVersion'
  ];
  var WorkspaceController = function(
    $scope,
    $cookies,
    $stateParams,
    WorkspaceResource,
    SchemaService,
    currentWorkspace,
    currentSchemaVersion
  ) {
    // functions
    $scope.editTitle = editTitle;
    $scope.saveTitle = saveTitle;
    $scope.cancelTitle = cancelTitle;

    // init
    var user = angular.fromJson($cookies.get('LOGGED-IN-USER'));
    $scope.editMode = {
      isUserOwner: user ? currentWorkspace.owner === user.id : false
    };
    if (currentWorkspace.problem.schemaVersion === currentSchemaVersion) {
      $scope.workspace = currentWorkspace;
    } else {
      $scope.workspace = SchemaService.updateProblemToCurrentSchema(currentWorkspace);
    }

    $scope.isEditTitleVisible = false;
    $scope.workspaceTitle = $scope.workspace.title;

    function editTitle() {
      $scope.isEditTitleVisible = true;
      $scope.workspace.title = $scope.workspace.problem.title;
    }

    function saveTitle() {
      $scope.workspace.problem.title = $scope.workspace.title;
      WorkspaceResource.save($stateParams, $scope.workspace);
      $scope.isEditTitleVisible = false;
    }

    function cancelTitle() {
      $scope.isEditTitleVisible = false;
    }
  };
  return dependencies.concat(WorkspaceController);
});
