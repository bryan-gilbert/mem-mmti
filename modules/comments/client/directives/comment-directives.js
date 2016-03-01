'use strict';

angular.module ('comment')


// -------------------------------------------------------------------------
//
// Comment Period List for a given project
//
// -------------------------------------------------------------------------
.directive ('tmplCommentPeriodList', function () {
	return {
		restrict: 'E',
		templateUrl: 'modules/comments/client/views/period-list.html',
		controller: 'controllerCommentPeriodList',
		controllerAs: 'plist'
	};
})

.directive ('editPeriodModal', ['$modal', function ($modal) {
	return {
		restrict: 'A',
		scope: {
			project: '=',
			period: '='
		},
		link : function (scope, element, attrs) {
			console.log('my modal is running');
			element.on ('click', function () {
				var modalView = $modal.open ({
					animation: true,
					templateUrl: 'modules/comments/client/views/period-edit.html',
					controller: 'controllerEditPeriodModal',
					controllerAs: 'p',
					scope: scope,
					size: 'lg',
					resolve: {
						rProject: function() { return scope.project; },
						rPeriod: function() { return scope.period; }
					}
				});
				modalView.result.then(function () {}, function () {});
			});
		}

	};
}]);
