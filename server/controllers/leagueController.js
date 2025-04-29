const yahooApiService = require('../utils/yahooApiService'); // Import the new service

// Get leagues associated with the logged-in user from Yahoo and DB
exports.getUserLeagues = async (req, res) => {
  try {
    const accessToken = req.accessToken; // Get token from middleware

    if (!accessToken) {
        return res.status(401).json({ message: 'Access token not available.' });
    }

    // 1. Fetch leagues from Yahoo API using the new service
    const apiUrl = yahooApiService.userInfo(); // Use the URL builder from the service
    const yahooData = await yahooApiService.makeAPIrequest(apiUrl, accessToken);
    console.log('DEBUG: Yahoo API response received');
    
    // 2. Process the response (assuming xml2json-light structure)
    // Adjust parsing based on actual JSON structure from xml2json-light
    const fantasyContent = yahooData.fantasy_content;
    const userGames = fantasyContent?.users?.user?.games?.game;
    let fetchedLeagues = [];

    if (userGames) {
        // Yahoo API might return a single game object or an array
        const gamesArray = Array.isArray(userGames) ? userGames : [userGames];

        for (const game of gamesArray) {
            if (game.code === 'mlb' && game.leagues) { // Filter for MLB leagues
                const leaguesData = game.leagues.league;
                const leaguesArray = Array.isArray(leaguesData) ? leaguesData : [leaguesData];

                for (const leagueData of leaguesArray) {
                    const leagueInfo = leagueData; // Direct access assuming structure
                    const leagueKey = leagueInfo.league_key;

                    // Instead of storing in MongoDB, just add to our response array
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
                        endWeek: leagueInfo.end_week
                    });
                }
            }
        }
    }

    // 3. Return leagues
    res.json(fetchedLeagues);

  } catch (err) {
    console.error('Error in getUserLeagues:', err.message);
    // Handle potential token errors passed up from the service or middleware
    if (err.isTokenExpired || err.message.includes('401') || (err.response && err.response.status === 401)) {
        return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
    }
    res.status(500).send('Server Error: ' + err.message);
  }
};

// The other controller methods would need to be modified similarly,
// but for now we'll focus on just enabling the getUserLeagues functionality
