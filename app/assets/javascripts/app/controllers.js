angular.module('myApp.controllers', [])
.controller('ProjectsController', function($scope, ProjectsService) {
	ProjectsService.getProjects()
	.then(function(data) {
		$scope.projects = data;
	});

	$scope.selectProject = function(selectedProject) {
		($scope.projects).each(function(project){
			project.selected = false;
			if (selectedProject === project) {
				selectedProject.selected = true;
			}
		});
	};
});