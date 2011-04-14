<?php

function nocache() {
	header('Cache-Control: no-cache', false);
	header('Cache-Control: private', false);
	header('Cache-Control: no-store', false);
	header('Cache-Control: must-revalidate', false);
	header('Cache-Control: max-stale=0', false);
	header('Cache-Control: max-age=0', false);
	header('Cache-Control: post-check=0', false);
	header('Cache-Control: pre-check=0', false);
	header('Keep-Alive: timeout=31, max=1', false);
	header('Expires: Thu, 01 Jan 1970 00:00:00 GMT', false); # Expire in the past
	header('Pragma: No-cache', false); # Special IE no-cache
}

function jsonp_decode($jsonp, $assoc = false) {
	if($jsonp[0] !== '[' && $jsonp[0] !== '{') {
		$jsonp = substr($jsonp, strpos($jsonp, '(')+1);
		$jsonp = substr($jsonp, 0, strrpos($jsonp, ')'));
	}
	return json_decode($jsonp, $assoc);
}

$debug = array();
function debug($msg) {
	global $debug;

	$msg_lines = explode("\n", "$msg");

	$first = true;
	foreach($msg_lines as $line) {
		if ($first) {
			$debug[] = '// ' . time() . ' ' . $line . "\n";
			$first = false;
		} else {
			$debug[] = '//            ' . $line . "\n";
		}
	}
}

function jsonp_output($data, $callback = false) {
	global $debug;

	nocache();
	//header('Content-Type: text/javascript; charset=utf-8');
	header('Content-Type: text/jsonp; charset=utf-8');
	// Push in the debugging information
	@$data['__debug'] = $debug;

	// Extract callback from request?
	if (!$callback) {
		$callback = trim(@$_GET['callback']);
	}

	if ($callback)
		echo "$callback(\n";
	echo json_encode($data, JSON_HEX_TAG|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_HEX_AMP);
	if ($callback)
		echo ");";
}

$LOGIN = 0;
$MALFORMED = 1;
$TIMEOUT = 2;
function error($code, $msg) {
	jsonp_output(array('code' => $code, 'message' => $msg), $callback='error');
	exit();
}


$user = null;
$chromeid = null;
function check_common_prereq() {
	global $LOGIN;
	global $user, $chromeid;

	debug('Got request!');

	debug('_COOKIE:');
	debug(var_export($_COOKIE, true));

	// What is this chrome instance logged in as?
	$user = trim(@$_COOKIE['BrowserSendTo-User']);
	if (strlen($user) == 0) {
		error($LOGIN, "Not logged in!");
	}
	debug("My user is '$user'");

	debug('_GET:');
	debug(var_export($_GET, true));

	// Get the ID of this chrome instance
	$chromeid = trim(@$_GET['id'] . @$_POST['id']);
	if (strlen($chromeid) == 0) {
		error($MALFORMED, "No chrome id!");
	}
	debug("My chrome ID is '$chromeid'");
}

$memcache = new Memcached();
$memcache->addServer('localhost', 11211);

$HOST = 'localhost';
$TIMEOUT = 5;
$MEMCACHE_TIMEOUT = 3000;
