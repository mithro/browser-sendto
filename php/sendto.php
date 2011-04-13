<?php

include "common.php"

nocache();
check_common_prereq();

// Get the ID of the chrome instance we are sending too
$chromeid = $_GET['sendto'];
if (strlen(trim($chromeid)) == 0) { ?>
No sendto id!
<?php }

// Get the url data to send
$urldata = $_POST['urldata'];
if (strlen(trim($urldata)) == 0) { ?>
No url data to send! (POST)
<?php }

// Decode the urldata json, and confirm that it's valid...
$urldata_decoded = json_decode($urldata, true);
// FIXME: Do the check here
if (!$urldata_decoded) { ?>
Was unable to decode the url data!
<?php }

// We only keep the URL for 15 seconds as if it hasn't been sent by then, something is borked...
while (!$memcache->add("url-$user-$chromeid", $urldata, MEMCACHE_COMPRESSED, 15))
	sleep(1);

// Are we confirming a send tab?
if ($urldata_decoded['confirm']) {
	send_and_close(json_encode(-1));
} else {
	$url = $urldata_decoded['url'];

	$startedat = time();
	while (time() - $startedat < 120) {
		$confirmtime = $memcache->get("confirm-$user-$chromeid-$url");
		if ($confirmtime) {
			send_and_close(json_encode($confirmtime));
			$memcache->delete("confirm-$user-$chromeid-$url");
			break;
		} else {
			sleep(1);
		}
	}
}
