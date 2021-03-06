"use strict";
var ez = require('ez-streams');
var url = require('url');
var qs = require('querystring');

var begPage = '<html><head><title>My Search</title></head></body>' + //
'<form action="/">Search: ' + //
'<input name="q" value="{q}"/>' + //
'<input type="submit"/>' + //
'</form><hr/>';
var endPage = '<hr/>generated in {ms}ms</body></html>';

ez.devices.http.server(function(request, response, _) {
	var query = qs.parse(url.parse(request.url).query),
		t0 = new Date();
	response.writeHead(200, {
		'Content-Type': 'text/html; charset=utf8'
	});
	response.write(_, begPage.replace('{q}', query.q || ''));
	response.write(_, search(_, query.q));
	response.write(_, endPage.replace('{ms}', new Date() - t0));
	response.end();
}).listen(_, 1337);
console.log('Server running at http://127.0.0.1:1337/');

function search(_, q) {
	if (!q || /^\s*$/.test(q)) return "Please enter a text to search";
	try {
		return '<h2>Web</h2>' + webSearch(_, q) //
		+ '<hr/><h2>Files</h2>' + fileSearch(_, q) //
		+ '<hr/><h2>Mongo</h2>' + mongoSearch(_, q);
	} catch (ex) {
		return 'an error occured. Retry or contact the site admin: ' + ex.stack;
	}
}

function webSearch(_, q) {
	var t0 = new Date();
	var json = ez.devices.http.client({
		url: 'https://en.wikipedia.org/w/api.php?action=opensearch&format=json&search=' + q,
		proxy: process.env.http_proxy
	}).proxyConnect(_).end().response(_).checkStatus(200).readAll(_);
	// parse JSON response
	var parsed = JSON.parse(json);
	// format result in HTML
	return '<ul>' + parsed[1].map(function(entry, i) {
		return '<li><a href="' + parsed[3][i] + '"><b>' + entry + '</b></a>: ' + parsed[2][i] + '</li>';
	}).join('') + '</ul>' + '<br/>completed in ' + (new Date() - t0) + ' ms';
}

var fs = require('fs');

function fileSearch(_, q) {
	var t0 = new Date();
	var results = '';
	var re = new RegExp("\\b" + q + "\\b", "i");

	function doDir(_, dir) {
		fs.readdir(dir, _).forEach_(_, function(_, file) {
			var f = dir + '/' + file;
			var stat = fs.stat(f, _);
			if (stat.isFile()) {
				fs.readFile(f, 'utf8', _).split('\n').forEach(function(line, i) {
					if (re.test(line)) results += '<br/>' + f + ':' + i + ':' + line;
				});
			} else if (stat.isDirectory()) {
				doDir(_, f);
			}
		});
	}
	doDir(_, __dirname);
	return results + '<br/>completed in ' + (new Date() - t0) + ' ms';
}


var mongodb = require('mongodb');

var MOVIES = [{
	title: 'To be or not to be',
	director: 'Ernst Lubitsch'
}, {
	title: 'La Strada',
	director: 'Federico Fellini'
}, {
	title: 'Metropolis',
	director: 'Fritz Lang'
}, {
	title: 'Barry Lyndon',
	director: 'Stanley Kubrick'
}];

function mongoSearch(_, q) {
	var t0 = new Date();
	var db = new mongodb.Db('tutorial', new mongodb.Server("127.0.0.1", 27017, {}));
	db.open(_);
	try {
		var coln = db.collection('movies', _);
		if (coln.count(_) === 0) coln.insert(MOVIES, _);
		var re = new RegExp(".*\\b" + q + "\\b.*", "i");
		return coln.find({
			$or: [{
				title: re
			}, {
				director: re
			}]
		}, _).toArray(_).map(function(movie) {
			return movie.title + ': ' + movie.director;
		}).join('<br/>') + '<br/>completed in ' + (new Date() - t0) + ' ms';
	} finally {
		db.close();
	}
}