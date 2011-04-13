var sendTabLocation = 'http://localhost/sendtab.php';
var getTabLocation = 'http://localhost/gettab.php';
var myID = 'me';

function time() {
	return Math.round((new Date()).getTime() / 1000);
}

function cookie() {
	return Math.floor(Math.random()*1e6);
}
