const axios = require('axios');
const qs = require('qs');
const xml2json = require('xml2json-light'); // Import the function directly

const AUTH_ENDPOINT = 'https://api.login.yahoo.com/oauth2/get_token';
// Ensure these are set in your .env file
const CONSUMER_KEY = process.env.YAHOO_CLIENT_ID;
const CONSUMER_SECRET = process.env.YAHOO_CLIENT_SECRET;
const AUTH_HEADER = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');

const yahooApiService = {
  // Exchange authorization code for initial tokens
  getInitialAuthorization(authCode) {
    console.log('Attempting initial authorization with code:', authCode); // Debug log
    return axios({
      url: AUTH_ENDPOINT,
      method: 'post',
      headers: {
        Authorization: `Basic ${AUTH_HEADER}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Safari/537.36',
      },
      data: qs.stringify({
        client_id: CONSUMER_KEY,
        client_secret: CONSUMER_SECRET,
        redirect_uri: 'oob', // Or your configured callback URL if not using 'oob'
        code: authCode,
        grant_type: 'authorization_code',
      }),
    })
    .then(response => {
        console.log('Initial authorization successful:', response.data); // Debug log
        return response.data; // Return the token data
    })
    .catch((err) => {
      console.error(`Error in getInitialAuthorization(): Status=${err.response?.status}`, err.response?.data || err.message);
      // Rethrow or handle specific errors
      throw new Error(`Failed to get initial authorization: ${err.response?.data?.error_description || err.message}`);
    });
  },

  // Refresh the authorization token
  refreshAuthorizationToken(refreshToken) {
    console.log('Attempting to refresh token:', refreshToken); // Debug log
    return axios({
      url: AUTH_ENDPOINT,
      method: 'post',
      headers: {
        Authorization: `Basic ${AUTH_HEADER}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Safari/537.36',
      },
      data: qs.stringify({
        client_id: CONSUMER_KEY, // Client ID might be needed for refresh too
        client_secret: CONSUMER_SECRET, // Client Secret might be needed
        redirect_uri: 'oob', // Or your configured callback URL
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })
    .then(response => {
        console.log('Token refresh successful:', response.data); // Debug log
        return response.data; // Return the new token data
    })
    .catch((err) => {
      console.error(`Error in refreshAuthorizationToken(): Status=${err.response?.status}`, err.response?.data || err.message);
      // Rethrow or handle specific errors like invalid refresh token
      throw new Error(`Failed to refresh token: ${err.response?.data?.error_description || err.message}`);
    });
  },

  // Make a request to the Yahoo Fantasy API
  async makeAPIrequest(url, accessToken) {
    console.log(`Making API request to: ${url} with token: ${accessToken ? 'provided' : 'missing'}`); // Debug log
    if (!accessToken) {
        console.error('Access token is missing for API request.');
        throw new Error('Access token required for API request.');
    }
    try {
      const response = await axios({
        url,
        method: 'get',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/xml', // Yahoo API often expects/returns XML
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Safari/537.36',
          'Accept': 'application/json' // Request JSON if possible, otherwise parse XML
        },
      });

      // Check content type and parse accordingly
      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('application/json')) {
        console.log('API request successful (JSON response)'); // Debug log
        return response.data; // Already JSON
      } else if (contentType && contentType.includes('application/xml')) {
        console.log('API request successful (XML response), parsing to JSON'); // Debug log
        // Correct usage: call the imported function directly
        console.log('DEBUG: Parsing XML response to JSON: ', response.data); // Debug log
        const jsonData = xml2json(response.data, { object: true });
        return jsonData;
      } else {
          // Handle unexpected content type or assume JSON if unsure
          console.warn(`Unexpected content type: ${contentType}. Attempting to parse as JSON.`);
          return response.data;
      }
    } catch (err) {
      console.error(`Error in makeAPIrequest() to ${url}: Status=${err.response?.status}`, err.response?.data || err.message);
      // Check specifically for token expired error to allow refresh logic upstream
      if (err.response?.data?.error?.description?.includes('token_expired')) {
          console.log('Token expired error detected.'); // Debug log
          // Throw a specific error type or flag for the caller to handle refresh
          const tokenExpiredError = new Error('Token expired');
          tokenExpiredError.isTokenExpired = true;
          throw tokenExpiredError;
      }
      // Throw a generic error for other issues
      throw new Error(`API request failed: ${err.response?.data?.error?.description || err.message}`);
    }
  },

  // --- Helper functions to construct API URLs (adapt from original code) ---
  // Base URL
  YAHOO_BASE_URL: 'https://fantasysports.yahooapis.com/fantasy/v2',

  // Example URL construction (adapt others as needed)
  gameKey(leaguePrefix) {
      return `${this.YAHOO_BASE_URL}/game/mlb`; // Assuming MLB, adjust if needed
  },

  metadata(leagueKey) {
      return `${this.YAHOO_BASE_URL}/league/${leagueKey}/metadata`;
  },

  myTeam(leagueKey, teamKey) {
      return `${this.YAHOO_BASE_URL}/team/${teamKey}/roster`;
      // Or use league context: `${this.YAHOO_BASE_URL}/league/${leagueKey}/teams;team_keys=${teamKey}/roster`;
  },

  // Add other URL builder functions based on the original code...
  // e.g., freeAgents, myWeeklyStats, scoreboard, transactions, etc.
  // Make sure they accept necessary parameters like leagueKey, teamKey, week, etc.

  freeAgents(leagueKey, start = 0, count = 25) { // Default count to 25 as per Yahoo limits
    return `${this.YAHOO_BASE_URL}/league/${leagueKey}/players;status=FA;start=${start};count=${count}`;
  },

  myWeeklyStats(teamKey, week) {
    return `${this.YAHOO_BASE_URL}/team/${teamKey}/stats;type=week;week=${week}`;
  },

  scoreboard(leagueKey, week) {
    return `${this.YAHOO_BASE_URL}/league/${leagueKey}/scoreboard;week=${week}`;
  },

  playerStats(playerKeys) { // playerKeys should be a comma-separated string
    return `${this.YAHOO_BASE_URL}/players;player_keys=${playerKeys}/stats`;
  },

  transactions(leagueKey) {
    return `${this.YAHOO_BASE_URL}/league/${leagueKey}/transactions`;
  },

  userInfo() { // Doesn't seem to need specific keys based on original code
    return `${this.YAHOO_BASE_URL}/users;use_login=1/games`;
  },

  statsIDs(gameKey = 'mlb') { // Assuming MLB game key
    return `${this.YAHOO_BASE_URL}/game/${gameKey}/stat_categories`;
  },

  roster(teamKey, week) { // Roster for a specific week or current if week omitted
    const weekParam = week ? `;week=${week}` : '';
    return `${this.YAHOO_BASE_URL}/team/${teamKey}/roster${weekParam}`;
  },

};

module.exports = yahooApiService;
