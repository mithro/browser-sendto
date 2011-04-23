#!/bin/python

import StringIO
import logging
import hashlib
import time
import traceback

from google.appengine.api import channel
from google.appengine.api import memcache
from google.appengine.ext import webapp
from google.appengine.ext import db
from google.appengine.ext.webapp.util import run_wsgi_app

from django.utils import simplejson as json

import models

SECRET = 'mysecret'
TIMEOUT = 600

import jsonhelper
jsondumps = jsonhelper.JSONEncoder().encode


class JSONHandler(webapp.RequestHandler):

	def getinstances(self):
		instances = models.BrowserInstance.all()
		instances.filter('userid =', self.userid)
		
		r = []
		for instance in instances.fetch(100):
			if instance.chromeid == self.chromeid:
				self.instance.update()
				r.append(self.instance)
			else:
				r.append(instance)
		return r

	def call(self, instance, callbacks):
		channel.send_message(instance.channel, jsondumps(callbacks))

	def callone(self, instance, method, args):
		self.call(instance, [(method, args),])

	def callall(self, method, args):
		logging.info('My channel %s', self.instance.channel)
		for instance in self.getinstances():
			if instance.chromeid == self.chromeid:
				continue
			logging.info('(%s) Sending %s to %s on %s' % (self.chromeid, method, instance.chromeid, instance.channel))
			try:
				self.callone(instance, method, args)
			except channel.InvalidChannelClientIdError, e:
				logging.error('Tried to send to %s but it failed.. :(', instance)

	def return_callone(self, method, args):
		self.return_call([(method, args),])

	def return_call(self, callbacks):
		self.response.headers.add_header('Content-Type', 'application/javascript')
		self.response.out.write(jsondumps(callbacks))

	def return_error(self, e):
		tb = StringIO.StringIO()
		traceback.print_exc(file=tb)

		self.return_callone(
			'Error', {'msg': str(e), 'type': e.__class__.__name__, 'traceback': tb.getvalue()})

	def fresh(self, sendto, write_jsonp=True):
		# Check that the sendto destination has been seen recently
		instance = models.BrowserInstance.get(self.userid, sendto)
		if not instance:
				self.return_error(TypeError('Browser instance not found'))

		if (time.time() - instance.lastseen) > TIMEOUT:
			# Return the stale message
			self.return_callone('Stale', {'lastseen': instance.lastseen, 'now': time.time()})
			return False
		return instance

	def loggedin(self):
		if self.userid is None:
			self.return_callone('LoginNeeded', {})
			return False
		return True

	def post(self):
		# Pull out the username and chrome id
		self.userid = self.request.cookies.get('userid', None)
		self.chromeid = None
		self.callback = None

		incomingjson = None
		try:
			# Identifier for this chrome instance
			self.chromeid = self.request.get('chromeid', None)

			# incoming arguments (in json)
			incomingjson = json.loads(
				self.request.get('json', ''))
		except ValueError:
			try:
				# incoming arguments (in json)
				incomingjson = json.loads(self.request.body)

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
			if not self.userid or not self.chromeid:
				self.instance = None
			else:
				self.instance = models.BrowserInstance.create(
					self.userid, self.chromeid)

			try:
				self.json(*[], **incomingjson)
			finally:
				if self.instance:
					self.instance.put()

		except Exception, e:
			self.return_error(e)

	def json(self, incomingjson):
		raise NotImplimented()


class PingHandler(JSONHandler):
	def json(self, seqnum=None):
		if not self.loggedin():
			return

		assert seqnum

		d = {'seqnum': seqnum}
		self.return_callone('UpdateToken', {
			'token': channel.create_channel(self.instance.channel),
			'userid': self.userid})
		self.callone(self.instance, 'Pong', d)


class LoginHandler(JSONHandler):
	def json(self, username=None, password=None, **kw):
		logging.info("LoginHandler - %r %r %r", username, password, kw)
		assert username
		assert password

		try:
			user = models.User.create(username, password)
		except TypeError, e:
			self.return_error(e)
			return
		user.put()

		self.response.headers.add_header(
			'Set-Cookie', 
			'userid=%s; expires=Fri, 31-Dec-2020 23:59:59 GMT' % user.userid)

		self.instance = models.BrowserInstance.create(
			user.userid, self.chromeid)
		self.instance.extra = kw

		self.callall('UpdateBrowsers', self.getinstances())

		self.return_call(
			[('UpdateToken', {'token': channel.create_channel(self.instance.channel),
			                  'userid': self.userid}),
			 ('UpdateBrowsers', self.getinstances())])


class SendTabHandler(JSONHandler):
	def json(self, sendto=None, urldata=None, confirm=False, seqnum=None):
		assert sendto
		assert urldata

		if not self.loggedin():
			return

		sendinstance = self.fresh(sendto)
		if not sendinstance:
			return

		assert 'url' in urldata

		# Send a message off to the other chrome
		self.callone(sendinstance, 'NewTab', {
			'from': self.chromeid, 'urldata': urldata, 'confirm': confirm, 'seqnum': seqnum})


class ConfirmTabHandler(JSONHandler):
	def json(self, sendto=None, seqnum=None):
		assert sendto
		assert seqnum

		if not self.loggedin():
			return

		sendinstance = self.fresh(sendto)
		if not sendinstance:
			return

		# Send a message off to the other chrome
		self.callone(sendinstance, 'ConfirmedTab', 
				  {'from': self.chromeid, 'seqnum': seqnum})

class PinCreateHandler(JSONHandler):
	def json(self, **kw):
		assert 'remoteid' in kw

		pinned = models.BrowserPinnedTab(userid=self.userid, remoteid=kw['remoteid'], data=kw)
		pinned.put()

		self.callall('PinCreate', kw)


class PinDeleteHandler(JSONHandler):
	def json(self, **kw):
		assert 'remoteid' in kw

		q = models.BrowserPinnedTab.all(keys_only=True)
		q.filter('userid =', self.userid)
		q.filter('remoteid =', kw['remoteid'])
		db.delete(q.fetch(limit=1))
		
		self.callall('PinDelete', kw)


class PinUpdateHandler(JSONHandler):
	def json(self, **kw):
		assert 'remoteid' in kw

		q = models.BrowserPinnedTab.all()
		q.filter('userid =', self.userid)
		q.filter('remoteid =', kw['remoteid'])
		pinned = q.fetch(limit=1)

		if not pinned:
			self.return_callone('PinDelete', kw)
			return

		pinned[0].data = kw
		pinned[0].put()

		self.callall('PinUpdate', kw)



application = webapp.WSGIApplication([
    ('/ping', PingHandler),
    ('/login', LoginHandler),
    ('/sendtab', SendTabHandler),
    ('/confirmtab', ConfirmTabHandler),
    ('/pincreate', PinCreateHandler),
    ('/pindelete', PinDeleteHandler),
    ('/pinupdate', PinUpdateHandler),
], debug=True)


def main():
    run_wsgi_app(application)


if __name__ == '__main__':
    main()
