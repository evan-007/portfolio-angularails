var myApp = angular.module('myApp', ['ngRoute', 'myApp.controllers', 'myApp.services', 'ui.router']);
myApp.config(function($routeProvider) {
	$routeProvider.when('/', {
		templateUrl: '/templates/dashboard.html',
		controller: 'ProjectsController'
	})
});

myApp.config(function($stateProvider, $urlRouterProvider){
	$stateProvider.state('home', { url: '/home', templateUrl: 'templates/home'
	});
});