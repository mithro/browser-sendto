
var extensionkey = chrome.extension.getURL('/');

function s4() {
   return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}
function guid() {
   return (s4()+s4()+'-'+s4()+'-'+s4()+'-'+s4()+'-'+s4()+s4()+s4());
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

function loadOptions() {
	if (extensionkey in localStorage && $.trim(localStorage).length > 0) {
		return JSON.parse(localStorage[extensionkey]);
	}
	return defaults;
}

function myID() {
	return loadOptions()['chromeid'];
}

function time() {
	return Math.round((new Date()).getTime() / 1000);
}
