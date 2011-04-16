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


/*

var pinnedTabs = {windowid: [
 tab0, tab1, tab2]};

*/
var pinnedTabs = null;

function createTabStub(winid, index, tabid) {
	console.log('createstub -', winid, index, tabid);

	var data = {'localid': tabid};
	if (!(winid in pinnedTabs)) {
		pinnedTabs[winid] = [data];
	} else {
		pinnedTabs[winid].splice(index, 0, data);
	}
}
function moveTab(winid, from, to) {
	console.log('movetab -', winid, from, to);
	if (!(winid in pinnedTabs) || from >= pinnedTabs[winid].length) {
		return;
	}
	data = pinnedTabs[winid][from];
	pinnedTabs[winid].splice(from, 1);
	pinnedTabs[winid].splice(to, 0, data);

}
function updateTab(tab) {
	console.log('updatetab -', tab, tab.index);
	var newdata = {
		'title': tab.title,
		'url': tab.url,
		'favicon': tab.favIconUrl,
	};
	var currentdata = pinnedTabs[tab.windowId][tab.index];

	assert(tab.id == currentdata['localid']);

	for (var key in newdata) {
		currentdata[key] = newdata[key];
	}
}
function deleteTab(tabId) {
	console.log('deletetab -', tabId);
	for(var winid in pinnedTabs) {
		var tabs = pinnedTabs[winid];
		for (var i in tabs) {
			if (tabs[i]['localid'] == tabId) {
				tabs.splice(i, 1);
				break;
			}
		}
		if (tabs.length == [0]) {
			delete pinnedTabs[winid];
		}
	}	
}

chrome.tabs.onAttached.addListener(function(tabId, attachInfo) {
	console.log('attached -', tabId, attachInfo);
	if (!pinnedTabs)
		return;

	var winid = attachInfo['newWindowId'];
	var index = attachInfo['newPosition'];

	if (!(winid in pinnedTabs) ||
		(index >= pinnedTabs[winid].length)) {
		
		createTabStub(winid, index, tabId);
	}

	chrome.tabs.get(tabId, function(tab) {
		updateTab(tab);
	});
});

chrome.tabs.onCreated.addListener(function(tab) {
	console.log('created -', tab.id, tab);
	if (!pinnedTabs)
		return;

	if (tab.pinned) {
		createTabStab(tab.windowId, tab.index, tab.id);
		updateTab(tab);
	}
});

chrome.tabs.onDetached.addListener(function(tabId, detachInfo) {
	console.log('detached -', tabId, detachInfo);
	if (!pinnedTabs)
		return;

	deleteTab(tabId);
});

chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
	console.log('removed -', tabId, removeInfo);
	if (!pinnedTabs)
		return;

	deleteTab(tabId);
});

chrome.tabs.onMoved.addListener(function(tabId, moveInfo) {
	console.log('moved -', tabId, moveInfo, tab);
	if (!pinnedTabs)
		return;

	var winid = moveInfo['windowId'];
	var fromindex = moveInfo['fromIndex'];

	if ((winid in pinnedTabs) && (fromindex < pinnedTabs[winid].length)) {
		moveTab(winid, fromindex, moveInfo['toIndex']);
	}
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	console.log('updated -', tabId, changeInfo, tab);
	if (!pinnedTabs)
		return;

	
	var winid = tab.windowId;
	var index = tab.index;

	if (tab.pinned) {
		if ((winid in pinnedTabs) &&
			(index < pinnedTabs[winid].length)) {
			updateTab(tab);
		} else {
			// Create a new tab
			createTabStub(winid, index, tabId);
			updateTab(tab);
		}
	} else if ((winid in pinnedTabs) &&
			(index <= pinnedTabs[winid].length)) {
		deleteTab(tabId);
	}
});


function getLocalTabs() {
	pinnedTabs = {};
	chrome.windows.getAll({'populate': true}, function (windows) {
		console.log('windows', windows);
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
					createTabStub(tab.windowId, tab.index, tab.id);
					updateTab(tab);
				}
			}
		}
		console.log('getLocalTabs', pinnedTabs);
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

	getLocalTabs();	
}
