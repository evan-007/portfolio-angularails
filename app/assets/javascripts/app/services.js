angular.module('myApp.services', ['ngResource'])
.factory('ProjectsService', function($http) {
	var service = {
		getProjects: function() {
			return $http.get('/projects').then(function(resp) {
				return resp.data.projects;
			});
		}
	};
	return service;
});