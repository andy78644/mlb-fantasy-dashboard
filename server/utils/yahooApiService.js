const axios = require('axios');
const qs = require('qs');
const xml2jsonLight = require('xml2json-light'); // Keep for small responses
const fs = require('fs');
const path = require('path');
const os = require('os');
const XmlStream = require('xml-stream'); // Add this for streaming XML parsing

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
        redirect_uri: 'oob',
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
    // Validate parameters to prevent infinite recursion
    if (!url || typeof url !== 'string') {
      console.error('Invalid URL provided for API request');
      throw new Error('Valid URL is required for API request');
    }
    
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
          'Content-Type': 'application/xml',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Safari/537.36',
          'Accept': 'application/json'
        },
      });

      // Check content type and parse accordingly
      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('application/json')) {
        return response.data;
      } else if (contentType && contentType.includes('application/xml')) {
        console.log('API request successful (XML response), parsing to JSON'); // Debug log
        
        // Check response size to prevent stack overflow
        const xmlSize = response.data.length;
        console.log(`XML response size: ${xmlSize} bytes`);
        
        // For matchup data - use the streaming matchup parser
        if (url.includes('/matchups')) {
          try {
            console.warn(`XML response too large (${xmlSize} bytes) for direct parsing. Using streaming parser.`);
            return await processMatchupXml(response.data);
            return 
          } catch (matchupError) {
            console.error('Error using large size XML parser:', matchupError);
            throw new Error(`Failed to process large size XML: ${matchupError.message}`);
          }
        } else{
          try {
            const jsonData = xml2jsonLight.xml2json(response.data, { object: true });
            return jsonData;
          } catch (parseError) {
            console.error('Error parsing XML to JSON:', parseError);
            throw new Error(`Failed to parse XML response: ${parseError.message}`);
          }
        }
      } else {
          // Handle unexpected content type or assume JSON if unsure
          console.warn(`Unexpected content type: ${contentType}. Attempting to parse as JSON.`);
          return response.data;
      }
    } catch (err) {
      // Safely access error properties to avoid undefined errors causing stack overflow
      const status = err.response?.status;
      const errorData = err.response?.data || {};
      const errorDescription = errorData.error?.description || err.message;
      
      console.error(`Error in makeAPIrequest() to ${url}: Status=${status} ${errorDescription}`);
      
      // Check specifically for token expired error to allow refresh logic upstream
      if (errorData.error?.description?.includes('token_expired')) {
          console.log('Token expired error detected.'); // Debug log
          // Throw a specific error type or flag for the caller to handle refresh
          const tokenExpiredError = new Error('Token expired');
          tokenExpiredError.isTokenExpired = true;
          throw tokenExpiredError;
      }
      
      // Throw a generic error for other issues
      throw new Error(`API request failed: ${errorDescription}`);
    }
  },

  // Function to handle matchup data without full XML parsing
  // Utility function for making API requests with automatic token refresh
  async makeAPIrequestWithTokenRefresh(url, accessToken, refreshToken, retryCount = 0) {
    // Validate input parameters
    if (!url || typeof url !== 'string') {
      console.error('Invalid URL provided for API request with token refresh');
      throw new Error('Valid URL is required for API request with token refresh');
    }
    
    if (!accessToken) {
      console.error('Access token is missing for API request with token refresh');
      throw new Error('Access token required for API request with token refresh');
    }
    
    // Maximum retry attempts to prevent infinite recursion
    const MAX_RETRIES = 2;
    if (retryCount > MAX_RETRIES) {
      console.error(`Exceeded maximum retry attempts (${MAX_RETRIES}) for API request`);
      throw new Error(`Failed to complete API request after ${MAX_RETRIES} refresh attempts`);
    }
    
    try {
      // Attempt the API request with current access token
      return await this.makeAPIrequest(url, accessToken);
    } catch (error) {
      // If token expired and we haven't exceeded retry attempts
      if (error.isTokenExpired && refreshToken) {
        console.log(`Token expired, attempting refresh (attempt ${retryCount + 1})`);
        try {
          // Get new tokens
          const tokenData = await this.refreshAuthorizationToken(refreshToken);
          
          // Check if we got valid token data
          if (!tokenData || !tokenData.access_token) {
            throw new Error('Token refresh did not return valid credentials');
          }
          
          // Save new refresh token or reuse current if not returned
          const newRefreshToken = tokenData.refresh_token || refreshToken;
          
          // Retry with new access token (increment retry count)
          return await this.makeAPIrequestWithTokenRefresh(
            url, 
            tokenData.access_token,
            newRefreshToken,
            retryCount + 1
          );
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError.message);
          throw new Error(`Failed to refresh token: ${refreshError.message}`);
        }
      } 
      
      // Re-throw original error if it's not a token issue or we've exceeded retries
      throw error;
    }
  },

  // --- Helper functions to construct API URLs (adapt from original code) ---
  // Base URL
  YAHOO_BASE_URL: 'https://fantasysports.yahooapis.com/fantasy/v2',

  // Example URL construction (adapt others as needed)
  gameKey() {
      return `${this.YAHOO_BASE_URL}/game/mlb`; // Assuming MLB, adjust if needed
  },

  metadata(leagueKey) {
      return `${this.YAHOO_BASE_URL}/league/${leagueKey}/metadata`;
  },

  myTeam(teamKey) {
      return `${this.YAHOO_BASE_URL}/team/${teamKey}/roster`;
      // Or use league context: `${this.YAHOO_BASE_URL}/league/${leagueKey}/teams;team_keys=${teamKey}/roster`;
  },

  freeAgents(leagueKey, start = 0, count = 25) { 
    return `${this.YAHOO_BASE_URL}/league/${leagueKey}/players;status=FA;start=${start};count=${count}`;
  },

  myWeeklyStats(teamKey, week) {
    return `${this.YAHOO_BASE_URL}/team/${teamKey}/stats;type=week;week=${week}`;
  },

  scoreboard(leagueKey, week) {
    return `${this.YAHOO_BASE_URL}/league/${leagueKey}/scoreboard;week=${week}`;
  },

  matchup(teamKey, week) {
    return `${this.YAHOO_BASE_URL}/team/${teamKey}/matchups;weeks=${week}`;
  },

  playerStats(playerKeys) { // playerKeys should be a comma-separated string
    return `${this.YAHOO_BASE_URL}/players;player_keys=${playerKeys}/stats`;
  },

  transactions(leagueKey) {
    return `${this.YAHOO_BASE_URL}/league/${leagueKey}/transactions`;
  },

  userInfo() {
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



/**
 * Specialized streaming parser for matchup data
 * @param {string} xmlData - The XML content to parse
 * @returns {Promise<object>} - Parsed matchup JSON object
 */
async function processMatchupXml(xmlData) {
  // Create temp file
  const tempFile = path.join(os.tmpdir(), `yahoo_matchup_${Date.now()}.xml`);
  try {
    // Write XML to temp file
    await fs.promises.writeFile(tempFile, xmlData, 'utf8');
    console.log(`Matchup XML saved to temporary file: ${tempFile}`);
    
    // Create a readable stream from the file
    const stream = fs.createReadStream(tempFile);
    
    // Create an XML parser that reads from the stream
    const parser = new XmlStream(stream);
    
    // Result object that will hold our parsed data
    const result = {
      fantasy_content: {
        team: {
          team_key: '',
          team_id: '',
          name: '',
          matchups: {
            matchup: []
          }
        }
      }
    };
    
    // Current matchup to build
    let currentMatchup = null;
    let currentTeam = null;
    let collectingTeamStats = false; // Flag to know when we are inside team_stats
    
    // Create a promise that resolves when parsing is complete
    return new Promise((resolve, reject) => {
      // Set up error handling
      parser.on('error', (err) => {
        console.error('Error parsing matchup XML stream:', err);
        reject(new Error(`Matchup XML stream parsing error: ${err.message}`));
      });
      
      // --- Requesting Team Info --- 
      // These seem okay, they target the top-level <team> element
      parser.on('endElement: fantasy_content > team > team_key', (item) => {
        result.fantasy_content.team.team_key = item.$text;
      });
      parser.on('endElement: fantasy_content > team > team_id', (item) => {
        result.fantasy_content.team.team_id = item.$text;
      });
      parser.on('endElement: fantasy_content > team > name', (item) => {
        result.fantasy_content.team.name = item.$text;
      });

      // --- Matchup Processing --- 
      parser.on('startElement: matchup', () => {
        currentMatchup = {
          week: '',
          status: '',
          is_playoffs: '0',
          is_consolation: '0',
          is_tied: '0',
          winner_team_key: '',
          teams: [] // Initialize teams array for the matchup
        };
      });

      parser.on('endElement: matchup', () => {
        if (currentMatchup) {
          result.fantasy_content.team.matchups.matchup.push(currentMatchup);
          currentMatchup = null;
        }
      });

      // Matchup attributes (relative to matchup element)
      parser.on('endElement: matchup > week', (item) => {
        if (currentMatchup) currentMatchup.week = item.$text;
      });
      parser.on('endElement: matchup > status', (item) => {
        if (currentMatchup) currentMatchup.status = item.$text;
      });
      parser.on('endElement: matchup > is_playoffs', (item) => {
        if (currentMatchup) currentMatchup.is_playoffs = item.$text;
      });
      parser.on('endElement: matchup > is_consolation', (item) => {
        if (currentMatchup) currentMatchup.is_consolation = item.$text;
      });
      parser.on('endElement: matchup > is_tied', (item) => {
        if (currentMatchup) currentMatchup.is_tied = item.$text;
      });
      parser.on('endElement: matchup > winner_team_key', (item) => {
        if (currentMatchup) currentMatchup.winner_team_key = item.$text;
      });

      // --- Team Processing within Matchup --- 
      // Start of a team within the <teams> collection
      parser.on('startElement: matchup > teams > team', () => {
        currentTeam = {
          team_key: '',
          team_id: '',
          name: '',
          team_logo: '',
          manager_name: '',
          points: '0',
          projected_points: '0', // Assuming this might exist, add if needed
          stats: {}
        };
        collectingTeamStats = false; // Reset flag for the new team
      });

      // End of a team within the <teams> collection
      parser.on('endElement: matchup > teams > team', () => {
        if (currentMatchup && currentTeam) {
          // Ensure we actually collected some data before pushing
          if (currentTeam.team_key) { 
             currentMatchup.teams.push(currentTeam);
          } else {
             console.warn("Skipping team push, no team_key found for:", currentTeam);
          }
        }
        currentTeam = null; // Reset for the next team
        collectingTeamStats = false;
      });

      // Team attributes (relative to the current team element)
      // Use paths relative to `matchup > teams > team`
      parser.on('endElement: matchup > teams > team > team_key', (item) => {
        if (currentTeam) currentTeam.team_key = item.$text;
      });
      parser.on('endElement: matchup > teams > team > team_id', (item) => {
        if (currentTeam) currentTeam.team_id = item.$text;
      });
      parser.on('endElement: matchup > teams > team > name', (item) => {
        // Avoid overwriting if the top-level team name was already parsed here
        if (currentTeam && !currentTeam.name) currentTeam.name = item.$text;
      });
      parser.on('endElement: matchup > teams > team > team_logos > team_logo > url', (item) => {
        if (currentTeam) currentTeam.team_logo = item.$text;
      });
      parser.on('endElement: matchup > teams > team > managers > manager > nickname', (item) => {
        if (currentTeam) currentTeam.manager_name = item.$text;
      });
      parser.on('endElement: matchup > teams > team > team_points > total', (item) => {
        if (currentTeam) currentTeam.points = item.$text;
      });
      // Add handler for projected points if needed, e.g.:
      parser.on('endElement: matchup > teams > team > team_projected_points > total', (item) => {
        if (currentTeam) currentTeam.projected_points = item.$text;
      });

      // --- Stat Processing within Team --- 
      // Use a flag to know when we are inside the stats section of the correct team
      parser.on('startElement: matchup > teams > team > team_stats > stats', () => {
          if (currentTeam) {
              collectingTeamStats = true;
              currentTeam.stats = {}; // Initialize/reset stats for the current team
          }
      });

      parser.on('endElement: matchup > teams > team > team_stats > stats', () => {
          if (currentTeam) {
              collectingTeamStats = false;
          }
      });

      // Collect individual stat elements when inside the correct context
      parser.collect('stat'); // Collect all stat elements
      parser.on('endElement: stat', (stat) => {
          // Process the collected stat only if we are inside the team_stats of the current team
          if (collectingTeamStats && currentTeam && stat.stat_id && stat.value !== undefined) {
              currentTeam.stats[stat.stat_id] = {
                  stat_id: stat.stat_id,
                  value: stat.value
              };
          }
      });

      // --- End of Parsing --- 
      parser.on('end', () => {
        console.log('Finished parsing matchup XML file');
        
        // --- Filtering Logic (runs after parsing is complete) ---
        if (result.fantasy_content && result.fantasy_content.team && result.fantasy_content.team.matchups && result.fantasy_content.team.matchups.matchup) {
            const requestingTeamKey = result.fantasy_content.team.team_key;
            if (requestingTeamKey) {
                result.fantasy_content.team.matchups.matchup.forEach(matchup => {
                    if (matchup.teams && Array.isArray(matchup.teams)) {
                        // Log before filtering
                        console.log(`Matchup Week ${matchup.week}: Teams before filtering:`, matchup.teams.map(t => t.team_key)); 
                    } else {
                        console.warn(`Matchup for week ${matchup.week} has no teams array or it's not an array.`);
                    }
                });
            } else {
                console.warn("Could not determine requesting team key for matchup filtering.");
            }
        } else {
            console.warn("Result structure missing expected matchup data for filtering.");
        }
        // Clean up temp file
        fs.unlink(tempFile, (err) => {
          if (err) console.warn(`Warning: Could not delete temp file ${tempFile}:`, err);
          else console.log(`Temp file ${tempFile} deleted successfully`);
        });
        resolve(result);
      });

    }); // End of Promise
  } catch (err) {
    // Clean up temp file if something went wrong
    try {
      await fs.promises.unlink(tempFile);
    } catch (cleanupErr) {
      console.warn(`Warning: Could not delete temp file ${tempFile}:`, cleanupErr);
    }
    throw new Error(`Failed to process matchup XML: ${err.message}`);
  }
}

module.exports = yahooApiService;
