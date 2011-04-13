<?php

include "common.php"

nocache();
check_common_prereq();

// Are we confirming a send tab?
$confirmtab = $_GET['confirm'];
if (strlen(trim($chromeid)) > 0) {
	$memcache->replace("confirm-$user-$chromeid-$url", time(), 30);
}

$startat = time();
while (time() - $startedat < 120) {
	// Register that this chrome instance is connected
	$memcache->replace("lastseen-$user-$chromeid", time());

	$urldata = $memcache->get("url-$user-$chromeid");
	if (!strlen(trim($chromeid))) {
		send_and_close($urldata);
		$memcache->delete("url-$user-$chromeid");
		break;
	} else {
		sleep(1);
	}
}

// Opps we timed out
header("HTTP/1.1 302 Found");
header("Location: http://$host/gettab.php?id=$id");
