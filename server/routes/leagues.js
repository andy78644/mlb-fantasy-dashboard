const express = require('express');
const router = express.Router();
const leagueController = require('../controllers/leagueController');
const { ensureAuth } = require('../middleware/authMiddleware'); // Import auth middleware
const yahooApiService = require('../utils/yahooApiService'); // Import yahooApiService directly

// @route   GET /api/leagues/test
// @desc    Test route to verify the leagues endpoint is working
// @access  Public
router.get('/test', (req, res) => {
  res.json({ message: 'Leagues endpoint is working' });
});

// @route   GET /api/leagues/public
// @desc    Get leagues without authentication (for testing purposes)
// @access  Public
router.get('/public', async (req, res) => {
  try {
    // Return some sample data since we can't fetch from Yahoo without auth
    const sampleLeagues = [
      {
        _id: 'sample1',
        yahooLeagueId: 'sample_league_1',
        name: 'Sample MLB League 2023',
        season: '2023',
        url: 'https://baseball.fantasysports.yahoo.com/b1/12345',
        numTeams: 12,
        scoringType: 'head',
        leagueType: 'private',
        currentWeek: 8,
        startWeek: 1,
        endWeek: 24
      },
      {
        _id: 'sample2',
        yahooLeagueId: 'sample_league_2',
        name: 'Fantasy Baseball Pros',
        season: '2023',
        url: 'https://baseball.fantasysports.yahoo.com/b1/67890',
        numTeams: 10,
        scoringType: 'roto',
        leagueType: 'private',
        currentWeek: 8,
        startWeek: 1,
        endWeek: 24
      }
    ];
    
    res.json(sampleLeagues);
  } catch (err) {
    console.error('Error in public leagues route:', err.message);
    res.status(500).send('Server Error: ' + err.message);
  }
});

// @route   GET /api/leagues
// @desc    Get all leagues for the authenticated user
// @access  Private
router.get('/', ensureAuth, leagueController.getUserLeagues); // Protect route

// @route   GET /api/leagues/:leagueId/metadata
// @desc    Get metadata for a specific league
// @access  Private
router.get('/:leagueId/metadata', ensureAuth, async (req, res) => {
  try {
    const accessToken = req.accessToken;
    const { leagueId } = req.params;

    if (!accessToken) {
      return res.status(401).json({ message: 'Access token not available.' });
    }

    const apiUrl = yahooApiService.metadata(leagueId);
    const data = await yahooApiService.makeAPIrequest(apiUrl, accessToken);
    res.json(data);
  } catch (err) {
    console.error('Error fetching league metadata:', err.message);
    if (err.isTokenExpired || err.message.includes('401')) {
      return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
    }
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
});

// @route   GET /api/leagues/:leagueId/scoreboard
// @desc    Get scoreboard for a specific league and week
// @access  Private
router.get('/:leagueId/scoreboard', ensureAuth, async (req, res) => {
  try {
    const accessToken = req.accessToken;
    const { leagueId } = req.params;
    const { week } = req.query;

    if (!accessToken) {
      return res.status(401).json({ message: 'Access token not available.' });
    }

    if (!week) {
      return res.status(400).json({ message: 'Week parameter is required' });
    }

    const apiUrl = yahooApiService.scoreboard(leagueId, week);
    const data = await yahooApiService.makeAPIrequest(apiUrl, accessToken);
    res.json(data);
  } catch (err) {
    console.error('Error fetching scoreboard:', err.message);
    if (err.isTokenExpired || err.message.includes('401')) {
      return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
    }
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
});

// @route   GET /api/leagues/:leagueId/players/free-agents
// @desc    Get free agents for a specific league
// @access  Private
router.get('/:leagueId/players/free-agents', ensureAuth, async (req, res) => {
  try {
    const accessToken = req.accessToken;
    const { leagueId } = req.params;
    const start = req.query.start || 0;
    const count = req.query.count || 25;

    if (!accessToken) {
      return res.status(401).json({ message: 'Access token not available.' });
    }

    const apiUrl = yahooApiService.freeAgents(leagueId, start, count);
    const data = await yahooApiService.makeAPIrequest(apiUrl, accessToken);
    res.json(data);
  } catch (err) {
    console.error('Error fetching free agents:', err.message);
    if (err.isTokenExpired || err.message.includes('401')) {
      return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
    }
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
});

// @route   GET /api/leagues/:leagueId/transactions
// @desc    Get transactions for a specific league
// @access  Private
router.get('/:leagueId/transactions', ensureAuth, async (req, res) => {
  try {
    const accessToken = req.accessToken;
    const { leagueId } = req.params;

    if (!accessToken) {
      return res.status(401).json({ message: 'Access token not available.' });
    }

    const apiUrl = yahooApiService.transactions(leagueId);
    const data = await yahooApiService.makeAPIrequest(apiUrl, accessToken);
    res.json(data);
  } catch (err) {
    console.error('Error fetching transactions:', err.message);
    if (err.isTokenExpired || err.message.includes('401')) {
      return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
    }
    res.status(500).json({ message: 'Server Error: ' + err.message });
  }
});

// Keep the existing routes
// @route   GET /api/leagues/:leagueId/sync
// @desc    Trigger manual sync for a specific league
// @access  Private
// router.get('/:leagueId/sync', ensureAuth, leagueController.syncLeagueData); // Commented out - syncLeagueData not defined in controller

// @route   GET /api/leagues/:leagueId/powerindex
// @desc    Get weekly power index for a specific league
// @access  Private
// router.get('/:leagueId/powerindex', ensureAuth, leagueController.getLeaguePowerIndex); // Commented out - getLeaguePowerIndex not defined in controller

module.exports = router;
