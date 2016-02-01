'use strict';
// =========================================================================
//
// Model for streams
//
// =========================================================================
module.exports = require ('../../../core/server/controllers/core.models.controller')
.generateModel ('Stream', {
	__access : true,
	__codename  : true,
	phases       : [ {type: 'ObjectId', ref:'PhaseBase'} ],
});


