var myApp = angular.module('myApp', ['myApp.controllers', 'myApp.services', 'ui.router']);


myApp.config(function($stateProvider, $urlRouterProvider){
	$urlRouterProvider.otherwise("/");

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
			url: 'project/:id',
			templateUrl: 'templates/portfolio.project.html',
			controller: function($scope, $stateParams) {
				$scope.project = $stateParams.id;
				var a = $stateParams.id;
				console.log(a);
			}
		});
});