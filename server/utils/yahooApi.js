const axios = require('axios');
const User = require('../models/User'); // Adjust path as needed

const YAHOO_API_BASE_URL = 'https://fantasysports.yahooapis.com/fantasy/v2';

/**
 * Refreshes the Yahoo OAuth token for a user.
 * @param {object} user - The user object from the database.
 * @returns {Promise<string>} - The new access token.
 */
const refreshToken = async (user) => {
  console.log(`Refreshing token for user: ${user.yahooId}`);
  try {
    const credentials = Buffer.from(
      `${process.env.YAHOO_CLIENT_ID}:${process.env.YAHOO_CLIENT_SECRET}`
    ).toString('base64');

    const response = await axios.post(
      'https://api.login.yahoo.com/oauth2/get_token',
      new URLSearchParams({
        client_id: process.env.YAHOO_CLIENT_ID,
        client_secret: process.env.YAHOO_CLIENT_SECRET,
        redirect_uri: process.env.YAHOO_REDIRECT_URI, // Must match the one used in initial auth
        refresh_token: user.refreshToken,
        grant_type: 'refresh_token',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    // Update user in DB with new tokens and expiration
    user.accessToken = access_token;
    // Yahoo might send a new refresh token, update if it exists
    if (refresh_token) {
        user.refreshToken = refresh_token;
        console.log(`Received new refresh token for user: ${user.yahooId}`);
    }
    // Calculate new expiration time
    user.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    await user.save();
    console.log(`Token refreshed successfully for user: ${user.yahooId}`);
    return access_token;

  } catch (error) {
    console.error(
      'Error refreshing Yahoo token:',
      error.response ? error.response.data : error.message
    );
    // Handle specific errors, e.g., invalid refresh token requires re-authentication
    if (error.response && error.response.data && error.response.data.error === 'invalid_grant') {
        console.error(`Invalid refresh token for user ${user.yahooId}. User needs to re-authenticate.`);
        // Optionally, clear the invalid token from the user model or mark user as needing re-auth
        user.refreshToken = undefined; // Or some other indicator
        user.accessToken = undefined;
        await user.save();
    }
    throw new Error('Failed to refresh Yahoo token');
  }
};

/**
 * Makes an authenticated request to the Yahoo Fantasy API.
 * Handles token refresh automatically.
 * @param {string} userId - The MongoDB user ID.
 * @param {string} url - The API endpoint URL (relative to base URL).
 * @param {string} method - HTTP method (GET, POST, PUT, etc.). Default is GET.
 * @param {object} data - Data payload for POST/PUT requests.
 * @returns {Promise<object>} - The API response data.
 */
const makeYahooApiRequest = async (userId, url, method = 'GET', data = null) => {
  let user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  let accessToken = user.accessToken;

  // Check if token needs refreshing (e.g., expired or nearing expiry)
  // Add a buffer (e.g., 5 minutes) to expiry check
  const bufferSeconds = 300;
  if (!user.tokenExpiresAt || new Date() >= new Date(user.tokenExpiresAt.getTime() - bufferSeconds * 1000)) {
    try {
      accessToken = await refreshToken(user);
    } catch (refreshError) {
      // If refresh fails (e.g., invalid refresh token), re-throw or handle
      throw refreshError; // Propagate error up
    }
  }

  const fullUrl = `${YAHOO_API_BASE_URL}${url}?format=json`; // Always request JSON format

  try {
    const config = {
      method: method,
      url: fullUrl,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json' // Adjust if needed for specific endpoints (e.g., XML for PUT)
      },
    };
    if (data) {
        config.data = data;
    }

    // console.log(`Making Yahoo API request: ${method} ${fullUrl}`);
    const response = await axios(config);
    return response.data; // Return the JSON data

  } catch (error) {
    console.error(
      `Error making Yahoo API request to ${fullUrl}:`,
      error.response ? error.response.data : error.message
    );

    // Handle specific API errors (e.g., 401 Unauthorized might indicate token issue despite refresh attempt)
    if (error.response && error.response.status === 401) {
        console.warn(`Received 401 from Yahoo API for user ${userId} even after potential refresh. Re-authentication might be needed.`);
        // Consider attempting refresh again or marking user for re-auth
    }

    throw new Error(`Yahoo API request failed: ${error.message}`);
  }
};

module.exports = { makeYahooApiRequest, refreshToken };
