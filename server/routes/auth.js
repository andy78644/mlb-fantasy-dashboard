const express = require('express');
const passport = require('passport');
const router = express.Router();
const { ensureAuth } = require('../middleware/authMiddleware'); // Import auth middleware
const authController = require('../controllers/authController'); // Import controller
const querystring = require('querystring'); // Import querystring module

// @route   GET /api/auth/yahoo
// @desc    Initiate Yahoo OAuth2 authentication
// @access  Public
// Manually redirect the user to Yahoo's authorization page
router.get('/yahoo', (req, res) => {
  const yahooAuthUrl = 'https://api.login.yahoo.com/oauth2/request_auth';
  const params = querystring.stringify({
    client_id: process.env.YAHOO_CLIENT_ID,
    redirect_uri: process.env.YAHOO_REDIRECT_URI,
    response_type: 'code',
    // Add any specific scopes needed for fantasy sports here, e.g.:
    // scope: 'fspt-r'
  });
  console.log('Redirecting to Yahoo Auth URL:', `${yahooAuthUrl}?${params}`); // Log the URL for debugging
  res.redirect(`${yahooAuthUrl}?${params}`);
});

// @route   GET /api/auth/yahoo/callback
// @desc    Yahoo OAuth2 callback URL
// @access  Public
// Passport handles the code exchange and user profile fetching here
router.get(
  '/yahoo/callback',
  passport.authenticate('yahoo', {
    failureRedirect: '/login', // Redirect on failure (adjust frontend route)
    successRedirect: '/dashboard' // Redirect on success (adjust frontend route)
    // Instead of redirecting here, let the frontend handle it after getting user data
  }),
  (req, res) => {
    // On success, Passport adds user to req.user and session is established.
    // Redirect to a frontend route that can then fetch user data.
    console.log('User authenticated successfully:', req.user); // Log user data for debugging
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000/dashboard'); // Redirect to frontend dashboard
  }
);

// @route   GET /api/auth/user
// @desc    Get authenticated user data
// @access  Private
router.get('/user', ensureAuth, authController.getUser); // Protect route and use controller

// @route   GET /api/auth/logout
// @desc    Log user out
// @access  Private
router.get('/logout', ensureAuth, (req, res, next) => { // Protect route
  req.logout(function(err) {
    if (err) { return next(err); }
    req.session.destroy((err) => { // Destroy session data
        if (err) {
            console.log('Error : Failed to destroy the session during logout.', err);
            return next(err);
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        // Redirect to frontend home/login page
        res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000/');
    });
  });
});

module.exports = router;
