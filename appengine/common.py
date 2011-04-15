#!/bin/python

import StringIO
import logging
import hashlib
import time
import traceback
import json

from google.appengine.ext import webapp
from google.appengine.api import channel
from google.appengine.ext.webapp.util import run_wsgi_app
from google.appengine.api import memcache


SECRET = 'mysecret'
TIMEOUT = 600


class JSONHandler(webapp.RequestHandler):
	def write_jsonp(self, data):
		self.response.headers.add_header('Content-Type', 'application/javascript')

		if self.callback:
			self.response.out.write(self.callback+'(')
		self.response.out.write(json.dumps(data))
		if self.callback:
			self.response.out.write(');')

	def fresh(self, sendto, write_jsonp=True):
		# Check that the sendto destination has been seen recently
		lastseen_sendto = memcache.get('lastseen-%s-%s' % (self.userid, sendto))
		if not lastseen_sendto:
			lastseen_sendto = 0

		if (time.time() - lastseen_sendto) > TIMEOUT:
			if write_jsonp:
				# Return the stale error message
				self.write_jsonp((
					'Stale', {'lastseen': lastseen_sendto, 
					          'now': time.time()}
				))
			return False
		return True

	def loggedin(self):
		if self.userid is None:
			self.write_jsonp(('login', {}))
			return False
		return True

	def get(self):
		# Pull out the username and chrome id
		self.userid = self.request.cookies.get('userid', None)
		self.chromeid = self.request.get('chromeid', None)		
		self.callback = self.request.get('callback', None)

		try:
			assert self.chromeid is not None

			# Check in to the server.
			memcache.set(
				'lastseen-%s-%s' % (self.userid, self.chromeid), time.time())

			self.json(*[], **incomingjson)
		except Exception, e:
			self.write_jsonp_error(e)

	def write_jsonp_error(self, e):
		tb = StringIO.StringIO()
		traceback.print_exc(file=tb)

		self.write_jsonp((
			'Error', {'msg': str(e), 
					  'type': e.__class__.__name__,
					  'traceback': tb.getvalue()}
		))

	def post(self):
		# Pull out the username and chrome id
		self.userid = self.request.cookies.get('userid', None)
		self.chromeid = None
		self.callback = None

		incomingjson = None
		try:
			# Identifier for this chrome instance
			self.chromeid = self.request.get('chromeid', None)

			# jsonp style callback
			self.callback = self.request.get('callback', None)

			# incoming arguments (in json)
			incomingjson = json.loads(
				self.request.get('json', ''))
		except ValueError:
			try:
				# incoming arguments (in json)
				incomingjson = json.loads(self.request.body)

				# jsonp style callback
				if 'callback' in incomingjson:
					self.callback = incomingjson['callback']
					del incomingjson['callback']
				else:
					self.callback = self.request.get('callback', None)
				
				# Identifier for this chrome instance
				self.chromeid = incomingjson['chromeid']
				del incomingjson['chromeid']
			except (ValueError, KeyError):
				pass

		if not incomingjson:
			incomingjson = {}

		try:
			assert self.chromeid is not None

			# Check in to the server.
			memcache.set(
				'lastseen-%s-%s' % (self.userid, self.chromeid), time.time())

			logging.info("json - %r", incomingjson)
			logging.info("json - %r", type(incomingjson))
			self.json(*[], **incomingjson)
		except Exception, e:
			self.write_jsonp_error(e)

	def json(self, incomingjson):
		raise NotImplimented()

	@property
	def mychannelkey(self):
		return hashlib.sha1(self.userid+self.chromeid).hexdigest()

	def call(self, chromeid, method, args):
		channelid = hashlib.sha1(self.userid+chromeid).hexdigest()
		
		channel.send_message(channelid, json.dumps((
			method, args
		)))


class PingHandler(JSONHandler):
	def json(self, seqnum=None):
		if not self.loggedin():
			return

		assert seqnum

		d = {'seqnum': seqnum}
		self.write_jsonp(('Ping', d))
		self.call(self.chromeid, 'Pong', d)


class LoginHandler(JSONHandler):
	def json(self, username=None, password=None, title=None, **kw):
		logging.info("LoginHandler - %r %r %r %r", username, password, title, kw)
		if self.userid is None:
			assert username
			assert password

			self.userid = hashlib.md5(SECRET+username+password).hexdigest()
			self.response.headers.add_header(
				'Set-Cookie', 
				'userid=%s; expires=Fri, 31-Dec-2020 23:59:59 GMT' % self.userid)

		if title:
			# FIXME: Set the title here, send a message to all other clients
			# about title change.
			pass

		self.write_jsonp({
			'token': channel.create_channel(self.mychannelkey),
			'userid': self.userid})


class SendTabHandler(JSONHandler):
	def json(self, sendto=None, urldata=None, confirm=False, seqnum=None):
		assert sendto
		assert urldata

		if not self.loggedin():
			return

		if not self.fresh(sendto):
			return

		assert 'url' in urldata

		# Send a message off to the other chrome
		self.call(sendto, 'NewTab', 
				  {'from': self.chromeid, 'urldata': urldata,
		           'confirm': confirm, 'seqnum': seqnum})


class ConfirmTabHandler(JSONHandler):
	def json(self, sendto=None, seqnum=None):
		assert sendto
		assert seqnum

		if not self.loggedin():
			return

		if not self.fresh(sendto):
			return

		# Send a message off to the other chrome
		self.call(sendto, 'ConfirmedTab', 
				  {'from': self.chromeid, 'seqnum': seqnum})


application = webapp.WSGIApplication([
    ('/ping', PingHandler),
    ('/login', LoginHandler),
    ('/sendtab', SendTabHandler),
    ('/confirmtab', ConfirmTabHandler),
], debug=True)


def main():
    run_wsgi_app(application)


if __name__ == '__main__':
    main()
