'use strict';
// =========================================================================
//
// Controller for Activity
//
// =========================================================================
var path      = require('path');
var DBModel   = require (path.resolve('./modules/core/server/controllers/core.dbmodel.controller'));
var TaskClass = require (path.resolve('./modules/tasks/server/controllers/task.controller'));
var TaskBaseClass = require (path.resolve('./modules/tasks/server/controllers/taskbase.controller'));
var _         = require ('lodash');


module.exports = DBModel.extend ({
	name : 'Activity',
	// -------------------------------------------------------------------------
	//
	// when making a activity from a base it will always be in order to attach
	// to a milestone, so the project and stream and milestone are passed in here along
	// with the base
	// make our new activity so we have an id
	// first get all the tasks and make proper objects from those,
	// reverse link the new tasks to the new activity by passing in the
	// ancestry
	// save the activity
	//
	// -------------------------------------------------------------------------
	makeActivityFromBase : function (base, streamid, projectid, projectcode, phaseid, milestoneid) {
		var self = this;
		var Task = new TaskClass (this.user);
		var TaskBase = new TaskBaseClass (this.user);
		return new Promise (function (resolve, reject) {
			var baseid = base._id;
			var newobjectid;
			var newobject;
			var children;
			var basename = 'activityBase';
			var newchildfunction = Task.makeTaskFromBase;
			var findchildbyid = TaskBase.findById;
			var childname = 'tasks';
			// get all the children
			Promise.all (base[childname].map (findchildbyid))
			.then (function (models) {
				// assign it for later use
				children = models;
				// make the new newobject from the base
				return self.copy (base);
			})
			.then (function (model) {
				newobjectid = model._id;
				newobject   = model;
				// fix the roles
				model.fixRoles (projectcode);
				// assign whatever ancenstry is needed
				model[basename] = baseid;
				model.project   = projectid;
				model.stream    = streamid;
				model.phase     = phaseid;
				model.milestone = milestoneid;
				// return the promise of new children
				return Promise.all (children.map (function (m) {
					return Task.makeTaskFromBase (m, streamid, projectid, projectcode, phaseid, milestoneid, newobjectid);
				}));
			})
			.then (function (models) {
				// assign each new child to the newobject
				_.each (models, function (m) {
					newobject[childname].push (m._id);
				});
				return newobject;
			})
			.then (function (m) {
				return self.saveDocument (m);
			})
			.then (resolve, reject);
		});
	}
});
