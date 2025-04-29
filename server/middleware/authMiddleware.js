module.exports = {
  ensureAuth: function (req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    } else {
      // Could redirect to login or send 401
      res.status(401).json({ message: 'Not authenticated' });
      // res.redirect('/'); // Or redirect to a login page if not an API
    }
  },
  ensureGuest: function (req, res, next) {
    if (req.isAuthenticated()) {
      res.redirect('/dashboard'); // Redirect logged-in users away from guest pages
    } else {
      return next();
    }
  },
};
