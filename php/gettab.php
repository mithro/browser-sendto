<?php

include "common.php";

nocache();
json();
debug('Got Request');
check_common_prereq();

$lock = "getlock-$user-$chromeid";
$startedat = time();
while (!$memcache->add($lock, $_SERVER['REMOTE_ADDR'], 5)) {
	debug("Another client has the lock! ". $memcache->get($lock));
	sleep(1);

	if ((time() - $startedat) > $TIMEOUT) {
		debug("Memcache lock timed out!");
		exit();
	}
}

// Are we confirming a send tab?
$jsonp = trim(@$_GET['callback']);

// Are we confirming a send tab?
$confirmurl = trim(@$_GET['confirmurl']);
if (strlen($confirmurl) > 0) {
	$key = "confirm-$user-$chromeid-" . md5($confirmurl);
	debug("Confirming '$key'");
	$memcache->set($key, time(), 0, $MEMCACHE_TIMEOUT);
	debug("Confirmed");
}

$result = "{}";

$startedat = time();
while ((time() - $startedat) < $TIMEOUT) {
	// Register that this chrome instance is connected
	$memcache->replace("lastseen-$user-$chromeid", time());

	$key = "url-$user-$chromeid";
	$urldata = $memcache->get($key);
	if ($memcache->getResultCode() != Memcached::RES_NOTFOUND) {
		debug("Got a url!");
		debug('getting again "'.$memcache->get($key).'"');

		$result = "$urldata";
		debug("Deleting 1 '$key'");
		debug($memcache->delete($key));
		debug($memcache->getResultCode());
		debug($memcache->get($key));
		debug("Deleting 2 '$key'");
		debug($memcache->delete($key));
		debug($memcache->getResultCode());
		debug($memcache->get($key));
		debug("Deleting 3 '$key'");
		debug($memcache->delete($key));
		debug($memcache->getResultCode());
		debug($memcache->get($key));
		break;
	} else {
		debug("No url yet, looking for '$key'");
		sleep(1);
	}
}

if ($jsonp) {
	$result = "$jsonp($result);";
}
$memcache->delete($lock);
send_and_close($result);

