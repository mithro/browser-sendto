<?php

include "common.php";

nocache();
json();
debug('Got Request');
check_common_prereq();

// Are we confirming a send tab?
$confirmtab = @$_GET['urlmd5'];
if (strlen(trim($confirmtab)) > 0) {
	debug("Confirming $confirmtab");
	$memcache->replace("confirm-$user-$chromeid-$confirmtab", time(), $MEMCACHE_TIMEOUT);
	debug("Confirmed");
}

$startedat = time();
while ((time() - $startedat) < $TIMEOUT) {
	// Register that this chrome instance is connected
	$memcache->replace("lastseen-$user-$chromeid", time());

	$urldata = $memcache->get("url-$user-$chromeid");
	if (strlen(trim($urldata)) > 0) {
		debug("Got a url!");

		send_and_close($urldata);
		$memcache->delete("url-$user-$chromeid");
		break;
	} else {
		debug("No url yet, looking for 'url-$user-$chromeid'");
		sleep(1);
	}
}

// Opps we timed out
debug('Timed out!');
send_and_close('');
