<?php

include "common.php";

nocache();
json();
debug('Got Request');
check_common_prereq();

// Are we confirming a send tab?
$confirmtab = trim(@$_GET['urlmd5']);
if (strlen($confirmtab) > 0) {
	$key = "confirm-$user-$chromeid-$confirmtab";
	debug("Confirming '$key'");
	$memcache->set($key, time(), 0, $MEMCACHE_TIMEOUT);
	debug("Confirmed");
}

$startedat = time();
while ((time() - $startedat) < $TIMEOUT) {
	// Register that this chrome instance is connected
	$memcache->replace("lastseen-$user-$chromeid", time());

	$key = "url-$user-$chromeid";
	$urldata = $memcache->get($key);
	if (strlen(trim($urldata)) > 0) {
		debug("Got a url!");

		send_and_close($urldata);
		$memcache->delete($key);
		break;
	} else {
		debug("No url yet, looking for '$key'");
		sleep(1);
	}
}

// Opps we timed out
debug('Timed out!');
send_and_close('');
