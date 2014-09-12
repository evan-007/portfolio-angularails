var myApp = angular.module('myApp', ['myApp.controllers', 'myApp.services',
 'ui.router', 'ngAnimate', 'ui.bootstrap', 'restangular']);

myApp.config(function($stateProvider, $urlRouterProvider){
	$urlRouterProvider.otherwise("/home/main");

	$stateProvider
		.state('home', {
			url: '/home',
			templateUrl: 'templates/home',
		})

    .state('home.main', {
      url: '/main',
      templateUrl: 'templates/main',
    })

    .state('home.about', {
      url: '/about',
      templateUrl: 'templates/about'
    })

		.state('portfolio', {
			url: '/portfolio',
			templateUrl: 'templates/portfolio',
			controller: 'ProjectsController',
			resolve: { Projects: function(Restangular){
				return Restangular.all('projects').getList();
			}}
		})

		.state('portfolio.project', {
			url: '/project/:id',
			templateUrl: 'templates/portfolio.project.html',
			resolve: { Project: function(Restangular, $stateParams){
				return Restangular.one('projects', $stateParams.id).get();
			}},
			//why inline controller?
			//todo refactor
			controller: function($scope, $sce, $stateParams, utils, Project) {
				$scope.project = Project;
				$scope.git = $sce.trustAsHtml($scope.project.git);
        $scope.description = $sce.trustAsHtml($scope.project.description);
			}
		})

    .state('portfolio.more', {
      url: '/more',
      templateUrl: 'templates/portfolio.more.html'
    });
});
