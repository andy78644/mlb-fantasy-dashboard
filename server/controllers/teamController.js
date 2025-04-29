const Team = require('../models/Team');
const League = require('../models/League');
const User = require('../models/User');
const WeeklyStats = require('../models/WeeklyStats');
const yahooApiService = require('../utils/yahooApiService'); // Import the new service

// Get all teams for a specific league from Yahoo and DB
exports.getLeagueTeams = async (req, res) => {
  try {
    const accessToken = req.accessToken; // Get token from middleware
    const { leagueId } = req.params; // This is our DB league ID

    if (!accessToken) {
        return res.status(401).json({ message: 'Access token not available.' });
    }

    // 1. Find the league in our DB to get the yahooLeagueId
    const league = await League.findById(leagueId);
    if (!league) {
      return res.status(404).json({ message: 'League not found in database' });
    }
    const yahooLeagueKey = league.yahooLeagueId;

    // 2. Fetch teams from Yahoo API using the league key and new service
    const apiUrl = `${yahooApiService.YAHOO_BASE_URL}/league/${yahooLeagueKey}/teams`; // Construct URL
    const yahooData = await yahooApiService.makeAPIrequest(apiUrl, accessToken);

    // 3. Process the response (adjusting for xml2json-light structure)
    const fantasyContent = yahooData.fantasy_content;
    // Accessing teams might be nested differently, check yahooData structure
    const teamsData = fantasyContent?.league?.teams; // Adjusted path
    let fetchedTeams = [];

    const processTeam = async (teamData) => {
        // Adjust parsing based on actual xml2json-light output
        const teamInfo = teamData.team; // Assuming team data is directly under the numeric key
        const yahooTeamKey = teamInfo.team_key;
        const yahooTeamId = teamInfo.team_id;
        const managerInfo = teamInfo.managers?.manager; // Use optional chaining
        const managerYahooId = managerInfo?.guid;
        const managerNickname = managerInfo?.nickname || 'N/A';
        const teamLogoUrl = teamInfo.team_logos?.team_logo?.url || ''; // Use optional chaining and default

        // Find user by Yahoo GUID if needed (depends on user management strategy)
        let teamUser = managerYahooId ? await User.findOne({ yahooId: managerYahooId }) : null;
        let teamUserId = teamUser ? teamUser._id : null;

        // 4. Find or Create Team in DB
        let team = await Team.findOne({ league: league._id, yahooTeamId: yahooTeamId });
        if (!team) {
            team = new Team({
                yahooTeamId: yahooTeamId,
                yahooTeamKey: yahooTeamKey, // Store the full team key
                league: league._id,
                user: teamUserId,
                name: teamInfo.name,
                teamLogoUrl: teamLogoUrl,
                managerName: managerNickname,
            });
        } else {
            // Update existing team info
            team.name = teamInfo.name;
            team.teamLogoUrl = teamLogoUrl;
            team.managerName = managerNickname;
            team.yahooTeamKey = yahooTeamKey; // Ensure key is updated
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
            yahooTeamKey: team.yahooTeamKey,
            name: team.name,
            teamLogoUrl: team.teamLogoUrl,
            managerName: team.managerName,
            user: team.user
        };
    };

    // Check if teamsData exists and has teams (adjust based on actual structure)
    if (teamsData && teamsData.team) { // Check if the 'team' array/object exists
        const teamsArray = Array.isArray(teamsData.team) ? teamsData.team : [teamsData.team];
        for (const teamEntry of teamsArray) {
            // Pass the actual team object to processTeam
            fetchedTeams.push(await processTeam({ team: teamEntry }));
        }
    }

    // 5. Return teams
    res.json(fetchedTeams);

  } catch (err) {
    console.error('Error in getLeagueTeams:', err.message, err.stack);
    if (err.isTokenExpired || err.message.includes('401') || (err.response && err.response.status === 401)) {
        return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
    }
    res.status(500).send('Server Error');
  }
};

// Get weekly stats for a specific team
exports.getTeamWeeklyStats = async (req, res) => {
  try {
    const accessToken = req.accessToken; // Get token from middleware
    const { leagueId, teamId } = req.params; // These are our DB IDs
    const week = req.query.week;

    if (!accessToken) {
        return res.status(401).json({ message: 'Access token not available.' });
    }
    if (!week) {
      return res.status(400).json({ message: 'Week query parameter is required' });
    }

    // 1. Find the team in our DB to get the full Yahoo Team Key
    const team = await Team.findById(teamId);
    if (!team || !team.yahooTeamKey) {
      // Also check if the team belongs to the expected league if leagueId is used for validation
      const league = await League.findById(leagueId);
      if (!league || !team || !team.league.equals(league._id)) {
          return res.status(404).json({ message: 'Team not found in database or does not belong to the specified league' });
      }
      // If team exists but key is missing, maybe try to fetch it? For now, error out.
      return res.status(404).json({ message: 'Team found, but Yahoo Team Key is missing.' });
    }

    const yahooTeamKey = team.yahooTeamKey;

    // 2. Fetch team stats from Yahoo API using the new service
    const apiUrl = yahooApiService.myWeeklyStats(yahooTeamKey, week); // Use URL builder
    const yahooData = await yahooApiService.makeAPIrequest(apiUrl, accessToken);

    // 3. Process the response (adjusting for xml2json-light structure)
    const fantasyContent = yahooData.fantasy_content;
    // Path to stats might differ, inspect yahooData
    const teamStatsData = fantasyContent?.team?.team_stats;
    const statsArray = teamStatsData?.stats?.stat; // Adjusted path

    const processedStats = {};
    if (Array.isArray(statsArray)) {
        statsArray.forEach(statInfo => {
            processedStats[statInfo.stat_id] = {
                value: statInfo.value,
            };
        });
    } else if (statsArray) { // Handle single stat object case
        processedStats[statsArray.stat_id] = {
            value: statsArray.value,
        };
    }

    // 4. Optionally: Find or Update WeeklyStats in DB (handled elsewhere)

    res.json({
        week: parseInt(week),
        teamId: team._id,
        yahooTeamKey: yahooTeamKey,
        stats: processedStats
    });

  } catch (err) {
    console.error('Error in getTeamWeeklyStats:', err.message, err.stack);
    if (err.isTokenExpired || err.message.includes('401') || (err.response && err.response.status === 401)) {
        return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
    }
    if (err.message.includes('Invalid week') || (err.response && err.response.status === 400)) {
        return res.status(400).json({ message: `Stats not available or invalid week: ${req.query.week}` });
    }
    res.status(500).send('Server Error');
  }
};
