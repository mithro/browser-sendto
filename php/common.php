<?php

function nocache() {
	header('Cache-Control: no-cache');
	header('Cache-Control: private');
	header('Cache-Control: no-store');
	header('Cache-Control: must-revalidate');
	header('Cache-Control: max-stale=0');
	header('Cache-Control: max-age=0');
	header('Cache-Control: post-check=0');
	header('Cache-Control: pre-check=0');
	header('Keep-Alive: timeout=31, max=1');
	header('Expires: Thu, 01 Jan 1970 00:00:00 GMT'); # Expire in the past
	header('Pragma: No-cache'); # Special IE no-cache
}

function json() {
	header('Content-Type: application/json');
}

ob_start();
function send_and_close($text) {
        header('Connection: Close'); // Don't allow keep alive

	echo $text;

	$size = ob_get_length();
	header("Content-Length: $size");

	ob_end_flush();
	ob_flush();
	flush();

	session_write_close();
}

function debug($msg) {
	echo '// ' . time() . ' ' . $msg . "\n";
}


$user = null;
$chromeid = null;
function check_common_prereq() {
	global $user, $chromeid;

	// What is this chrome instance logged in as?
	$user = @$_COOKIE['BrowserSendTo-User'];
	if (strlen(trim($user)) == 0) { ?>
Not logged in!
	<?php 
		exit();
	}
	debug("My user is '$user'");


	// Get the ID of this chrome instance
	$chromeid = @$_GET['id'] . @$_POST['id'];
	if (strlen(trim($chromeid)) == 0) { ?>
No chrome id!
	<?php
		exit();
	}
	debug("My chrome ID is '$chromeid'");
}

$memcache = new Memcache;
$memcache->connect('localhost', 11211);

$HOST = 'localhost';
$TIMEOUT = 5;
$MEMCACHE_TIMEOUT = 30;
