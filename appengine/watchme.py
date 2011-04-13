import time

from google.appengine.api import users
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app

def nocache(f):
	def wrapped(self, *args, **kw):
		self.response.headers.add_header("Cache-Control", "no-cache")
		self.response.headers.add_header("Cache-Control", "private")
		self.response.headers.add_header("Cache-Control", "no-store")
		self.response.headers.add_header("Cache-Control", "must-revalidate")
		self.response.headers.add_header("Cache-Control", "max-stale=0")
		self.response.headers.add_header("Cache-Control", "max-age=0")
		self.response.headers.add_header("Cache-Control", "post-check=0")
		self.response.headers.add_header("Cache-Control", "pre-check=0")
		self.response.headers.add_header("Keep-Alive", "timeout=31, max=1")
		self.response.headers.add_header("Expires", "Thu, 01 Jan 1970 00:00:00 GMT") # Expire in the past
		self.response.headers.add_header("Pragma", "No-cache") # Special IE no-cache
		return f(self, *args, **kw)
	return wrapped

class WatchMeMainHandler(webapp.RequestHandler):

	@nocache
	def get(self):
		user = users.get_current_user()
#		if not user:
#			self.redirect('/login?url=/watchme')
#			return

		try:
			while True:
				time.sleep(35)

		except DeadlineExceededError:
			# Make sure the redirect 
			# Redirect back to myself...
			self.redirect("/watchme?_really=%i" % self.request.get('_really', 0))


application = webapp.WSGIApplication([
    ('/watchme', WatchMeMainHandler),
], debug=True)

def main():
    run_wsgi_app(application)
