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
        console.log('API request successful (JSON response)'); // Debug log
        return response.data; // Already JSON
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
          } catch (matchupError) {
            console.error('Error using matchup XML parser:', matchupError);
            throw new Error(`Failed to process matchup XML: ${matchupError.message}`);
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
  freeAgents(leagueKey, start = 0, count = 25) { // Default count to 25 as per Yahoo limits
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

/**
 * Simple custom parser for matchup data to avoid full XML parsing
 * This extracts just the essential information we need
 */
function parseMatchupData(xmlData) {
  // Create a simplified response object
  const matchupData = {
    fantasy_content: {
      team: {
        matchups: {
          matchup: []
        }
      }
    }
  };
  
  try {
    // Extract the week number
    const weekMatch = xmlData.match(/<week>(\d+)<\/week>/);
    const week = weekMatch ? weekMatch[1] : null;
    
    // Extract team data
    const teams = [];
    const teamRegex = /<team>([\s\S]*?)<\/team>/g;
    let teamMatch;
    
    while ((teamMatch = teamRegex.exec(xmlData)) !== null) {
      const teamContent = teamMatch[1];
      
      // Extract team key
      const teamKeyMatch = teamContent.match(/<team_key>(.*?)<\/team_key>/);
      const teamKey = teamKeyMatch ? teamKeyMatch[1] : null;
      
      // Extract team ID
      const teamIdMatch = teamContent.match(/<team_id>(\d+)<\/team_id>/);
      const teamId = teamIdMatch ? teamIdMatch[1] : null;
      
      // Extract team name
      const nameMatch = teamContent.match(/<name>(.*?)<\/name>/);
      const name = nameMatch ? nameMatch[1] : null;
      
      // Extract manager name if available
      const managerMatch = teamContent.match(/<nickname>(.*?)<\/nickname>/);
      const managerName = managerMatch ? managerMatch[1] : 'Unknown';
      
      // Extract team logo if available
      const logoMatch = teamContent.match(/<url>(https:\/\/.*?\.jpg)<\/url>/);
      const teamLogo = logoMatch ? logoMatch[1] : null;
      
      // Extract points
      const pointsMatch = teamContent.match(/<total>([0-9.-]+)<\/total>/);
      const points = pointsMatch ? pointsMatch[1] : '0';
      
      // Extract stats - simplified version
      const stats = {};
      const statRegex = /<stat>\s*<stat_id>(\d+)<\/stat_id>\s*<value>([^<]*)<\/value>\s*<\/stat>/g;
      let statMatch;
      
      while ((statMatch = statRegex.exec(teamContent)) !== null) {
        const statId = statMatch[1];
        const value = statMatch[2];
        stats[statId] = { value };
      }
      
      teams.push({
        team_key: teamKey,
        team_id: teamId,
        name,
        team_logo: teamLogo,
        manager_name: managerName,
        points,
        stats
      });
    }
    
    // Create a matchup object with the data we extracted
    const matchup = {
      week,
      status: 'complete', // Assuming complete, adjust if needed
      is_playoffs: '0',   // Default values, could be extracted if needed
      is_consolation: '0',
      is_tied: '0',
      winner_team_key: null,
      teams
    };
    
    matchupData.fantasy_content.team.matchups.matchup.push(matchup);
    
    return matchupData;
  } catch (error) {
    console.error('Error in custom matchup parser:', error);
    throw new Error('Failed to parse matchup data with custom parser');
  }
}

/**
 * Process large XML data by saving to temp file and parsing with a streaming approach
 * @param {string} xmlData - The XML content to parse
 * @param {string} rootElement - The root element to extract (e.g., 'fantasy_content')
 * @returns {Promise<object>} - Parsed JSON object
 */
async function processLargeXml(xmlData, rootElement = 'fantasy_content') {
  // Create temp file
  const tempFile = path.join(os.tmpdir(), `yahoo_fantasy_${Date.now()}.xml`);
  
  try {
    // Write XML to temp file
    await fs.promises.writeFile(tempFile, xmlData, 'utf8');
    console.log(`Large XML saved to temporary file: ${tempFile}`);
    
    // Create a readable stream from the file
    const stream = fs.createReadStream(tempFile);
    
    // Create an XML parser that reads from the stream
    const parser = new XmlStream(stream);
    
    // Result object that will hold our parsed data
    const result = {};
    
    // Create a promise that resolves when parsing is complete
    return new Promise((resolve, reject) => {
      // Collect all elements under the root
      result[rootElement] = {};
      
      // Set up error handling
      parser.on('error', (err) => {
        console.error('Error parsing XML stream:', err);
        reject(new Error(`XML stream parsing error: ${err.message}`));
      });
      
      // When we reach the end of the file
      parser.on('end', () => {
        console.log('Finished parsing large XML file');
        // Clean up temp file
        fs.unlink(tempFile, (err) => {
          if (err) console.warn(`Warning: Could not delete temp file ${tempFile}:`, err);
          else console.log(`Temp file ${tempFile} deleted successfully`);
        });
        resolve(result);
      });
      
      // Handle collecting specific elements we're interested in
      // You'll need to modify these based on the structure of your XML
      
      // Example: Collect league data
      parser.collect('league');
      parser.on(`endElement: ${rootElement}`, (item) => {
        Object.assign(result[rootElement], item);
      });
      
      // Example: Collect team data
      parser.collect('team');
      parser.on('endElement: team', (team) => {
        if (!result[rootElement].teams) {
          result[rootElement].teams = { team: [] };
        }
        
        // Handle single team vs array of teams
        if (Array.isArray(result[rootElement].teams.team)) {
          result[rootElement].teams.team.push(team);
        } else {
          result[rootElement].teams.team = [team];
        }
      });
      
      // Example: Collect player data
      parser.collect('player');
      parser.on('endElement: player', (player) => {
        // Initialize the path if it doesn't exist
        if (!result[rootElement].league) result[rootElement].league = {};
        if (!result[rootElement].league.players) result[rootElement].league.players = { player: [] };
        
        // Add the player data
        result[rootElement].league.players.player.push(player);
      });
      
      // Similar handlers for other elements you need to collect
    });
  } catch (err) {
    // Clean up temp file if something went wrong
    try {
      await fs.promises.unlink(tempFile);
    } catch (cleanupErr) {
      console.warn(`Warning: Could not delete temp file ${tempFile}:`, cleanupErr);
    }
    throw new Error(`Failed to process large XML: ${err.message}`);
  }
}

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
    
    // Create a promise that resolves when parsing is complete
    return new Promise((resolve, reject) => {
      // Set up error handling
      parser.on('error', (err) => {
        console.error('Error parsing matchup XML stream:', err);
        reject(new Error(`Matchup XML stream parsing error: ${err.message}`));
      });
      
      // When we reach the end of the file
      parser.on('end', () => {
        console.log('Finished parsing matchup XML file');
        // Clean up temp file
        fs.unlink(tempFile, (err) => {
          if (err) console.warn(`Warning: Could not delete temp file ${tempFile}:`, err);
          else console.log(`Temp file ${tempFile} deleted successfully`);
        });
        resolve(result);
      });
      
      // Extract team details (the team requesting the matchup)
      parser.on('endElement: team > team_key', (text) => {
        if (!result.fantasy_content.team.team_key) {
          result.fantasy_content.team.team_key = text['$text'];
        }
      });
      
      parser.on('endElement: team > team_id', (text) => {
        if (!result.fantasy_content.team.team_id) {
          result.fantasy_content.team.team_id = text['$text'];
        }
      });
      
      parser.on('endElement: team > name', (text) => {
        if (!result.fantasy_content.team.name) {
          result.fantasy_content.team.name = text['$text'];
        }
      });
      
      // Start of a matchup
      parser.on('startElement: matchup', () => {
        currentMatchup = {
          week: '',
          status: '',
          is_playoffs: '0',
          is_consolation: '0',
          is_tied: '0',
          winner_team_key: '',
          teams: []
        };
      });
      
      // End of a matchup
      parser.on('endElement: matchup', () => {
        if (currentMatchup) {
          result.fantasy_content.team.matchups.matchup.push(currentMatchup);
          currentMatchup = null;
        }
      });
      
      // Matchup attributes
      parser.on('endElement: matchup > week', (text) => {
        if (currentMatchup) {
          currentMatchup.week = text['$text'];
        }
      });
      
      parser.on('endElement: matchup > status', (text) => {
        if (currentMatchup) {
          currentMatchup.status = text['$text'];
        }
      });
      
      parser.on('endElement: matchup > is_playoffs', (text) => {
        if (currentMatchup) {
          currentMatchup.is_playoffs = text['$text'];
        }
      });
      
      parser.on('endElement: matchup > is_consolation', (text) => {
        if (currentMatchup) {
          currentMatchup.is_consolation = text['$text'];
        }
      });
      
      parser.on('endElement: matchup > is_tied', (text) => {
        if (currentMatchup) {
          currentMatchup.is_tied = text['$text'];
        }
      });
      
      parser.on('endElement: matchup > winner_team_key', (text) => {
        if (currentMatchup) {
          currentMatchup.winner_team_key = text['$text'];
        }
      });
      
      // Team in matchup
      parser.on('startElement: teams > team', () => {
        currentTeam = {
          team_key: '',
          team_id: '',
          name: '',
          team_logo: '',
          manager_name: '',
          points: '0',
          projected_points: '0',
          stats: {}
        };
      });
      
      parser.on('endElement: teams > team', () => {
        if (currentMatchup && currentTeam) {
          currentMatchup.teams.push(currentTeam);
          currentTeam = null;
        }
      });
      
      // Team attributes
      parser.on('endElement: teams > team > team_key', (text) => {
        if (currentTeam) {
          currentTeam.team_key = text['$text'];
        }
      });
      
      parser.on('endElement: teams > team > team_id', (text) => {
        if (currentTeam) {
          currentTeam.team_id = text['$text'];
        }
      });
      
      parser.on('endElement: teams > team > name', (text) => {
        if (currentTeam) {
          currentTeam.name = text['$text'];
        }
      });
      
      // Team logo (more complex path)
      parser.on('endElement: teams > team > team_logos > team_logo > url', (text) => {
        if (currentTeam) {
          currentTeam.team_logo = text['$text'];
        }
      });
      
      // Manager name (complex path)
      parser.on('endElement: teams > team > managers > manager > nickname', (text) => {
        if (currentTeam) {
          currentTeam.manager_name = text['$text'];
        }
      });
      
      // Points
      parser.on('endElement: teams > team > team_points > total', (text) => {
        if (currentTeam) {
          currentTeam.points = text['$text'];
        }
      });
      
      parser.on('endElement: teams > team > team_projected_points > total', (text) => {
        if (currentTeam) {
          currentTeam.projected_points = text['$text'];
        }
      });
      
      // Stats
      parser.collect('stat');
      parser.on('endElement: teams > team > team_stats > stats > stat', (stat) => {
        if (currentTeam && stat.stat_id && stat.value) {
          currentTeam.stats[stat.stat_id] = {
            stat_id: stat.stat_id,
            value: stat.value
          };
        }
      });
    });
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
