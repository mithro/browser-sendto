<?php

setcookie("BrowserSendTo-User", 'testing');
header( "HTTP/1.1 302 Found" ); 
header( "Location: http://localhost/" ); 
