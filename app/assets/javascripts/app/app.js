var myApp = angular.module('myApp', ['myApp.controllers', 'myApp.services', 'ui.router', 'ngAnimate']);

var someId = 1;

myApp.config(function($stateProvider, $urlRouterProvider){
	$urlRouterProvider.otherwise("/home");

	$stateProvider
		.state('home', {
			url: '/home', 
			templateUrl: 'templates/home',
		})
  
    .state('about', {
      url: '/about',
      templateUrl: 'templates/about'
    })

		.state('portfolio', {
			url: '/portfolio',
			templateUrl: 'templates/portfolio',
			controller: 'ProjectsController'
		})

		.state('portfolio.project', {
			url: 'project/:id',
			templateUrl: 'templates/portfolio.project.html',
			controller: function($scope, $sce, $stateParams, utils) {
				$scope.project = utils.findById($scope.projects, $stateParams.id);
				$scope.git = $sce.trustAsHtml($scope.project.git)
			}
		});
});