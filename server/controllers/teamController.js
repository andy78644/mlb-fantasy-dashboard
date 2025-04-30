const yahooApiService = require('../utils/yahooApiService'); // Import the new service

// Get the logged-in user's team for a specific league
exports.getMyTeamInLeague = async (req, res) => {
    try {
        const accessToken = req.accessToken;
        const { leagueId } = req.params;
        const userId = req.user?.id;

        if (!accessToken) {
            return res.status(401).json({ message: 'Access token not available.' });
        }

        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        // Directly use the leagueId as the Yahoo league key
        const yahooLeagueKey = leagueId;

        // Get all teams from Yahoo API
        const apiUrl = `${yahooApiService.YAHOO_BASE_URL}/league/${yahooLeagueKey}/teams`;
        const yahooData = await yahooApiService.makeAPIrequest(apiUrl, accessToken);

        // Process the response and find the user's team
        const teamsData = yahooData.fantasy_content?.league?.teams?.team;
        if (!teamsData) {
            return res.status(404).json({ message: 'No teams found in this league' });
        }

        // Get user's Yahoo GUID to match against team managers
        const userGuid = req.user?.yahooId;
        const teamsArray = Array.isArray(teamsData) ? teamsData : [teamsData];
        
        // Find the team managed by the current user
        let userTeam = null;
        for (const team of teamsArray) {
            const managerInfo = team.managers?.manager;
            const managerYahooId = managerInfo?.guid;
            
            if (managerYahooId === userGuid) {
                userTeam = {
                    yahooTeamId: team.team_id,
                    yahooTeamKey: team.team_key,
                    name: team.name,
                    teamLogoUrl: team.team_logos?.team_logo?.url || '',
                    managerName: managerInfo?.nickname || 'N/A'
                };
                break;
            }
        }

        if (!userTeam) {
            return res.status(404).json({ message: 'No team found for the current user in this league' });
        }

        res.json({
            yahooTeamId: userTeam.yahooTeamId,
            yahooTeamKey: userTeam.yahooTeamKey,
            name: userTeam.name,
            teamLogoUrl: userTeam.teamLogoUrl,
            managerName: userTeam.managerName
        });

    } catch (err) {
        console.error('Error in getMyTeamInLeague:', err.message, err.stack);
        if (err.isTokenExpired || err.message.includes('401') || (err.response && err.response.status === 401)) {
            return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
        }
        res.status(500).send('Server Error');
    }
};


// Get team roster
exports.getTeamRoster = async (req, res) => {
    try {
        const accessToken = req.accessToken;
        const { yahooTeamKey } = req.params;
        const week = req.query.week; // Optional week query param

        if (!accessToken) {
            return res.status(401).json({ message: 'Access token not available.' });
        }
        if (!yahooTeamKey) {
            return res.status(400).json({ message: 'Yahoo Team Key parameter is required.' });
        }

        // Fetch roster from Yahoo API
        const apiUrl = yahooApiService.roster(yahooTeamKey, week); // Pass week if provided
        const yahooData = await yahooApiService.makeAPIrequest(apiUrl, accessToken);

        // Process the response (structure depends on xml2json-light)
        const fantasyContent = yahooData.fantasy_content;
        const rosterData = fantasyContent?.team?.roster?.players?.player; // Adjust path as needed

        let processedRoster = [];
        if (rosterData) {
            const playersArray = Array.isArray(rosterData) ? rosterData : [rosterData];
            processedRoster = playersArray.map(player => ({
                player_key: player.player_key,
                player_id: player.player_id,
                name: player.name?.full,
                editorial_team_abbr: player.editorial_team_abbr,
                display_position: player.display_position,
                position_type: player.position_type, // e.g., 'B', 'P'
                selected_position: player.selected_position?.position, // e.g., '1B', 'SP', 'BN'
                status: player.status, // e.g., '', 'DL'
                headshot: player.headshot?.url,
                // Add more fields as needed
            }));
        }

        res.json(processedRoster);

    } catch (err) {
        console.error('Error in getTeamRoster:', err.message, err.stack);
        if (err.isTokenExpired || err.message.includes('401') || (err.response && err.response.status === 401)) {
            return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
        }
        res.status(500).send('Server Error');
    }
};

// Get all teams for a specific league from Yahoo API
exports.getLeagueTeams = async (req, res) => {
  try {
    const accessToken = req.accessToken;
    const { leagueId } = req.params; // Use this directly as Yahoo league key

    if (!accessToken) {
        return res.status(401).json({ message: 'Access token not available.' });
    }

    // Directly use the leagueId as Yahoo league key
    const yahooLeagueKey = leagueId;

    // Fetch teams directly from Yahoo API
    const apiUrl = `${yahooApiService.YAHOO_BASE_URL}/league/${yahooLeagueKey}/teams`;
    const yahooData = await yahooApiService.makeAPIrequest(apiUrl, accessToken);

    // Process the response
    const fantasyContent = yahooData.fantasy_content;
    const teamsData = fantasyContent?.league?.teams;
    let fetchedTeams = [];

    // Check if teamsData exists and has teams
    if (teamsData && teamsData.team) {
        const teamsArray = Array.isArray(teamsData.team) ? teamsData.team : [teamsData.team];
        
        // Process each team without DB operations
        for (const teamEntry of teamsArray) {
            const teamInfo = teamEntry;
            const yahooTeamKey = teamInfo.team_key;
            const yahooTeamId = teamInfo.team_id;
            const managerInfo = teamInfo.managers?.manager;
            const managerNickname = managerInfo?.nickname || 'N/A';
            const teamLogoUrl = teamInfo.team_logos?.team_logo?.url || '';

            fetchedTeams.push({
                yahooTeamId: yahooTeamId,
                yahooTeamKey: yahooTeamKey,
                name: teamInfo.name,
                teamLogoUrl: teamLogoUrl,
                managerName: managerNickname,
                // No DB ID or user ID since we're not using the database
            });
        }
    }

    // Return teams directly
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
    const accessToken = req.accessToken;
    const { teamId } = req.params; // This should be the Yahoo team key
    const week = req.query.week;

    if (!accessToken) {
        return res.status(401).json({ message: 'Access token not available.' });
    }
    if (!week) {
      return res.status(400).json({ message: 'Week query parameter is required' });
    }

    // Use the teamId parameter directly as the Yahoo team key
    const yahooTeamKey = teamId;

    // Fetch team stats from Yahoo API
    const apiUrl = yahooApiService.myWeeklyStats(yahooTeamKey, week);
    const yahooData = await yahooApiService.makeAPIrequest(apiUrl, accessToken);

    // Process the response
    const fantasyContent = yahooData.fantasy_content;
    const teamStatsData = fantasyContent?.team?.team_stats;
    const statsArray = teamStatsData?.stats?.stat;

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

    res.json({
        week: parseInt(week),
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
