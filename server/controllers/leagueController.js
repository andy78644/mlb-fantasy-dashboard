const yahooApiService = require('../utils/yahooApiService'); // Import the new service

// Simple request cache to prevent duplicate processing
const requestCache = new Map();
const CACHE_TTL = 5000; // 5 seconds TTL for cache entries

// Get leagues associated with the logged-in user from Yahoo and DB
exports.getUserLeagues = async (req, res) => {
  // Generate a unique request ID based on user session and timestamp
  const userId = req.session?.user?.id || 'anonymous';
  const requestId = `${userId}_${Date.now()}`;
  
  // Check if there's an in-progress request for this user
  const cacheKey = `leagues_${userId}`;
  const cachedResponse = requestCache.get(cacheKey);
  
  if (cachedResponse) {
    console.log(`[${requestId}] Returning cached response for user ${userId}`);
    return res.json(cachedResponse.data);
  }
  
  console.log(`[${requestId}] Starting getUserLeagues request`);
  
  // Create a promise that will resolve with the league data
  const responsePromise = new Promise(async (resolve, reject) => {
    try {
      const accessToken = req.accessToken; // Get token from middleware

      if (!accessToken) {
        reject({ status: 401, message: 'Access token not available.' });
        return;
      }

      // 1. Fetch user's games from Yahoo API
      const gamesApiUrl = yahooApiService.userInfo(); // URL for user's games
      console.log(`[${requestId}] Fetching user games data from: ${gamesApiUrl}`);
      
      const refreshToken = req.session?.yahooTokens?.refreshToken;
      // Use makeAPIrequestWithTokenRefresh instead of makeAPIrequest for better token handling
      const gamesData = await yahooApiService.makeAPIrequestWithTokenRefresh(gamesApiUrl, accessToken, refreshToken);
      
      // Validate response structure before processing
      if (!gamesData || !gamesData.fantasy_content) {
        console.log(`[${requestId}] Invalid games data response structure`);
        reject({ status: 500, message: 'Invalid API response structure for games data' });
        return;
      }

      const fantasyContent = gamesData.fantasy_content;
      // Validate nested structure with optional chaining
      const userGames = fantasyContent?.users?.user?.games?.game;
      let fetchedLeagues = [];

      if (!userGames) {
        console.log(`[${requestId}] No games found for user`);
        resolve(fetchedLeagues); // Return empty array if no games found
        return;
      }

      const gamesArray = Array.isArray(userGames) ? userGames : [userGames];
      console.log(`[${requestId}] Found ${gamesArray.length} games`);

      // Filter for MLB games and collect their keys
      const mlbGameKeys = gamesArray
          .filter(game => game.code === 'mlb')
          .map(game => game.game_key);

      console.log(`[${requestId}] Found ${mlbGameKeys.length} MLB game keys`);

      if (mlbGameKeys.length === 0) {
        console.log(`[${requestId}] No MLB games found for user`);
        resolve(fetchedLeagues); // Return empty array if no MLB games
        return;
      }

      // 2. Fetch leagues for each MLB game separately to avoid complex nested structures
      for (const gameKey of mlbGameKeys) {
        try {
          console.log(`[${requestId}] Processing game key: ${gameKey}`);
          const leaguesApiUrl = `${yahooApiService.YAHOO_BASE_URL}/users;use_login=1/games;game_keys=${gameKey}/leagues`;
          console.log(`[${requestId}] Fetching leagues with URL: ${leaguesApiUrl}`);
          
          const leaguesData = await yahooApiService.makeAPIrequestWithTokenRefresh(leaguesApiUrl, accessToken, refreshToken);
          
          if (!leaguesData || !leaguesData.fantasy_content) {
            console.log(`[${requestId}] Invalid leagues data response for game ${gameKey}`);
            continue; // Skip to next game key if invalid response
          }

          // Extract leagues from response
          const leaguesFantasyContent = leaguesData.fantasy_content;
          const leaguesUserGames = leaguesFantasyContent?.users?.user?.games?.game;
          
          if (!leaguesUserGames) {
            console.log(`[${requestId}] No leagues data found for game ${gameKey}`);
            continue;
          }
          
          // Handle both array and single object cases
          const gameWithLeagues = Array.isArray(leaguesUserGames) 
            ? leaguesUserGames.find(g => g.game_key === gameKey) 
            : leaguesUserGames;
            
          if (!gameWithLeagues || !gameWithLeagues.leagues || !gameWithLeagues.leagues.league) {
            console.log(`[${requestId}] No leagues found for game ${gameKey}`);
            continue;
          }
          
          const leagues = gameWithLeagues.leagues.league;
          const leaguesArray = Array.isArray(leagues) ? leagues : [leagues];
          
          console.log(`[${requestId}] Found ${leaguesArray.length} leagues for game ${gameKey}`);
          
          // Process each league
          for (const leagueInfo of leaguesArray) {
            const leagueKey = leagueInfo.league_key;
            fetchedLeagues.push({
              _id: leagueKey,
              yahooLeagueId: leagueKey,
              name: leagueInfo.name,
              season: leagueInfo.season,
              url: leagueInfo.url,
              numTeams: parseInt(leagueInfo.num_teams) || 0,
              scoringType: leagueInfo.scoring_type,
              leagueType: leagueInfo.league_type,
              currentWeek: parseInt(leagueInfo.current_week) || 0,
              startWeek: parseInt(leagueInfo.start_week) || 0,
              endWeek: parseInt(leagueInfo.end_week) || 0,
              gameCode: gameWithLeagues.code,
              gameSeason: gameWithLeagues.season
            });
          }
        } catch (gameErr) {
          // Log error but continue processing other game keys
          console.error(`[${requestId}] Error processing game ${gameKey}:`, gameErr.message);
        }
      }

      console.log(`[${requestId}] Returning ${fetchedLeagues.length} leagues`);
      resolve(fetchedLeagues);

    } catch (err) {
      console.error(`[${requestId}] Error in getUserLeagues:`, err.message, err.stack);
      
      if (err.isTokenExpired || err.message.includes('401') || (err.response && err.response.status === 401)) {
        reject({ status: 401, message: 'Authentication error with Yahoo. Please login again.' });
        return;
      }
      
      reject({ status: 500, message: 'Server Error: ' + err.message });
    }
  });
  
  // Store the promise in cache
  requestCache.set(cacheKey, { 
    data: null,
    promise: responsePromise,
    timestamp: Date.now()
  });
  
  try {
    // Wait for the promise to resolve
    const data = await responsePromise;
    
    // Update cache with the result
    requestCache.set(cacheKey, { 
      data,
      promise: null,
      timestamp: Date.now()
    });
    
    // Auto-expire cache after TTL
    setTimeout(() => {
      const entry = requestCache.get(cacheKey);
      if (entry && entry.timestamp <= Date.now() - CACHE_TTL) {
        requestCache.delete(cacheKey);
      }
    }, CACHE_TTL);
    
    // Send response
    res.json(data);
  } catch (err) {
    // Remove failed request from cache
    requestCache.delete(cacheKey);
    
    // Send error response
    const status = err.status || 500;
    const message = err.message || 'Server Error';
    
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  }
};

// Placeholder for getLeaguePowerIndex
exports.getLeaguePowerIndex = async (req, res) => {
  // Add logging at the very start of the function
  console.log(`DEBUG: Entered getLeaguePowerIndex controller for league ${req.params.leagueId}`);
  try {
    const { leagueId } = req.params;
    const { week, year } = req.query; // Assuming week and year might be needed

    console.log(`DEBUG: Processing power index request for league ${leagueId}, week ${week}, year ${year}`);

    // TODO: Implement the actual logic to calculate the power index.
    // This might involve fetching scoreboard data, team stats, etc., from Yahoo
    // and performing calculations.

    // For now, return a placeholder response
    res.json({
      message: `Power index calculation for league ${leagueId}, week ${week} is not yet implemented.`,
      leagueId,
      week,
      year,
      powerIndexData: [] // Placeholder for actual data
    });

  } catch (err) {
    console.error('Error in getLeaguePowerIndex (placeholder):', err.message);
    if (!res.headersSent) {
      res.status(500).send('Server Error: ' + err.message);
    }
  }
};
