angular.module('myApp.controllers', [])
.controller('ProjectsController', function($scope, ProjectsService, Projects) {
	$scope.projects = Projects
});
