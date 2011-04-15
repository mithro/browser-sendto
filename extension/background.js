/**
 *
 */
function showPageIcon(tabId, changeInfo, tab) {
	chrome.pageAction.show(tabId);
}
// Listen for any changes to the URL of any tab.
chrome.tabs.onUpdated.addListener(showPageIcon);

var waiting = {};

/**
 * This function receives the tab's information and uses ajax to post it to the server.
 * This function is called in the background.html.
 */
chrome.extension.onConnect.addListener(function(port) {
	var tab = port.sender.tab;
	port.onMessage.addListener(function (data) {
		console.log(time() + " sendTab (in background.html)");
		console.log(data);

		var seqnum = s4();
		if (data['confirm']) {
			waiting[seqnum] = tab.id;
		}
		data['seqnum'] = seqnum;

		forward_channel.sendMessage('sendtab', data);
	});
});

/**
 *
 */
function Callbacks(){}
Callbacks.prototype.onPing = function(data) {
	console.log('callback ping ' + data['seqnum'] + ': ' + $.now());
};
Callbacks.prototype.onPong = function(data) {
	console.log('callback pong ' + data['seqnum'] + ': ' + $.now());
};
Callbacks.prototype.onStale = function(data) {
	console.log('callback stale');
	console.log(data);
};
Callbacks.prototype.onError = function(data) {
	console.log('callback error');
	console.log(data['msg']);
	console.log(data['traceback']);
};
Callbacks.prototype.onNewTab = function(data) {
	console.log('callback newtab');
	console.log(data);

	// Create the new tab!
	chrome.tabs.create({'url': data['urldata']['url']});

	if (data['confirm']) {
		forward_channel.sendMessage('confirmtab', {
			'sendto': data['from'],
			'seqnum': data['seqnum']
			}
		);
	}
};
Callbacks.prototype.onConfirmedTab = function(data) {
	console.log('callback confirmedtab');
	console.log(data);

	var tabId = waiting[data['seqnum']];
	if (!tabId) {
		console.log('Got unknown seqnum for closing a tab! ' + data['seqnum']);
		console.log(waiting);
	} else {
		// Close the tab as we have confirmation!
		chrome.tabs.remove(waiting[data['seqnum']]);

		delete waiting[data['seqnum']];
	}
};
Callbacks.prototype.onCall = function(data) {
	var json = $.parseJSON(data);

	// Execute the incoming callback
	if (json === null || json === undefined) {
		console.log(data);
	} else if ('on'+json[0] in this) {
		eval('this.on'+json[0])(json[1]);
	} else {
		console.log('Unknown callback - ' + json[0]);
		console.log(json[1]);
	}
}

/**
 *
 */
function ForwardChannel() {}
ForwardChannel.prototype.onError = function(data) {
	console.log('forward channel onerror!');
	console.log(data);
};
ForwardChannel.prototype.onSuccess = function(incoming) {
	callbacks.onCall(incoming);
};
ForwardChannel.prototype.sendMessage = function (method, args) {
	console.log('forward channel sendmessage - '+method);
	console.log(args);

	var jsontext = JSON.stringify(args);
	$.post(loadOptions()['serverurl'] + '/' + method, 
	       {'chromeid': myID(),
	        'json': jsontext}
	).success(this.onSuccess
	).error(this.onError);
};
ForwardChannel.prototype.ping = function() {
	this.sendMessage('ping', {'seqnum': s4()});
	window.setTimeout(this.ping.bind(this), 30000);
};

/**
 *
 */
function ReturnChannel(token) {
	this.channel = null;
	this.socket = null;
}
ReturnChannel.prototype.open = function () {
	var options = loadOptions();

	// FIXME: Should really use the forward channel class here...
	var jsontext = JSON.stringify(options);
	$.post(options['serverurl'] + '/login',
	       {'chromeid': myID(),
	        'json': jsontext},
               function() {},
	       'json'
	).success(this.gotToken.bind(this)
	).error(this.onError.bind(this));
};
ReturnChannel.prototype.gotToken = function(data) {
	console.log('return channel gottoken');
	console.log(data);
	this.channel = new goog.appengine.Channel(data['token']);
	this.socket = this.channel.open();
	this.socket.onopen = this.onOpen.bind(this);
	this.socket.onerror = this.onError.bind(this);
	this.socket.onclose = this.onClose.bind(this);
	this.socket.onmessage = this.onMessage.bind(this);

	// FIXME: Hack
	forward_channel.ping();
};
ReturnChannel.prototype.onOpen = function() {
	console.log('return channel onOpen!');
};
ReturnChannel.prototype.onError = function(error) {
	console.log('return channel onError!');
	console.log(error);
};
ReturnChannel.prototype.onClose = function() {
	console.log('return channel onClose!');
};
ReturnChannel.prototype.onMessage = function(incoming) {
	callbacks.onCall(incoming['data']);
};

var callbacks = null;
function setup() {
	console.log('setup!');
	
	callbacks = new Callbacks();
	setupChannels();
}

var reverse_channel = null;
var forward_channel = null;
function setupChannels() {
	$.getScript(loadOptions()['serverurl'] + '/_ah/channel/jsapi', setupReturnChannel);
	forward_channel = new ForwardChannel();
}

function setupReturnChannel() {
	goog.appengine.Socket.BASE_URL = loadOptions()['serverurl'] + '/_ah/channel/';
	return_channel = new ReturnChannel();
	return_channel.open();
}
