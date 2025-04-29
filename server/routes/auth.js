const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/authMiddleware'); // Keep for now, will update later
const authController = require('../controllers/authController'); // Keep for now, might need updates
const yahooApiService = require('../utils/yahooApiService'); // Import the new service

// @route   GET /api/auth/yahoo/callback
// @desc    Yahoo OAuth2 callback URL - Manual Handling
// @access  Public
router.get('/yahoo/callback', async (req, res) => {
  console.log('DEBUG: Received /api/auth/yahoo/callback request.');
  const { code } = req.query;

  if (!code) {
    console.warn('WARN: No authorization code found in query.');
    return res.redirect((process.env.FRONTEND_URL || 'http://localhost:3000') + '/login?error=no_code');
  }

  try {
    console.log('DEBUG: Attempting to exchange code for tokens...');
    const tokenData = await yahooApiService.getInitialAuthorization(code);

    if (tokenData && tokenData.access_token && tokenData.refresh_token) {
      console.log('DEBUG: Tokens received successfully. Storing in session.');
      // Store tokens securely in the session
      req.session.yahooTokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in, // Store expiry time (in seconds)
        tokenTimestamp: Date.now() // Store timestamp when token was received
      };

      // Optionally, save user info if needed, but tokens are the priority
      req.session.user = { yahooGuid: tokenData.xoauth_yahoo_guid }; // Example

      console.log('DEBUG: Redirecting to dashboard.');
      // Redirect to the frontend dashboard upon successful login
      return res.redirect('http://localhost:3000/dashboard');
    } else {
      console.error('ERROR: Invalid token data received from Yahoo.', tokenData);
      return res.redirect((process.env.FRONTEND_URL || 'http://localhost:3000') + '/login?error=token_exchange_failed');
    }
  } catch (error) {
    console.error('ERROR: Failed to exchange authorization code:', error.message);
    // Pass a more specific error if possible
    const errorQuery = error.message.includes('invalid_grant') ? 'invalid_code' : 'token_exchange_error';
    return res.redirect((process.env.FRONTEND_URL || 'http://localhost:3000') + `/login?error=${errorQuery}`);
  }
});

// @route   GET /api/auth/status
// @desc    Check user authentication status based on session tokens
// @access  Public (or Private depending on needs)
router.get('/status', (req, res) => {
  if (req.session.yahooTokens && req.session.yahooTokens.accessToken) {
    // Basic check: token exists. Could add expiry check here.
    // Expiry check example:
    // const now = Date.now();
    // const expiryTime = req.session.yahooTokens.tokenTimestamp + (req.session.yahooTokens.expiresIn * 1000);
    // if (now < expiryTime - (60 * 1000)) { // Check if token expires in more than 60 seconds
    //   res.json({ isAuthenticated: true });
    // } else {
    //   res.json({ isAuthenticated: false, reason: 'token_expired' });
    // }
    res.json({ isAuthenticated: true });
  } else {
    res.json({ isAuthenticated: false });
  }
});


// @route   GET /api/auth/user
// @desc    Get authenticated user data (placeholder - might need adjustment)
// @access  Private
router.get('/user', ensureAuth, authController.getUser);

// @route   GET /api/auth/logout
// @desc    Log user out by destroying the session
// @access  Private (or Public if called after session check)
router.get('/logout', (req, res, next) => { // ensureAuth might be removed if called from frontend after status check
  console.log('DEBUG: Received /api/auth/logout request.');
  if (req.session) {
    req.session.destroy((err) => { // Destroy session data
      if (err) {
        console.error('ERROR: Failed to destroy the session during logout:', err);
        return res.status(500).json({ message: 'Failed to logout' }); // Send error response
      }
      console.log('DEBUG: Session destroyed successfully.');
      res.clearCookie('connect.sid'); // Clear the session cookie
      // Send success response instead of redirect, let frontend handle navigation
      res.status(200).json({ message: 'Logged out successfully' });
      // Or redirect if preferred:
      // res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000/');
    });
  } else {
    // No session exists, arguably already logged out
    res.status(200).json({ message: 'No active session' });
  }
});

module.exports = router;
