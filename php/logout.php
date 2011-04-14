<?php
header( "HTTP/1.1 302 Found" ); 
header( "Location: http://localhost/login.php" );
setcookie("BrowserSendTo-User", '');
