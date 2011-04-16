#!/bin/python

import StringIO
import logging
import hashlib
import time
import traceback

from google.appengine.ext import webapp
from google.appengine.api import channel
from google.appengine.ext.webapp.util import run_wsgi_app
from google.appengine.api import memcache

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
			self.callone(instance, method, args)

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

class CreatePinHandler(JSONHandler):
	def json(self, index=None, data=None):
		assert index
		assert data

		models.BrowserPinnedTab(userid=self.userid, index=index, data=data)

		instances = models.BrowserInstance.all()
		instances.filter('userid =', self.userid)

		for instance in instances.fetch():
			self.callone(instance, 'CreatePinTab', data)

class CreatePinHandler(JSONHandler):
	def json(self, index=None, data=None):
		assert index
		assert data

		data['remoteid'] = User.newsalt()

		pinned = models.BrowserPinnedTab.create(userid=self.userid)
		pinned.tabs.insert(index, data)
		pinned.put()

		data['index'] = index
		self.callall('CreatePinTab', data)
		self.return_callone('UpdatePinTab', data)


class DeletePinHandler(JSONHandler):
	def json(self, tabid=None, window=None, index=None):
		assert tabid
		assert window
		assert index
		assert data

		pinned = models.BrowserPinnedTab.create(userid=self.userid, window=window)
		assert pinned.tabs[index] == tabid
		del pinned.tabs[index]
		pinned.put()

		data['index'] = index
		self.callall('DeletePinTab', data)

class DeletePinHandler(JSONHandler):
	def json(self, tabid=None, window=None, index=None):
		assert tabid
		assert window
		assert index

		pinned = models.BrowserPinnedTab.create(userid=self.userid, window=window)
		assert pinned.tabs[index] == tabid
		del pinned.tabs[index]
		pinned.put()

		data['index'] = index
		self.callall('DeletePinTab', data)


class UpdatePinHandler(JSONHandler):
	def json(self, tabid=None, window=None, index=None, data=None):
		assert tabid
		assert index
		assert window
		assert data

		pinned = models.BrowserPinnedTab.create(userid=self.userid, window=window)
		assert pinned.tabs[index] == tabid
		pinned.tabs[index] = data
		pinned.put()

		data['index'] = index
		self.callall('UpdatePinTab', data)


class MovePinHandler(JSONHandler):
	def json(self, tabid=None, oldindex=None, newindex=None, window=None):
		assert tabid
		assert oldindex
		assert newindex

		pinned = models.BrowserPinnedTab.create(userid=self.userid, window=window)
		assert pinned.tabs[oldindex] == tabid

		data = pinned.tabs[oldindex]
		del pinned.tabs[oldindex]
		pinned.tabs.insert(newindex, data)

		pinned.put()

		self.callall('MovePinTab', data)



application = webapp.WSGIApplication([
    ('/ping', PingHandler),
    ('/login', LoginHandler),
    ('/sendtab', SendTabHandler),
    ('/confirmtab', ConfirmTabHandler),
    ('/createpin', CreatePinHandler),
    ('/deletepin', DeletePinHandler),
    ('/updatepin', UpdatePinHandler),
    ('/movepin', MovePinHandler),
], debug=True)


def main():
    run_wsgi_app(application)


if __name__ == '__main__':
    main()
