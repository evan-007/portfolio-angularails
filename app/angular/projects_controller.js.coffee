Portfolio.controller "ProjectsController", ($scope, $http) ->
  $scope.getProjects = () ->
    $http({ method: "GET", url: "/projects" })
      .success (response) ->
        $scope.projects = response.projects