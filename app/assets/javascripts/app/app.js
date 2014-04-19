angular.module('myApp', ['ngRoute', 'myApp.controllers', 'myApp.services', 'ui.router'])
.config(function($routeProvider) {
	$routeProvider.when('/', {
		templateUrl: '/templates/dashboard.html',
		controller: 'ProjectsController'
	})
	.otherwise({redirectTo: '/'});
});