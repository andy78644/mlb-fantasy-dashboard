const League = require('../models/League');
const User = require('../models/User');
const WeeklyStats = require('../models/WeeklyStats');
const { makeYahooApiRequest } = require('../utils/yahooApi');
const { calculateAndStorePowerIndex } = require('../utils/calculations'); // Import calculation utility

// Get leagues associated with the logged-in user from Yahoo and DB
exports.getUserLeagues = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming user ID is available from ensureAuth middleware

    // 1. Fetch leagues from Yahoo API
    // The endpoint gets games the user is registered in, filtering by MLB (game_code=mlb)
    // It includes league sub-resources
    const apiUrl = "/users;use_login=1/games;game_codes=mlb/leagues";
    const yahooData = await makeYahooApiRequest(userId, apiUrl);

    // 2. Process the response
    const fantasyContent = yahooData.fantasy_content;
    const userGames = fantasyContent.users[0].user[1].games;
    let fetchedLeagues = [];

    if (userGames && userGames[0].game) {
        const leaguesData = userGames[0].game[1].leagues;
        // The structure might be leaguesData[0].league, leaguesData[1].league etc.
        // Or if only one league: leaguesData[0].league
        // Need to handle potential variations in Yahoo's response structure

        const processLeague = async (leagueData) => {
            const leagueInfo = leagueData.league[0];
            const leagueKey = leagueInfo.league_key;

            // 3. Find or Create League in DB
            let league = await League.findOne({ yahooLeagueId: leagueKey });
            if (!league) {
                league = new League({
                    yahooLeagueId: leagueKey,
                    name: leagueInfo.name,
                    season: leagueInfo.season,
                    gameCode: 'mlb', // Assuming we filtered by mlb
                    // Add other relevant fields from leagueInfo if needed
                });
            }
            // Ensure user is associated with the league in DB
            if (!league.users.includes(userId)) {
                league.users.push(userId);
            }
            await league.save();

            // Also update the User model to reference this league
            await User.findByIdAndUpdate(userId, { $addToSet: { leagues: league._id } });

            return {
                _id: league._id,
                yahooLeagueId: league.yahooLeagueId,
                name: league.name,
                season: league.season,
                // Add any other fields needed by the frontend
            };
        };

        // Check if leaguesData is an array of league objects or a single one
        if (leaguesData && typeof leaguesData === 'object') {
            // Iterate through the numeric keys (0, 1, 2...) if it's an object representing an array
            for (const key in leaguesData) {
                if (!isNaN(key) && leaguesData[key].league) { // Check if key is numeric and contains a league object
                    fetchedLeagues.push(await processLeague(leaguesData[key]));
                }
            }
        }
    }

    // 4. Return leagues (from DB, now synced with Yahoo)
    res.json(fetchedLeagues);

  } catch (err) {
    console.error('Error in getUserLeagues:', err.message);
    if (err.message.includes('Failed to refresh Yahoo token') || (err.response && err.response.status === 401)) {
        return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
    }
    res.status(500).send('Server Error');
  }
};

// Placeholder: Trigger data sync for a league
// TODO: Implement full sync logic (fetch teams, stats, calculate PI for current week)
exports.syncLeagueData = async (req, res) => {
  try {
    const userId = req.user.id;
    const { leagueId } = req.params; // DB League ID

    // Find league to get season year
    const league = await League.findById(leagueId);
    if (!league) {
        return res.status(404).json({ message: 'League not found' });
    }

    // Determine current week (this needs a robust way to map date to fantasy week)
    // For now, let's assume a function getCurrentFantasyWeek() exists or it's passed
    const currentWeek = 1; // Placeholder - replace with actual logic
    const year = league.season;

    console.log(`Sync triggered for league: ${leagueId}, week: ${currentWeek}, year: ${year}`);

    // Optional: Fetch teams first if not already populated
    // await teamController.getLeagueTeams(req, res); // Careful with req/res passing

    // Calculate and store power index for the determined current week
    await calculateAndStorePowerIndex(userId, leagueId, currentWeek, year);

    // Update last synced timestamp
    league.lastSynced = new Date();
    await league.save();

    res.json({ message: `Sync and Power Index calculation initiated for league ${leagueId}, week ${currentWeek}` });
  } catch (err) {
    console.error('Error in syncLeagueData:', err.message);
    if (err.message.includes('Failed to refresh Yahoo token') || (err.response && err.response.status === 401)) {
        return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
    }
    res.status(500).send('Server Error');
  }
};

// Get calculated power index for a league for a specific week
exports.getLeaguePowerIndex = async (req, res) => {
  try {
    const userId = req.user.id;
    const { leagueId } = req.params; // DB League ID
    const week = parseInt(req.query.week);
    const year = parseInt(req.query.year);

    if (!week || !year) {
        return res.status(400).json({ message: 'Week and Year query parameters are required' });
    }

    // Option 1: Fetch pre-calculated data from DB
    const powerIndexes = await WeeklyStats.find({ league: leagueId, week: week, year: year })
                                        .sort({ powerIndex: -1 }) // Sort descending by PI
                                        .populate('team', 'name managerName teamLogoUrl'); // Populate relevant team info

    // Option 2: Calculate on the fly (if data isn't pre-calculated or needs refresh)
    // Uncomment if you prefer on-the-fly calculation instead of relying on sync
    // const powerIndexes = await calculateAndStorePowerIndex(userId, leagueId, week, year);

    if (!powerIndexes || powerIndexes.length === 0) {
        // If no data found, maybe trigger calculation or inform user
        // For now, return empty or message
        // Consider triggering calculateAndStorePowerIndex here if desired
        console.log(`No pre-calculated Power Index found for league ${leagueId}, week ${week}, year ${year}. Triggering calculation.`);
        const calculatedPowerIndexes = await calculateAndStorePowerIndex(userId, leagueId, week, year);
        return res.json(calculatedPowerIndexes);
        // return res.status(404).json({ message: `Power Index data not found for week ${week}, year ${year}. Try syncing the league.` });
    }

    res.json(powerIndexes);

  } catch (err) {
    console.error('Error in getLeaguePowerIndex:', err.message);
    if (err.message.includes('Failed to refresh Yahoo token') || (err.response && err.response.status === 401)) {
        return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
    }
    res.status(500).send('Server Error');
  }
};
