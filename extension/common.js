
function extensionKey(id) {
	return chrome.extension.getURL('/'+id);
}

function s4() {
   return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}
function guid() {
   return (s4()+s4()+'-'+s4()+'-'+s4()+'-'+s4()+'-'+s4()+s4()+s4());
}

function AssertException(message) { this.message = message; }
AssertException.prototype.toString = function () {
	return 'AssertException: ' + this.message;
}
function assert(exp, message) {
	if (!exp) {
		throw new AssertException(message);
	}
}

var defaults = {
	'chromeid': guid(),
	'name': 'My chrome browser',
	'serverurl': 'http://localhost:8080',
	'icon': '',
	'pinned': false,
	'defaultto': '',
	'defaultclose': false,
	'username': '',
	'password': '',
	};

function saveOptions(data) {
	console.log('saveOptions', data);
	localStorage[extensionKey('options')] = JSON.stringify(data);
}

function loadOptions() {
	if (!(extensionKey('options') in localStorage) || $.trim(localStorage).length == 0) {
		saveOptions(defaults);
	}
	return JSON.parse(localStorage[extensionKey('options')]);
}


function saveUrlMap(data) {
	localStorage[extensionKey('urlmap')] = JSON.stringify(data);
}

function loadUrlMap() {
	if (!(extensionKey('urlmap') in localStorage) || $.trim(localStorage).length == 0) {
		return {};
	}
	return JSON.parse(localStorage[extensionKey('urlmap')]);
}

function updateUrlMap(remoteid, url) {
	deleteUrlMap(remoteid);

	var url2remoteid = loadUrlMap();
	if (!(url in url2remoteid)) {
		url2remoteid[url] = [];
	}
	url2remoteid[url].push(remoteid);
}

function deleteUrlMap(remoteid) {
	var url2remoteid = loadUrlMap();
	for(var url in url2remoteid) {
		for (var i in url2remoteid[url]) {
			if (url2remoteid[url][i] != remoteid)
				continue;

			delete url2remoteid[i];
		}
	}
	saveUrlMap(url2remoteid);
}



function saveBrowsers(data) {
	// Don't save ourselves
	var options = loadOptions();
	data = data.filter(function(browser) { return browser['chromeid'] != myID(); });

	localStorage[extensionKey('browsers')] = JSON.stringify(data);
}

function loadBrowsers() {
	if (extensionKey('browsers') in localStorage && $.trim(localStorage).length > 0) {
		return JSON.parse(localStorage[extensionKey('browsers')]);
	}
	return [];
}


function myID() {
	return loadOptions()['chromeid'];
}

function time() {
	return Math.round((new Date()).getTime() / 1000);
}
