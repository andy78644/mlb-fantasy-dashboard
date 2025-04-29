const Team = require('../models/Team');
const League = require('../models/League');
const User = require('../models/User');
const WeeklyStats = require('../models/WeeklyStats');
const { makeYahooApiRequest } = require('../utils/yahooApi');

// Get all teams for a specific league from Yahoo and DB
exports.getLeagueTeams = async (req, res) => {
  try {
    const userId = req.user.id;
    const { leagueId } = req.params; // This is our DB league ID

    // 1. Find the league in our DB to get the yahooLeagueId
    const league = await League.findById(leagueId);
    if (!league) {
      return res.status(404).json({ message: 'League not found in database' });
    }
    const yahooLeagueKey = league.yahooLeagueId;

    // 2. Fetch teams from Yahoo API using the league key
    // The endpoint gets league resource with teams sub-resource
    const apiUrl = `/league/${yahooLeagueKey}/teams`;
    const yahooData = await makeYahooApiRequest(userId, apiUrl);

    // 3. Process the response
    const fantasyContent = yahooData.fantasy_content;
    const teamsData = fantasyContent.league[1].teams;
    let fetchedTeams = [];

    const processTeam = async (teamData) => {
        const teamInfo = teamData.team[0];
        const yahooTeamKey = teamInfo[0].team_key;
        const yahooTeamId = teamInfo[1].team_id; // Extract numeric team ID
        const managerInfo = teamInfo[5].managers[0].manager; // Extract manager info
        const managerYahooId = managerInfo.guid; // Manager's Yahoo GUID

        // Find the user associated with this team manager in our DB
        // This assumes the manager is also a user of our app who has logged in
        // In some cases, the manager might not be a user of this dashboard
        let teamUser = await User.findOne({ yahooId: managerYahooId });
        let teamUserId = teamUser ? teamUser._id : null; // Store user's DB ID if found

        // 4. Find or Create Team in DB
        let team = await Team.findOne({ league: league._id, yahooTeamId: yahooTeamId });
        if (!team) {
            team = new Team({
                yahooTeamId: yahooTeamId,
                league: league._id,
                user: teamUserId, // Associate with user if found
                name: teamInfo[2].name,
                teamLogoUrl: teamInfo[4].team_logos[0].team_logo.url,
                managerName: managerInfo.nickname,
                // Add other relevant fields like team key if needed
            });
        } else {
            // Update existing team info if necessary
            team.name = teamInfo[2].name;
            team.teamLogoUrl = teamInfo[4].team_logos[0].team_logo.url;
            team.managerName = managerInfo.nickname;
            // Update user association if it wasn't set before or changed
            if (!team.user && teamUserId) {
                team.user = teamUserId;
            }
        }
        await team.save();

        // Ensure team is associated with the league in DB
        await League.findByIdAndUpdate(league._id, { $addToSet: { teams: team._id } });

        return {
            _id: team._id,
            yahooTeamId: team.yahooTeamId,
            name: team.name,
            teamLogoUrl: team.teamLogoUrl,
            managerName: team.managerName,
            user: team.user // Include user ref ID
            // Add any other fields needed by the frontend
        };
    };

    // Check if teamsData is an object (count > 0) or just contains count: 0
    if (teamsData && teamsData.count > 0 && typeof teamsData === 'object') {
        // Iterate through the numeric keys (0, 1, 2...) which contain team objects
        for (const key in teamsData) {
            if (!isNaN(key) && teamsData[key].team) { // Check if key is numeric and contains a team object
                fetchedTeams.push(await processTeam(teamsData[key]));
            }
        }
    }

    // 5. Return teams (from DB, now synced with Yahoo)
    res.json(fetchedTeams);

  } catch (err) {
    console.error('Error in getLeagueTeams:', err.message);
    if (err.message.includes('Failed to refresh Yahoo token') || (err.response && err.response.status === 401)) {
        return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
    }
    res.status(500).send('Server Error');
  }
};

// Get weekly stats for a specific team
exports.getTeamWeeklyStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { leagueId, teamId } = req.params; // These are our DB IDs
    const week = req.query.week;

    if (!week) {
      return res.status(400).json({ message: 'Week query parameter is required' });
    }

    // 1. Find the league and team in our DB to get Yahoo keys
    const league = await League.findById(leagueId);
    const team = await Team.findById(teamId);

    if (!league || !team) {
      return res.status(404).json({ message: 'League or Team not found in database' });
    }
    // Ensure the found team actually belongs to the found league
    if (!team.league.equals(league._id)) {
        return res.status(400).json({ message: 'Team does not belong to the specified league' });
    }

    const yahooLeagueKey = league.yahooLeagueId;
    // Construct the full yahoo team key (game_code.l.league_id.t.team_id)
    // We need the game code and league id from the league key
    const leagueKeyParts = yahooLeagueKey.split('.');
    const gameCode = leagueKeyParts[0];
    const yahooLeagueId = leagueKeyParts[2];
    const yahooTeamKey = `${gameCode}.l.${yahooLeagueId}.t.${team.yahooTeamId}`;

    // 2. Fetch team stats from Yahoo API for the specified week
    // The endpoint gets team resource with stats sub-resource for a specific week
    const apiUrl = `/team/${yahooTeamKey}/stats;type=week;week=${week}`;
    const yahooData = await makeYahooApiRequest(userId, apiUrl);

    // 3. Process the response
    const fantasyContent = yahooData.fantasy_content;
    const teamStatsData = fantasyContent.team[1].team_stats;
    const statsArray = teamStatsData.stats; // Array of stat objects

    const processedStats = {};
    statsArray.forEach(statObj => {
        const statInfo = statObj.stat;
        processedStats[statInfo.stat_id] = {
            value: statInfo.value,
            // You might want to fetch stat metadata (name, abbreviation) separately
            // if you don't store it, to make the stats more readable.
        };
    });

    // 4. Optionally: Find or Update WeeklyStats in DB (or handle this in sync/power index calc)
    // For now, just return the fetched stats

    res.json({
        week: parseInt(week),
        teamId: team._id,
        yahooTeamKey: yahooTeamKey,
        stats: processedStats
    });

  } catch (err) {
    console.error('Error in getTeamWeeklyStats:', err.message);
    if (err.message.includes('Failed to refresh Yahoo token') || (err.response && err.response.status === 401)) {
        return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
    }
    // Handle cases where stats might not be available for the week yet
    if (err.message.includes('Invalid week') || (err.response && err.response.status === 400)) {
        return res.status(400).json({ message: `Stats not available or invalid week: ${req.query.week}` });
    }
    res.status(500).send('Server Error');
  }
};
