const yahooApiService = require('../utils/yahooApiService'); // Import the service for refresh logic

// Helper function to check if token is expired or close to expiring
const isTokenExpired = (tokenData) => {
  if (!tokenData || !tokenData.tokenTimestamp || !tokenData.expiresIn) {
    return true; // Cannot determine expiry, assume expired
  }
  const now = Date.now();
  // Check if token expires within the next 60 seconds (buffer)
  const expiryTime = tokenData.tokenTimestamp + (tokenData.expiresIn * 1000);
  return now >= expiryTime - (60 * 1000);
};

module.exports = {
  ensureAuth: async function (req, res, next) {
    console.log('DEBUG: ensureAuth middleware checking session...');
    let tokens = req.session.yahooTokens;

    if (!tokens || !tokens.accessToken) {
      console.warn('WARN: No access token found in session.');
      return res.status(401).json({ message: 'Not authenticated: No token' });
    }

    if (isTokenExpired(tokens)) {
      console.log('DEBUG: Access token expired or nearing expiry, attempting refresh...');
      if (!tokens.refreshToken) {
        console.warn('WARN: Refresh token missing, cannot refresh.');
        // Clear potentially invalid tokens and deny access
        delete req.session.yahooTokens;
        return res.status(401).json({ message: 'Authentication expired: Refresh token missing' });
      }

      try {
        const newTokenData = await yahooApiService.refreshAuthorizationToken(tokens.refreshToken);
        if (newTokenData && newTokenData.access_token) {
          console.log('DEBUG: Token refresh successful. Updating session.');
          // Update session with new tokens and timestamp
          req.session.yahooTokens = {
            accessToken: newTokenData.access_token,
            // Yahoo might send a new refresh token, or the old one might persist
            refreshToken: newTokenData.refresh_token || tokens.refreshToken,
            expiresIn: newTokenData.expires_in,
            tokenTimestamp: Date.now()
          };
          // Add the fresh access token to the request object for the current request
          req.accessToken = newTokenData.access_token;
          console.log('DEBUG: Proceeding with refreshed token.');
          return next(); // Proceed with the request using the new token
        } else {
          console.error('ERROR: Token refresh failed or returned invalid data.', newTokenData);
          // Clear invalid tokens and deny access
          delete req.session.yahooTokens;
          return res.status(401).json({ message: 'Authentication failed: Could not refresh token' });
        }
      } catch (error) {
        console.error('ERROR: Exception during token refresh:', error.message);
        // Clear invalid tokens and deny access
        delete req.session.yahooTokens;
        // Check if the error indicates an invalid refresh token
        if (error.message.includes('invalid_grant')) {
            return res.status(401).json({ message: 'Authentication expired: Invalid refresh token' });
        } else {
            return res.status(401).json({ message: 'Authentication failed: Token refresh error' });
        }
      }
    } else {
      // Token is valid, add it to the request object for easy access in controllers
      req.accessToken = tokens.accessToken;
      console.log('DEBUG: Valid access token found in session. Proceeding.');
      return next(); // Proceed with the request
    }
  },

  // ensureGuest might not be relevant anymore if login is always manual
  // Or it could check if yahooTokens *don't* exist
  ensureGuest: function (req, res, next) {
    if (!req.session.yahooTokens || !req.session.yahooTokens.accessToken) {
      return next(); // No token, user is a guest
    } else {
      // User has tokens, redirect them away from guest pages (like login)
      console.log('DEBUG: ensureGuest detected authenticated user, redirecting to dashboard.');
      res.redirect((process.env.FRONTEND_URL || 'http://localhost:3000') + '/dashboard');
    }
  },
};
