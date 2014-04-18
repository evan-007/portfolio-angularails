angular.module('myApp.controllers', [])
.controller('ProjectsController', function($scope, ProjectsService) {
	ProjectsService.getProjects()
	.then(function(data) {
		$scope.projects = data;
	});
});