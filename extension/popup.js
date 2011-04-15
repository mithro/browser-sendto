/**
 * This function injects code to send the tab's information to the background page.
 * This function is called from the popup.html.
 */
function sendTab(sendto, close) {
	console.log('sendTab ' + sendto + ' ' + close);

	sendto = myID();

	// Send the URL and cookie data to the sendTab function.
	code = '' +
		'var jsondata = {'+
		'	"sendto": "'+sendto+'",'+
		'	"urldata": {' +
		'		"url": document.URL,'+
		'		"cookies": document.cookie'+
		'	}'+
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

	//window.close()
}
