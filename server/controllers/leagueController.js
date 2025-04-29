const yahooApiService = require('../utils/yahooApiService'); // Import the new service

// Get leagues associated with the logged-in user from Yahoo and DB
exports.getUserLeagues = async (req, res) => {
  try {
    const accessToken = req.accessToken; // Get token from middleware

    if (!accessToken) {
        return res.status(401).json({ message: 'Access token not available.' });
    }

    // 1. Fetch user's games from Yahoo API
    const gamesApiUrl = yahooApiService.userInfo(); // URL for user's games
    const gamesData = await yahooApiService.makeAPIrequest(gamesApiUrl, accessToken);
    console.log('DEBUG: Fetched user games data:', JSON.stringify(gamesData, null, 2));

    const fantasyContent = gamesData.fantasy_content;
    const userGames = fantasyContent?.users?.user?.games?.game;
    let fetchedLeagues = [];

    if (userGames) {
        const gamesArray = Array.isArray(userGames) ? userGames : [userGames];
        console.log('DEBUG: Processing games array:', gamesArray);

        // Filter for MLB games and collect their keys
        const mlbGameKeys = gamesArray
            .filter(game => game.code === 'mlb')
            .map(game => game.game_key);

        console.log('DEBUG: Found MLB game keys:', mlbGameKeys);

        if (mlbGameKeys.length > 0) {
            // 2. Fetch leagues for the identified MLB games
            // Construct the URL to fetch leagues for these specific game keys
            // Example URL: /users;use_login=1/games;game_keys=mlb/leagues
            // Or more specific: /users;use_login=1/games;game_keys=431/leagues (replace 431 with actual key)
            // We'll fetch leagues for all MLB games found in one go if the API supports it,
            // otherwise, we might need separate calls per game key. Let's try a combined call first.
            const gameKeysString = mlbGameKeys.join(',');
            const leaguesApiUrl = `${yahooApiService.YAHOO_BASE_URL}/users;use_login=1/games;game_keys=${gameKeysString}/leagues`;
            console.log('DEBUG: Fetching leagues with URL:', leaguesApiUrl);

            const leaguesData = await yahooApiService.makeAPIrequest(leaguesApiUrl, accessToken);
            console.log('DEBUG: Fetched leagues data:', JSON.stringify(leaguesData, null, 2));

            // 3. Process the leagues response
            // The structure might be nested under fantasy_content -> users -> user -> games -> game -> leagues -> league
            const leaguesFantasyContent = leaguesData.fantasy_content;
            const leaguesUserGames = leaguesFantasyContent?.users?.user?.games?.game;

            if (leaguesUserGames) {
                const leaguesGamesArray = Array.isArray(leaguesUserGames) ? leaguesUserGames : [leaguesUserGames];

                for (const gameWithLeagues of leaguesGamesArray) {
                    const leagues = gameWithLeagues?.leagues?.league;
                    if (leagues) {
                        const leaguesArray = Array.isArray(leagues) ? leagues : [leagues];
                        console.log('DEBUG: Processing leagues for game:', gameWithLeagues.game_key, leaguesArray);
                        for (const leagueInfo of leaguesArray) {
                            const leagueKey = leagueInfo.league_key;
                            console.log('DEBUG: League info:', leagueInfo);
                            fetchedLeagues.push({
                                _id: leagueKey, // Use Yahoo's leagueKey as ID
                                yahooLeagueId: leagueKey,
                                name: leagueInfo.name,
                                season: leagueInfo.season,
                                url: leagueInfo.url,
                                numTeams: leagueInfo.num_teams,
                                scoringType: leagueInfo.scoring_type,
                                leagueType: leagueInfo.league_type,
                                currentWeek: leagueInfo.current_week,
                                startWeek: leagueInfo.start_week,
                                endWeek: leagueInfo.end_week,
                                gameCode: gameWithLeagues.code, // Add game code for context
                                gameSeason: gameWithLeagues.season // Add game season for context
                            });
                        }
                    } else {
                         console.log('DEBUG: No leagues found in game:', gameWithLeagues.game_key);
                    }
                }
            } else {
                 console.log('DEBUG: No games found in leagues response.');
            }
        } else {
            console.log('DEBUG: No MLB games found for the user.');
        }
    } else {
        console.log('DEBUG: No games found for the user in initial response.');
    }

    console.log('DEBUG: Final fetched leagues:', fetchedLeagues);
    // 4. Return leagues
    res.json(fetchedLeagues);

  } catch (err) {
    console.error('Error in getUserLeagues:', err.message, err.stack); // Log stack trace
    // Handle potential token errors passed up from the service or middleware
    if (err.isTokenExpired || err.message.includes('401') || (err.response && err.response.status === 401)) {
        // Check if response already sent before sending another
        if (!res.headersSent) {
            return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
        } else {
            console.error('Attempted to send 401 response after headers were already sent.');
        }
    }
    // Check if response already sent before sending another
    if (!res.headersSent) {
        res.status(500).send('Server Error: ' + err.message);
    } else {
         console.error('Attempted to send 500 response after headers were already sent.');
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
