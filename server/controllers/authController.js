// This controller might not be strictly necessary anymore for user data
// if tokens are managed solely via session and API calls.
// Keep getUser for potential future use or if frontend needs basic confirmation.

exports.getUser = async (req, res) => {
  // The ensureAuth middleware already validates the token.
  // With MongoDB disabled, we're returning simulated user data
  
  if (req.accessToken) { // Check if middleware added the token
    // Return simulated user data since MongoDB is disabled
    res.json({ 
      isAuthenticated: true,
      displayName: 'Yahoo Fantasy User',
      yahooId: 'YahooUser123',
      email: 'fantasy_user@example.com',
      // Add any other user properties your frontend might expect
    });
  } else {
    // This case should technically be handled by ensureAuth, but as a fallback:
    res.status(401).json({ message: 'Not authenticated' });
  }
};

// Note: All MongoDB-related functionality has been commented out as per requirements

