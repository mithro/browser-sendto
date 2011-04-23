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
		console.log(time() + " sendTab (in background.html)", data);

		var seqnum = s4();
		if (data['confirm']) {
			waiting[seqnum] = tab.id;
		}
		data['seqnum'] = seqnum;

		forward_channel.sendMessage('sendtab', data);
	});
});


function sendOp(data) {
	data['time']  = time();

	for (var i in pendingOps) {
		var op = pendingOps[i];
		if (op['action'] == 'create')
			continue;

		if (op['remoteid'] == data['remoteid']) {
			if (data['action'] == 'create') {
				data['action'] = 'update';
			}
			delete pendingOps[i];
		}
	}

	pendingOps.push(data);
	window.setTimeout(1e3, actuallySendOp);
}

function actuallySendOp() {
	for (var i in pendingOps) {
		var op = pendingOps[i];
		if (time() - op['time'] > 1) {
			forward_channel.sendMessage('pin'+op['action'], op);
			delete pendingOps[i];
		}
	}
}

var tabid2remoteid = {};
var tabdata = {};
var pendingOps = [];

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	var remoteid = null;
	if (tabId in tabid2remoteid) {
		remoteid = tabid2remoteid[tabId];
		if (!tab.pinned) {
			console.log((new Date()).getTime(), 'delete -', tabId, changeInfo, tab);
			sendOp({'action': 'delete', 'localid': tabId, 'remoteid': remoteid});

			deleteUrlMap(remoteid);
			delete tabid2remoteid[tabId];
			delete tabdata[tabId];
			return;
		} else {
			console.log((new Date()).getTime(), 'update -', tabId, changeInfo, tab);
			sendOp({'action': 'update', 'localid': tabId, 'remoteid': remoteid, 'url': tab.url});
		}
	} else {
		if (!tab.pinned)
			return;

		console.log((new Date()).getTime(), 'create -', tabId, changeInfo, tab);
		remoteid = guid();
		sendOp({'action': 'create', 'localid': tabId, 'remoteid': remoteid, 'url': tab.url});
	}
	tabid2remoteid[tabId] = remoteid;
	tabdata[tabId] = tab;

	updateUrlMap(remoteid, tab.url);
});

chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
	if (tabId in tabid2remoteid) {
		var remoteid = tabid2remoteid[tabId];
		var tab = tabdata[tabId];

		// Check if there is a pending create op
		var deleteOp = true;
		for (var i in pendingOps) {
			var pendingOp = pendingOps[i];

			if (pendingOp['url'] == tab['url'] && pendingOp['action'] == "create") {
				console.log((new Date()).getTime(), 'changing create to update');

				// Delete the created mapping values
				deleteUrlMap(pendingOp['remoteid']);
				delete tabid2remoteid[pendingOp['localid']];

				// Rewrite the pending op
				pendingOp['action'] = 'update';
				pendingOp['remoteid'] = remoteid;
				deleteOp = false;

				// Update the mappings
				updateUrlMap(remoteid, pendingOp['url']);
				tabid2remoteid[pendingOp['localid']] = remoteid;

				break;
			}
		}

		// Else, issue a delete op
		if (deleteOp) {
			console.log((new Date()).getTime(), 'remove');

			sendOp({'action': 'delete', 'remoteid': remoteid});
			deleteUrlMap(remoteid);
		}

		// Clean Up
		delete tabid2remoteid[tabId];
		delete tabdata[tabId];
	}
});

function restoreSession() {
	chrome.windows.getAll({'populate': true}, function (windows) {
		// Make a deep copy
		var url2remoteid = loadUrlMap();

		for(var i in windows) {
			var win = windows[i];
			// Skip non-normal windows
			if (win.type != 'normal')
				continue;

			// Skip incognito windows
			if (win.incognito)
				continue;

			for(var j in win.tabs) {
				var tab = win.tabs[j];

				if (tab.pinned) {
					var remoteid = null;

					if (tab.url in url2remoteid)
						remoteid = url2remoteid[tab.url].pop();
					if (!remoteid)
						remoteid = guid();

					tabid2remoteid[tab.id] = remoteid;
					tabdata[tab.id] = tab;
				}
			}
		}
	});
}

/**
 *
 */
function Callbacks(){}
Callbacks.prototype.onLoginNeeded = function(data) {
	var options = loadOptions();
	forward_channel.sendMessage('login', options);
};
Callbacks.prototype.onPinCreate = function(data) {
	console.log('callback pin create ', data);
	chrome.tabs.create({'url': data['url'], 'pinned': true}, function(tab) {
		updateUrlMap(remoteid, tab.url);
		tabid2remoteid[tab.id] = data['remoteid'];
		tabdata[tab.id] = tab;
	});
};
Callbacks.prototype.onPinDelete = function(data) {
	console.log('callback pin delete ', data);

	for (var tabid in tabid2remoteid) {
		var remoteid = tabid2remoteid[tabid];

		if (remoteid == data['remoteid']) {
			chrome.tabs.remove(tabid, function() {
				deleteUrlMap(remoteid);
				delete tabid2remoteid[tabid];
				delete tabdata[tabid];
			});
			break;
		}
	}
};
Callbacks.prototype.onPinUpdate = function(data) {
	console.log('callback pin update ', data);

	for (var tabid in tabid2remoteid) {
		var remoteid = tabid2remoteid[tabid];

		if (remoteid == data['remoteid']) {
			chrome.tabs.update(tabid, {'url': data['url']}, function(tab) {
				updateUrlMap(remoteid, data['url']);
				tabdata = tab;
			});
			break;
		}
	}
};

Callbacks.prototype.onUpdateBrowsers = function(data) {
	console.log('callback updatebrowsers ', data);
	saveBrowsers(data);
};
Callbacks.prototype.onPing = function(data) {
	console.log('callback ping ' + data['seqnum'] + ': ' + $.now());
};
Callbacks.prototype.onPong = function(data) {
	console.log('callback pong ' + data['seqnum'] + ': ' + $.now());
};
Callbacks.prototype.onStale = function(data) {
	console.log('callback stale', data);
};
Callbacks.prototype.onError = function(data) {
	console.log('callback error');
	console.log(data['msg']);
	console.log(data['traceback']);
};
Callbacks.prototype.onNewTab = function(data) {
	console.log('callback newtab', data);

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
Callbacks.prototype.onUpdateToken = function(data) {
	console.log('callback onUpdateToken', data);
	reverse_channel.updateToken(data['token']);
};
Callbacks.prototype.onConfirmedTab = function(data) {
	console.log('callback confirmedtab', data);

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
Callbacks.prototype.call = function(data) {
	var json = $.parseJSON(data);

	// Execute the incoming callback
	if (json === null || json === undefined) {
		console.log(data);
	} else {
		for(var i in json) {
			var callback = json[i];

			if ('on'+callback[0] in this) {
				eval('this.on'+callback[0])(callback[1]);
			} else {
				console.log('Unknown callback - ' + json[0]);
				console.log(json[1]);
			}
		}
	}
}

/**
 *
 */
function ForwardChannel(callbacks) {
	this.callbacks = callbacks.call.bind(callbacks);
}
ForwardChannel.prototype.onError = function(data) {
	console.log('forward channel onerror!', data);
};
ForwardChannel.prototype.sendMessage = function(method, args) {
	console.log('forward channel sendmessage - '+method);
	console.log(args);

	var jsontext = JSON.stringify(args);
	$.post(loadOptions()['serverurl'] + '/' + method, 
	       {'chromeid': myID(),
	        'json': jsontext}
	).success(this.callbacks
	).error(this.onError);
};
ForwardChannel.prototype.ping = function() {
	this.sendMessage('ping', {'seqnum': s4()});
	window.setTimeout(this.ping.bind(this), 30000);
};

/**
 *
 */
function ReverseChannel(callbacks) {
	this.callbacks = callbacks.call.bind(callbacks);
	this.channel = null;
	this.socket = null;
	this.token = '';
}
ReverseChannel.prototype.open = function () {
	var options = loadOptions();

};
ReverseChannel.prototype.updateToken = function(token) {
	if (token != this.token) {
		this.channel = new goog.appengine.Channel(token);
		this.socket = this.channel.open();
		this.socket.onopen = this.onOpen.bind(this);
		this.socket.onerror = this.onError.bind(this);
		this.socket.onclose = this.onClose.bind(this);
		this.socket.onmessage = this.onMessage.bind(this);
	}
};
ReverseChannel.prototype.onOpen = function() {
	console.log('return channel onOpen!');
};
ReverseChannel.prototype.onError = function(error) {
	console.log('return channel onError!');
	console.log(error);
};
ReverseChannel.prototype.onClose = function() {
	console.log('return channel onClose!');
};
ReverseChannel.prototype.onMessage = function(incoming) {
	console.log('return channel onMessage!');
	this.callbacks(incoming['data']);
};

var callbacks = null;
var forward_channel = null;
var reverse_channel = null;
function setup() {
	console.log('setup!');

	callbacks = new Callbacks();

	// Get the javascript needed for the reverse channel
	$.getScript(loadOptions()['serverurl'] + '/_ah/channel/jsapi', setupChannels);
}
function setupChannels() {
	// Setup the reverse channel
	// This needs to be done before we ping the forward channel
	goog.appengine.Socket.BASE_URL = loadOptions()['serverurl'] + '/_ah/channel/';
	reverse_channel = new ReverseChannel(callbacks);

	// Setup the forward chanel
	forward_channel = new ForwardChannel(callbacks);

	// Get everything moving
	forward_channel.ping();

	restoreSession();
}
