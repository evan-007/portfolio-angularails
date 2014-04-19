var myApp = angular.module('myApp', ['myApp.controllers', 'myApp.services', 'ui.router']);


myApp.config(function($stateProvider, $urlRouterProvider){
	$stateProvider
		.state('home', {
			url: '/home', 
			templateUrl: 'templates/home',
		})

		.state('portfolio', {
			url: '/portfolio',
			templateUrl: 'templates/portfolio',
			controller: 'ProjectsController'
		})

		.state('portfolio.project', {
			url: '/:project',
			templateUrl: 'templates/portfolio.project.html',

		});
});