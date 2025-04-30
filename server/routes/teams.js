const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { ensureAuth } = require('../middleware/authMiddleware'); // Import auth middleware
const yahooApiService = require('../utils/yahooApiService'); // Import yahooApiService directly

// @route   GET /api/teams/:teamKey/roster
// @desc    Get roster for a specific team
// @access  Private
router.get('/:teamKey/roster', ensureAuth, async (req, res) => {
  try {
    const accessToken = req.accessToken;
    const refreshToken = req.session?.yahooTokens?.refreshToken;
    const { teamKey } = req.params;
    const { week } = req.query;

    if (!accessToken) {
      return res.status(401).json({ message: 'Access token not available.' });
    }

    const apiUrl = yahooApiService.roster(teamKey, week);
    const data = await yahooApiService.makeAPIrequestWithTokenRefresh(apiUrl, accessToken, refreshToken);
    res.json(data);
  } catch (err) {
    console.error('Error fetching team roster:', err.message);
    if (err.isTokenExpired || err.message.includes('401')) {
      return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
    }
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
});

// @route   GET /api/teams/:teamKey/matchups
// @desc    Get matchups for a specific team
// @access  Private
router.get('/:teamKey/matchups', ensureAuth, async (req, res) => {
  try {
    const accessToken = req.accessToken;
    const refreshToken = req.session?.yahooTokens?.refreshToken;
    const { teamKey } = req.params;
    const { week } = req.query;

    if (!accessToken) {
      return res.status(401).json({ message: 'Access token not available.' });
    }

    if (!week) {
      return res.status(400).json({ message: 'Week parameter is required' });
    }

    const apiUrl = yahooApiService.matchup(teamKey, week);
    // Use the improved function with automatic token refresh
    const data = await yahooApiService.makeAPIrequestWithTokenRefresh(apiUrl, accessToken, refreshToken);
    
    // Process the data to make it easier to work with on the frontend
    // Extract the matchup data from the Yahoo API response
    const fantasyContent = data.fantasy_content;
    const matchupData = fantasyContent?.team?.matchups?.matchup;
    
    let processedMatchup = {};
    
    if (matchupData) {
      // Handle multiple matchups or single matchup
      const matchupArray = Array.isArray(matchupData) ? matchupData : [matchupData];
      // For simplicity, we'll just use the first matchup (should be only one per week)
      const matchup = matchupArray[0];
      
      // Extract useful data
      processedMatchup = {
        week: matchup.week,
        status: matchup.status,
        is_playoffs: matchup.is_playoffs === '1',
        is_consolation: matchup.is_consolation === '1',
        is_tied: matchup.is_tied === '1',
        winner_team_key: matchup.winner_team_key,
        teams: []
      };
      
      // Extract team data
      if (matchup.teams && matchup.teams.team) {
        const teamsArray = Array.isArray(matchup.teams.team) ? matchup.teams.team : [matchup.teams.team];
        
        processedMatchup.teams = teamsArray.map(team => ({
          team_key: team.team_key,
          team_id: team.team_id,
          name: team.name,
          team_logo: team.team_logos?.team_logo?.url,
          manager_name: team.managers?.manager?.nickname || 'Unknown',
          points: team.team_points?.total || '0',
          projected_points: team.team_projected_points?.total || '0',
          stats: processTeamStats(team.team_stats?.stats?.stat)
        }));
      }
    }
    
    res.json(processedMatchup);
  } catch (err) {
    console.error('Error fetching team matchup:', err.message);
    if (err.isTokenExpired || err.message.includes('401')) {
      return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
    }
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
});

// Helper function to process team stats
function processTeamStats(statsArray) {
  if (!statsArray) return {};
  
  const stats = {};
  const stats_array = Array.isArray(statsArray) ? statsArray : [statsArray];
  
  stats_array.forEach(stat => {
    stats[stat.stat_id] = {
      stat_id: stat.stat_id,
      value: stat.value,
      // You could add stat name/display if you have that data
    };
  });
  
  return stats;
}

// @route   GET /api/teams/:teamKey/stats
// @desc    Get weekly stats for a specific team
// @access  Private
router.get('/:teamKey/stats', ensureAuth, async (req, res) => {
  try {
    const accessToken = req.accessToken;
    const refreshToken = req.session?.yahooTokens?.refreshToken;
    const { teamKey } = req.params;
    const { week } = req.query;

    if (!accessToken) {
      return res.status(401).json({ message: 'Access token not available.' });
    }

    if (!week) {
      return res.status(400).json({ message: 'Week parameter is required' });
    }

    const apiUrl = yahooApiService.myWeeklyStats(teamKey, week);
    const data = await yahooApiService.makeAPIrequestWithTokenRefresh(apiUrl, accessToken, refreshToken);
    res.json(data);
  } catch (err) {
    console.error('Error fetching team stats:', err.message);
    if (err.isTokenExpired || err.message.includes('401')) {
      return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
    }
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
});

// Keep the original routes for backward compatibility but modify them to use yahooApiService
// @route   GET /api/teams/:leagueId
// @desc    Get all teams within a specific league
// @access  Private
router.get('/:leagueId', ensureAuth, teamController.getLeagueTeams);

// @route   GET /api/teams/:leagueId/:teamId/stats
// @desc    Get weekly stats for a specific team in a league
// @access  Private
router.get('/:leagueId/:teamId/stats', ensureAuth, teamController.getTeamWeeklyStats);

module.exports = router;
