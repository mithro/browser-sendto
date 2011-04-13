<?php

include "common.php";

nocache();
json();
check_common_prereq();

debug('_POST');
debug(var_export($_POST, true));

// Get the ID of the chrome instance we are sending too
$sendto = trim(@$_POST['sendto']);
if (strlen($sendto) == 0) { ?>
No sendto id!
<?php 
	exit();
}
debug("Sending to '$sendto'");

// Get the url data to send
$urldata = trim($_POST['urldata']);
if (strlen($urldata) == 0) { ?>
No url data to send!
<?php 
	exit();
}

// Decode the urldata json, and confirm that it's valid...
debug("Undecoded data:\n$urldata");
$urldata_decoded = jsonp_decode($urldata, true);
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
debug("Decoded data:\n" . var_export($urldata_decoded, true));

// We only keep the URL for 15 seconds as if it hasn't been sent by then, something is borked...
$key = "url-$user-$sendto";
debug("Adding data at '$key'");
$startedat = time();
do {
	$memcache->add($key, $urldata, $MEMCACHE_TIMEOUT);

	debug("Memcache rejected add");
	sleep(1);

	if ((time() - $startedat) > $TIMEOUT) {
		debug("Memcache add timed out!");
		exit();
	}
} while ($m->getResultCode() != Memcached::RES_SUCCESS);

// Are we confirming a send tab?
if (!@$urldata_decoded['confirm']) {
	debug("No confirmation requested. Returning straight away.");
	send_and_close(json_encode(-1));
} else {
	$url = $urldata_decoded['url'];
	$urlmd5 = md5($url);
	debug("Confirmation requested. Waiting.");
	debug("URL '{$urldata_decoded['url']}' - md5sum - '$urlmd5'");

	$key = "confirm-$user-$sendto-$urlmd5";
	$startedat = time();
	while ((time() - $startedat) < $TIMEOUT) {
		$confirmtime = $memcache->get($key);
		if ($memcache->getResultCode() != Memcached::RES_NOTFOUND) {
			debug("Got confirmation!");
			send_and_close(json_encode($confirmtime));
			$memcache->delete($key);
			break;
		} else {
			debug("No confirmation yet - '$key'.");
			sleep(1);
		}
	}
}
