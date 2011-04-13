<?php

include "common.php";

nocache();
json();
check_common_prereq();

debug("Got request");

// Get the ID of the chrome instance we are sending too
$sendto = @$_POST['sendto'];
if (strlen(trim($sendto)) == 0) { ?>
No sendto id!
<?php 
	exit();
}
debug("Sending to '$sendto'");

// Get the url data to send
$urldata = $_POST['urldata'];
if (strlen(trim($urldata)) == 0) { ?>
No url data to send!
<?php 
	exit();
}

// Decode the urldata json, and confirm that it's valid...
$urldata_decoded = json_decode($urldata, true);
if (json_last_error() != JSON_ERROR_NONE) { ?>
Was unable to decode the url data!
<?php 
	// Define the errors.
	$json_errors = array(
	    JSON_ERROR_NONE => 'No error has occurred',
	    JSON_ERROR_DEPTH => 'The maximum stack depth has been exceeded',
	    JSON_ERROR_CTRL_CHAR => 'Control character error, possibly incorrectly encoded',
	    JSON_ERROR_SYNTAX => 'Syntax error',
	);

	debug($json_errors[json_last_error()]);
	exit();
}
debug("Incoming JSON decoded okay");

// We only keep the URL for 15 seconds as if it hasn't been sent by then, something is borked...
$startedat = time();
debug("Added at 'url-$user-$sendto'");
while (!$memcache->add("url-$user-$sendto", $urldata, MEMCACHE_COMPRESSED, $MEMCACHE_TIMEOUT)) {
	debug("Memcache rejected add");
	sleep(1);

	if ((time() - $startedat) > $TIMEOUT) {
		debug("Memcache add timed out!");
		exit();
	}
}

// Are we confirming a send tab?
if (!$urldata_decoded['confirm']) {
	debug("No confirmation requested. Returning straight away.");
	send_and_close(json_encode(-1));
} else {
	debug("Confirmation requested. Waiting.");
	debug("$url");
	$urlmd5 = md5($urldata_decoded['url']);

	$startedat = time();
	while ((time() - $startedat) < $TIMEOUT) {
		$confirmtime = $memcache->get("confirm-$user-$sendto-$urlmd5");
		if ($confirmtime) {
			debug("Got confirmation!");
			send_and_close(json_encode($confirmtime));
			$memcache->delete("confirm-$user-$sendto-$urlmd5");
			break;
		} else {
			debug("No confirmation yet.");
			sleep(1);
		}
	}
}
