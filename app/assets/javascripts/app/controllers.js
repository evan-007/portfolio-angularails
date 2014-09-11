angular.module('myApp.controllers', [])
.controller('ProjectsController', function($scope, Projects) {
	$scope.projects = Projects
});
