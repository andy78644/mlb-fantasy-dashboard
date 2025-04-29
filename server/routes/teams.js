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
    const { teamKey } = req.params;
    const { week } = req.query;

    if (!accessToken) {
      return res.status(401).json({ message: 'Access token not available.' });
    }

    const apiUrl = yahooApiService.roster(teamKey, week);
    const data = await yahooApiService.makeAPIrequest(apiUrl, accessToken);
    res.json(data);
  } catch (err) {
    console.error('Error fetching team roster:', err.message);
    if (err.isTokenExpired || err.message.includes('401')) {
      return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
    }
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
});

// @route   GET /api/teams/:teamKey/stats
// @desc    Get weekly stats for a specific team
// @access  Private
router.get('/:teamKey/stats', ensureAuth, async (req, res) => {
  try {
    const accessToken = req.accessToken;
    const { teamKey } = req.params;
    const { week } = req.query;

    if (!accessToken) {
      return res.status(401).json({ message: 'Access token not available.' });
    }

    if (!week) {
      return res.status(400).json({ message: 'Week parameter is required' });
    }

    const apiUrl = yahooApiService.myWeeklyStats(teamKey, week);
    const data = await yahooApiService.makeAPIrequest(apiUrl, accessToken);
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
