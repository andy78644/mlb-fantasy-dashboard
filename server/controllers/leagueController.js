const yahooApiService = require('../utils/yahooApiService'); // Import the new service

// Get leagues associated with the logged-in user from Yahoo and DB
exports.getUserLeagues = async (req, res) => {
  // Add unique request ID for debugging
  const requestId = Date.now().toString();
  console.log(`[${requestId}] Starting getUserLeagues request`);
  
  try {
    const accessToken = req.accessToken; // Get token from middleware

    if (!accessToken) {
        return res.status(401).json({ message: 'Access token not available.' });
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
      return res.status(500).json({ message: 'Invalid API response structure for games data' });
    }

    const fantasyContent = gamesData.fantasy_content;
    // Validate nested structure with optional chaining
    const userGames = fantasyContent?.users?.user?.games?.game;
    let fetchedLeagues = [];

    if (!userGames) {
      console.log(`[${requestId}] No games found for user`);
      return res.json(fetchedLeagues); // Return empty array if no games found
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
      return res.json(fetchedLeagues); // Return empty array if no MLB games
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
    res.json(fetchedLeagues);

  } catch (err) {
    console.error(`[${requestId}] Error in getUserLeagues:`, err.message, err.stack);
    
    if (err.isTokenExpired || err.message.includes('401') || (err.response && err.response.status === 401)) {
      if (!res.headersSent) {
        return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
      }
    }
    
    if (!res.headersSent) {
      res.status(500).json({ message: 'Server Error: ' + err.message });
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
