var sendTabLocation = 'http://localhost/sendtab.php';
var getTabLocation = 'http://localhost/gettab.php';
var myID = 'me';

function time() {
	return Math.round((new Date()).getTime() / 1000);
}

/**
 * This function injects code to send the tab's information to the background page.
 * This function is called from the popup.html.
 */
function sendTab(sendto, close) {
	console.log('sendTab ' + sendto + ' ' + close);

	// Send the URL and cookie data to the sendTab function.
	code = '' +
		'var jsondata = {'+
		'	"sendto": "'+sendto+'",'+
		'	"url": document.URL,'+
		'	"cookies": document.cookie'+
		'};';
	if (close){
		code = code +
		'jsondata["confirm"] = true;';
	}
	code = code +
		'chrome.extension.connect().postMessage(jsondata);';
	console.log(code);

	// Inject a script to get the tabs information.
	chrome.tabs.executeScript(null, {'code':code});
}

/**
 * This function receives the tab's information and uses ajax to post it to the server.
 * This function is called in the background.html.
 */
chrome.extension.onConnect.addListener(function(port) {
	var tab = port.sender.tab;

	port.onMessage.addListener(function(jsondata) {
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
		$.post(sendTabLocation, {'id': myID, 'urldata': jsontext, 'sendto': jsondata['sendto']}, 
			callback, 'json');
	});
});

/**
 * getTab runs in a loop via the $.getJSON command.
 */
var errors = 0;
var lastrunat = 0;
function getTab(incoming) {
	console.log(time() + " getTab");
	lastrunat = time();

	console.log('incoming:');
	console.log(incoming);

	var outgoing = {'id': myID, 'callback': 'getTab'};
	if (!$.isEmptyObject(incoming)) {
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

	console.log('outgoing:');
	console.log(outgoing);

	$.ajax({'url': getTabLocation,
	        'dataType': 'script',
		'data': outgoing}
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
