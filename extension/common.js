
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
