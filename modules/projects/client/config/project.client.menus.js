'use strict';

angular.module('project').run(['Menus', 'MenuControl', function (Menus, MenuControl) {
		Menus.addMenuItem('projectMenu', {
			title: 'Edit Project',
			state: 'p.edit',
			roles: MenuControl.menuRoles ('', 'pro', 'edit-project')
		});
		// Menus.addMenuItem('projectMenu', {
		// 	title: 'Edit Project Schedule',
		// 	state: 'p.edit',
		// 	roles: MenuControl.menuRoles ('', 'eao', 'edit-schedule')
		// });
	}
]);
