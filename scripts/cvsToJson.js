"use strict";
var _ = require('lodash');
var CSVParse = require('csv-parse');
var fs = require('fs');
var path = require('path');
var moment = require('moment');
const crypto = require('crypto');
const HASH_STORE_FILENAME = path.resolve(__dirname, "content-hash.json");

const TARGET_DIR = path.resolve(__dirname, '..', 'config', 'seed-data');
// const TARGET_DIR = path.resolve(__dirname);


/*
 Run this script on any new inspections or authorizations CSV content.  It parses the CSV, does some checks on the data
 and generates a file for the config/seed-data folder that will automatically update the database the next time the
 server is started.
 */

run();
function run() {
	var hashData = {};
	readFile(HASH_STORE_FILENAME)
		.then(function (data) {
			hashData = {};
			if (data) {
				hashData = JSON.parse(data);
			}
		})
		.then(function () {
			var all = [];
			all.push(preProcess(new Inspections(), hashData));
			all.push(preProcess(new Authorization(), hashData));
			all.push(preProcess(new OtherDocs(), hashData));
			return Promise.all(all);
		})
		.then(function (results) {
			var json = JSON.stringify(hashData);
			// console.log("save hash '", json, "'");
			console.log("Done");
			return writeFile(HASH_STORE_FILENAME, json);
		})
		.catch(function (err) {
			console.error(err);
			resolve(err);
		});
}


function preProcess(importer, hashData) {
	var obj = {};
	return new Promise(function (resolve, reject) {
		// console.log('Pre Process Inspections start');
		Promise.resolve()
			.then(function () {
				return readFile(importer.INPUT);
			})
			.then(function (data) {
				if (!data) {
					return Promise.reject("Could not locate input file ", importer.INPUT);
				}
				obj.inputData = data;
			})
			.then(function (data) {
				// console.log("Hash data ", data);
				var md5sum = crypto.createHash('md5');
				md5sum.update(obj.inputData);
				var d1 = md5sum.digest('hex');
				var d2 = hashData[importer.INPUT];
				//console.log("Compare hashes", d1, d2);
				if (d2) {
					if (d1 === d2) {
						return Promise.reject("No need to do anything with " + importer.INPUT);
					}
				}
				hashData[importer.INPUT] = d1;
			})
			.then(function () {
				// console.log("load csv");
				return loadCSV(importer, obj.inputData)
			})
			.then(function (results) {
				return importer.cleanData(results);
			})
			.then(function (results) {
				return importer.transform(results);
			})
			.then(function (results) {
				var output = {
					name: importer.getName(),
					date: (new Date).toISOString(),
					data: results
				}
					var json = "'use strict';\nmodule.exports = " + JSON.stringify(output, null, 2) + ";";
					fs.writeFile(importer.OUTPUT, json, {encoding: 'utf8'}, function (err, data) {
						if (err) reject(err);
						// console.log("JSON saved to file ", importer.OUTPUT);
						return resolve("JSON saved to file "+ importer.OUTPUT);
					});
			})
			.catch(function (err) {
				console.error(err);
				resolve(err);
			});
	});
}


const agencyMap = {
	'ENV': {agencyCode: 'ENV', name: 'Ministry of Environment', act: "Environmental Management Act"},
	'MEM': {agencyCode: 'MEM', name: 'Ministry of Energy and Mines', act: "Mines Act"},
	'EAO': {agencyCode: 'EAO', name: "Environmental Assessment Office", act: "Environmental Assessment Act"}
};

function ImporterBase() {

	this.dateValidateMoment = function (val) {
		var s;
		var m = moment.utc(val, ["YYYY-MM-DD", "MM-DD-YYYY"]);
		if (!m.isValid()) {
			console.log("Invalidate Date %j", val);
			throw "Invalid date " + val;
		} else {
			m.add(8,'hours');
			s = m.format("YYYY-MM-DD HH:mm");
			s = new Date(s);
			//console.log("date validate", val, s);
		}
		return s;
	}

this.cleanData = function(jsonResults) {
	var _this = this;
	_.forEach(jsonResults, function (json, index) {
		var keys = Object.keys(json);
		_.forEach(keys, function(key){
			var val = json[key];
			if(_.isString(val)) {
				val = val.trim().replace(/\n/g,' ');
			}
			json[key] = val;
		})
	});
	return jsonResults;
}
	this.getAgency = function (code) {
		var agency = agencyMap[code];
		if (!agency) {
			_.forEach(agencyMap, function (ag, index) {
				if (ag.name === code) {
					agency = ag;
					return;
				}
			});
		}
		return agency;
	};

	this.getAgencyList = function (list) {
		var parts = list.split(',');
		var agencyList = [];
		for (var i = 0; i < parts.length; i++) {
			var code = parts[i].trim();
			var agency = agencyMap[code];
			if (!agency) {
				_.forEach(agencyMap, function (ag, index) {
					if (ag.name === code) {
						agency = ag;
						return;
					}
				});
			}
			if (agency)
				agencyList.push(agency);
		}
		return agencyList;
	};

	this.processRelated = function (json) {
		var followUpDocuments = [];
		if (json.documentName && json.documentURL) {
			var related = {name: json.documentName, ref: json.documentURL};
			followUpDocuments.push(related);
		}
		for (var i = 1; i < 5; i++) {
			var n = json['rn' + i];
			var u = json['ru' + i];
			if (n && u) {
				var e = {name: n, ref: u};
				followUpDocuments.push(e);
			}
		}
		delete json.rn1;
		delete json.rn2;
		delete json.rn3;
		delete json.rn4;
		delete json.ru1;
		delete json.ru2;
		delete json.ru3;
		delete json.ru4;
		return followUpDocuments;
	};

	this.processSemiSeparatedRelated = function (json, index) {
		var followUpDocuments = [];
		var rowNum = index + 2;
		if (json.documentName && json.documentURL) {
			var related = {
				name: json.documentName,
				ref: json.documentURL,
				fileName: json.documentFileName,
				date: json.date
			};
			followUpDocuments.push(related);
		}
		var names = json.relatedDocNames.trim();
		var urls = json.relatedDocUrls.trim();
		var dates = json.relatedDocDates.trim();
		var fileNames = json.relatedDocLongNames.trim();

		if (names.length > 0 && urls.length > 0 && dates.length > 0) {
			var re = /\s*;\s*/;
			names = names.split(re);
			var cnt = names.length;
			var urls = urls.split(re);
			var dates = dates.split(re);
			var fileNames = fileNames.split(re);
			if (cnt !== urls.length) {
				console.log("%j Row %j, Related docs have mismatched number of urls %j expected %j.  %j", this.getName(), rowNum, urls.length, cnt, names);
				return;
			}
			if (cnt !== dates.length) {
				console.log("%j Row %j, Related docs have mismatched number of dates ", this.getName(), rowNum);
				return;
			}
			if (cnt !== fileNames.length) {
				console.log("%j Row %j, Related docs have mismatched number of longNames ", this.getName(), rowNum);
				return;
			}
			// console.log("%j Row %j, process %j related docs", this.getName(),cnt, names, dates, index);
			for (var i = 0; i < cnt; i++) {
				var e = {name: names[i], ref: urls[i]}
				var d = dates[i];
				if (d.length > 0) {
					d = this.dateValidateMoment(d);
					e.date = d;
				}
				var l = fileNames[i];
				if (l.length > 0) {
					e.fileName = l;
				}
				followUpDocuments.push(e);
			}
		}
		delete json.relatedDocNames;
		delete json.relatedDocUrls;
		delete json.relatedDocDates;
		delete json.relatedDocLongNames;
		return followUpDocuments;
	}
}


function Authorization() {
	ImporterBase.call(this);

	this.INPUT = path.resolve(__dirname, 'load-authorizations-data.csv');
	this.OUTPUT = path.resolve(TARGET_DIR, 'load-authorizations-data.js');
	this.getName = function () {
		return 'Authorizations';
	}
	console.log("INPUT", this.INPUT);
	console.log("OUTPUT", this.OUTPUT);

	this.csvExpectedColumns = ['agency',
		'projectCode',
		'authorizationId',
		'Authorization name (Title)',
		'Issue date',
		'type(Permit or Certificate)',
		'status (Issued or Amended)',
		'location of document (URL)',
		'relatedDocName',
		'relatedDocUrl',
		'relatedDocName',
		'relatedDocUrl',
		'relatedDocName',
		'relatedDocUrl',
		'relatedDocName',
		'relatedDocUrl',
		'relatedDocName',
		'relatedDocUrl'];

	this.columnNames = [
		"agencyCode",
		"projectName",
		"authorizationID",
		"documentName",
		"authorizationDate",
		"documentType",
		"documentStatus",
		"documentURL",
		"rn1",
		"ru1",
		"rn2",
		"ru2",
		"rn3",
		"ru3",
		"rn4",
		"ru4"
	];
	this.transform = function (jsonData) {
		var _this = this;
		_.forEach(jsonData, function (json, index) {
			if (!json.projectName || json.projectName.length == 0) {
				console.log("Row is missing project. Skipping this data:", index);
				return;
			}
			json.projectName = json.projectName.trim();
			var agency = _this.getAgency(json.agencyCode);
			if (!agency) {
				console.log("Row is missing agency. Skipping this data:", index);
				return;
			}
			json.agencyCode = agency.agencyCode;
			json.agencyName = agency.name;
			json.actName = agency.act;
			json.followUpDocuments = _this.processRelated(json);
			json.authorizationDate = _this.dateValidateMoment(json.authorizationDate);
			delete json.undefined;
		});
		return jsonData;
	}
}
Authorization.prototype = Object.create(ImporterBase.prototype);
Authorization.prototype.constructor = Authorization;

//see model = require('../../modules/inspections/server/models/inspections.model');
function Inspections() {
	ImporterBase.call(this);
	this.getName = function () {
		return 'Inspections';
	}
	this.INPUT = path.resolve(__dirname, 'load-inspections-data.csv');
	this.OUTPUT = path.resolve(TARGET_DIR, 'load-inspections-data.js');

	console.log("INPUT", this.INPUT);
	console.log("OUTPUT", this.OUTPUT);
	this.csvExpectedColumns = ['ProjectCode',
		'OrgCode',
		'InspectionId',
		'InspectionDate',
		'InspectorInitials',
		'InspectionSummary',
		'RecentFollowUp',
		'InspectionDocumentName',
		'InspectionDocumentFilename',
		'InspectionDocumentURL',
		'FollowUpDocumentNames ',
		'FollowUpDocumentFileames',
		'FollowUpDocumentUrls',
		'OtherDocument',
		'OtherDocumentURL',
		'AuthorizationID',
		'Type of Inspection'
	];

	this.columnNames = [
		"projectName",
		"agencyCode",
		"inspectionNum",
		"inspectionDate",
		"inspectorInitials",
		"inspectionSummary",
		"recentFollowUp",
		"documentName",
		"InspectionDocumentFilename",
		"documentURL",
		"rn1",
		"junk1",
		"ru1",
		"rn2",
		"ru2",
		"authorizationID"
	];
	this.transform = function (jsonData) {
		var _this = this;
		_.forEach(jsonData, function (json, index) {
			if (!json.projectName || json.projectName.length == 0) {
				console.log("Row is missing project. Skipping this data:", index);
				return;
			}
			var agency = _this.getAgency(json.agencyCode);
			if (!agency) {
				console.log("Row is missing agency. Skipping this data:", index);
				return;
			}
			json.agencyCode = agency.agencyCode;
			json.agencyName = agency.name;
			json.actName = agency.act;
			json.inspectionName = json.inspectionNum + "-" + json.orgCode + " (" + agency.name + ")";
			json.followUpDocuments = _this.processRelated(json);
			delete json.junk1;
			delete json.InspectionDocumentFilename;
			delete json.undefined;
			json.inspectionDate = _this.dateValidateMoment(json.inspectionDate);
		});
		return jsonData;
	}
}
Inspections.prototype = Object.create(ImporterBase.prototype);
Inspections.prototype.constructor = Inspections;


function OtherDocs() {
	ImporterBase.call(this);
	this.INPUT = path.resolve(__dirname, 'load-otherDocs-data.csv');
	this.OUTPUT = path.resolve(TARGET_DIR, 'load-otherDocs-data.js');
	// this.OUTPUT = path.resolve(__dirname, '..', '..', 'load-otherDocs-data.js');
	this.getName = function () {
		return 'OtherDocument';
	}
	console.log("INPUT", this.INPUT);
	console.log("OUTPUT", this.OUTPUT);

	var x = ["Agency", "Project",  "Heading", "TITLE", "Main Document Name", "Document Type", "Document Date", "Filename", "Document URL (Source)", "Related Document(s) Name", "Related Document(s) Date", "Related Document(s) Filename", "Related Document(s) URL (Source)"];
	this.csvExpectedColumns = x;

	this.columnNames = ["agencyCode", "projectName",  "heading", "title", "documentName", "documentType"
		, "date", "documentFileName", "documentURL",
		"relatedDocNames", "relatedDocDates", "relatedDocLongNames", "relatedDocUrls"];
	this.transform = function (jsonData) {
		var _this = this;
		_.forEach(jsonData, function (json, index) {
			if (!json.projectName || json.projectName.length == 0) {
				console.log("Row is missing project. Skipping this data:", index);
				return;
			}
			json.projectName = json.projectName.trim();
			var agencyList = _this.getAgencyList(json.agencyCode);
			if (agencyList.length === 0) {
				console.log("Row is missing agency. Skipping this data:", index);
				return;
			}
			delete json.agencyCode;
			// TODO ... use Title as display name for main document.   For now, remove so the model is not touched.
			delete json.title;
			json.date = _this.dateValidateMoment(json.date);
			json.agencies = agencyList;
			json.source = "SEED";
			json.documentType = json.documentType;
			json.heading = json.heading;
			json.index = index;
			json.documents = _this.processSemiSeparatedRelated(json, index);
			delete json.undefined;
		});
		return jsonData;
	}
}
OtherDocs.prototype = Object.create(ImporterBase.prototype);
OtherDocs.prototype.constructor = OtherDocs;


/* *************************************************************************************
 working helpers ...
 */

function loadCSV(importer, data) {
	return new Promise(function (resolve, reject) {
		var options = {
			delimiter: ',', columns: function (firstRow) {
				if (firstRow.length !== importer.csvExpectedColumns.length) {
					console.error("Mismatch in expected columns Actual/Expected/AsFound", firstRow.length, importer.csvExpectedColumns.length, firstRow);
					return reject("Column count mismatch");
				}
				return importer.columnNames;
			}
		};
		var parse = new CSVParse(data, options, function (err, output) {
			return resolve(output);
		});
	});
}


function readFile(fName) {
	return new Promise(function (resolve, reject) {
		fs.readFile(fName, 'utf8', function (err, data) {
			if (err) {
				return resolve(undefined);
			}
			return resolve(data);
		});
	});
}


function writeFile(fName, data) {
	return new Promise(function (resolve, reject) {
		fs.writeFile(fName, data, {encoding: 'utf8'}, function (err, x) {
			if (err) reject("Write file error: ", err);
			// console.log("Data saved to file ", fName, data);
			resolve();
		});
	});
}

