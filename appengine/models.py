import hashlib
import cPickle as pickle
import random
import string
import time

from google.appengine.ext import db
from google.appengine.api import memcache

from django.utils import simplejson as json

import jsonhelper
jsondumps = jsonhelper.JSONEncoder().encode

class JSONProperty(db.Property): 
  data_type = db.Text
  def get_value_for_datastore(self, model_instance):
    value = self.__get__(model_instance, model_instance.__class__)
    if value is not None:

      return db.Text(jsondumps(value))
  def make_value_from_datastore(self, value):
    if value is not None:
      return json.loads(str(value))

db.JSONProperty = JSONProperty


class User(db.Model):
	username = db.StringProperty(required=True)
	salt = db.StringProperty(required=True)
	hash = db.StringProperty(required=True)
	lastlogin = db.IntegerProperty(required=False)
	
	@classmethod
	def username2userid(cls, username):
		return 'userid='+hashlib.sha1(username).hexdigest()

	@property
	def userid(self):
		return self.username2userid(self.username)

	@classmethod
	def password2hash(self, salt, password):
		return hashlib.sha1(salt+password).hexdigest()

	@classmethod
	def newsalt(self):
		salt = []
		for i in range(0, 10):
			salt.append(random.choice(string.ascii_letters))
		return "".join(salt)

	@classmethod
	def create(cls, username, password):
		userid = cls.username2userid(username)

		obj = cls.getbyuserid(userid)
		if not obj:
			salt = cls.newsalt()
			hash = cls.password2hash(salt, password)
	    		obj = cls(key_name=userid, username=username, hash=hash, salt=salt)

		obj.checkpassword(password)
		obj.lastlogin = int(time.time())
		return obj

	@classmethod
	def getbyuserid(cls, userid):
		pickleobj = memcache.get(userid)
		if pickleobj is not None:
			obj = pickle.loads(pickleobj)
		else:
			obj = cls.get_by_key_name(userid)
		return obj

	@classmethod
	def getbyusername(cls, username):
		return cls.getbykey(cls.username2userid(username))

	def put(self, *args, **kw):
		pickleobj = pickle.dumps(self)
		memcache.set(self.userid, pickleobj)

		return db.Model.put(self, *args, **kw)

	def checkpassword(self, password):
		if self.hash != self.password2hash(self.salt, password):
			raise TypeError('WrongPassword')


class BrowserInstance(db.Model):
	userid = db.StringProperty(required=True)
	chromeid = db.StringProperty(required=True)
	name = db.StringProperty(required=False)
	lastseen = db.IntegerProperty(required=False)
	extra = db.JSONProperty(required=False)

	@classmethod
	def details2key(cls, userid, chromeid):
		return 'instance(%s, chromeid=%s)' % (userid, chromeid)

	@classmethod
	def create(cls, userid, chromeid, lastseen=None):
		key = cls.details2key(userid, chromeid)

		obj = cls.get(userid, chromeid)
		if not obj:
			obj = cls(key_name=key, userid=userid, chromeid=chromeid)

		if not lastseen:
			lastseen = int(time.time())

		obj.lastseen = lastseen
		return obj

	@classmethod
	def get(cls, *args):
		key = cls.details2key(*args)

		pickleobj = memcache.get(key)
		if pickleobj is not None:
			obj = pickle.loads(pickleobj)
		else:
			obj = cls.get_by_key_name(key)
		return obj

	def update(self):
		if self.extra and 'name' in self.extra:
			self.name = self.extra['name']

	def put(self, *args, **kw):
		self.update()
		pickleobj = pickle.dumps(self)
		memcache.set(
			self.details2key(self.userid, self.chromeid),
			pickleobj)

		return db.Model.put(self, *args, **kw)

	@property
	def channel(self):
		return hashlib.sha1(self.details2key(self.userid, self.chromeid)).hexdigest()


class BrowserPinnedTabs(db.Model):
	userid = db.StringProperty(required=True)
	window = db.StringProperty(required=True)
	tabs = db.StringListProperty(required=True)

	@classmethod
	def details2key(cls, userid, window):
		return 'pinned(%s, window=)' % (userid, window)

	@property
	def pinnedid(self):
		return self.details2key(self.userid, self.window)

	@classmethod
	def create(cls, userid, window):
		obj = cls.get(userid, window)
		if not obj:
	    		obj = cls(key_name=cls.details2key(userid, window),
			          userid=userid, window=window, tabs=[])
		return obj

	@classmethod
	def get(cls, *args):
		key = cls.details2key(*args)

		pickleobj = memcache.get(key)
		if pickleobj is not None:
			obj = pickle.loads(pickleobj)
		else:
			obj = cls.get_by_key_name(key)
		return obj

	def put(self, *args, **kw):
		pickleobj = pickle.dumps(self)
		memcache.set(
			self.details2key(self.userid, self.window),
			pickleobj)

		return db.Model.put(self, *args, **kw)
