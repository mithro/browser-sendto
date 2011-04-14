<?php

if (strlen(@$_POST['login']) > 0) {
	$user = md5($SECRET . @$_POST['username'] . @$_POST['password']);
	header( "HTTP/1.1 302 Found" ); 
	header( "Location: http://localhost/login.php" );
	setcookie("BrowserSendTo-User", $user);
	exit();
}

?>
<html>
<body>
<?php 

$user = trim(@$_COOKIE['BrowserSendTo-User']);
if (strlen($user) > 0) { ?>
<p> You are logged in with cookie '<?php echo $user; ?>'</p>
<?php } else { ?>
	<form name="input" action="login.php" method="post">
		Username: <input type="text" name="username" value=""></input><br>
		Password: <input type="text" name="password" value=""></input><br>
		<input type="submit" name="login" value="Login!" />
	</form>
<?php } ?>
</body>
</html>
