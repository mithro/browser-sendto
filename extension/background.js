function error(msg) {
	alert(msg['message']);
}

/**
 * This function receives the tab's information and uses ajax to post it to the server.
 * This function is called in the background.html.
 */
chrome.extension.onConnect.addListener(function(port) {
	var tab = port.sender.tab;
	port.onMessage.addListener(function (jsondata) {
			console.log(time() + " sendTab (in background.html)");
			console.log(jsondata);

			// Are we going to close the tab?
			var callback = function(confirmtime) {};
			if (jsondata["confirm"]) {
				callback = function(confirmtime) {
					console.log("Got confirmation of tab received at "+confirmtime);
					console.log("Closing tab!" + tab.id);
					chrome.tabs.remove(tab.id);
				};
			}

			var jsontext = JSON.stringify(jsondata);
			console.log(jsontext);
			$.post(sendTabLocation, {
				'id': myID, 
				'urldata': jsontext, 
				'sendto': jsondata['sendto'],
				'cookie': cookie()}
				).success(callback
				).error(console.log);
		});
	});

/**
 * getTab runs in a loop via the $.getJSON command.
 */
var errors = 0;
var lastrunat = 0;
function getTab(incoming) {
	lastrunat = time();

	var outgoing = {'id': myID};
	if (incoming && "url" in incoming) {
		// Create the new tab!
		console.log('Create tab - ' + incoming['url']);
		chrome.tabs.create({'url': incoming['url']});

		// Reset the error count
		errors = 0;
		if (incoming['confirm']) {
			outgoing["confirmurl"] = incoming['url'];
		}
	} else {
		errors += 1;
	}

	$.ajax({'url': getTabLocation,
	        'dataType': 'jsonp',
		'data': outgoing}
		).success(getTab
		).error(restartGetTab);
}

/**
 * Automatically restart the getTab loop if it dies for any reason.
 */
function restartGetTab() {
	console.log(time() + " restartGetTab");
	if ((time() - lastrunat) > 40) {
		console.log(time() + " scheduling getTab");
		window.setTimeout(getTab, 0);
	}
	window.setTimeout(restartGetTab, 60*1000);
}
