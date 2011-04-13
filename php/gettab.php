<?php

include "common.php";

nocache();
json();
debug('Got Request');
check_common_prereq();

// Are we confirming a send tab?
$jsonp = trim(@$_GET['callback']);

// Are we confirming a send tab?
$confirmurl = trim(@$_GET['confirmurl']);
if (strlen($confirmurl) > 0) {
	$key = "confirm-$user-$chromeid-" . md5($confirmurl);
	debug("Confirming '$key'");
	$memcache->set($key, time(), $MEMCACHE_TIMEOUT);
	debug("Confirmed");
}

$result = "{}";

$startedat = time();
while ((time() - $startedat) < $TIMEOUT) {
	// Register that this chrome instance is connected
	$memcache->replace("lastseen-$user-$chromeid", time());

	$key = "url-$user-$chromeid";
	$urldata = $memcache->get($key);
	if ($memcache->getResultCode() == Memcached::RES_SUCCESS) {
		if (strlen(trim($urldata)) > 0) {
			$result = $urldata;
			$memcache->delete($key);
			break;
		}
	} else {
		debug("No url yet, looking for '$key'");
		sleep(1);
	}
}

if ($jsonp) {
	$result = "$jsonp($result);";
}
send_and_close($result);

