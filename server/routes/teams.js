const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { ensureAuth } = require('../middleware/authMiddleware'); // Import auth middleware

// @route   GET /api/teams/:leagueId
// @desc    Get all teams within a specific league
// @access  Private
router.get('/:leagueId', ensureAuth, teamController.getLeagueTeams); // Protect route

// @route   GET /api/teams/:leagueId/:teamId/stats
// @desc    Get weekly stats for a specific team in a league
// @access  Private
router.get('/:leagueId/:teamId/stats', ensureAuth, teamController.getTeamWeeklyStats); // Protect route

module.exports = router;
