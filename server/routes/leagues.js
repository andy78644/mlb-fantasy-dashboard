const express = require('express');
const router = express.Router();
const leagueController = require('../controllers/leagueController');
const { ensureAuth } = require('../middleware/authMiddleware'); // Import auth middleware

// @route   GET /api/leagues
// @desc    Get all leagues for the authenticated user
// @access  Private
router.get('/', ensureAuth, leagueController.getUserLeagues); // Protect route

// @route   GET /api/leagues/:leagueId/sync
// @desc    Trigger manual sync for a specific league
// @access  Private
router.get('/:leagueId/sync', ensureAuth, leagueController.syncLeagueData); // Protect route

// @route   GET /api/leagues/:leagueId/powerindex
// @desc    Get weekly power index for a specific league
// @access  Private
router.get('/:leagueId/powerindex', ensureAuth, leagueController.getLeaguePowerIndex); // Protect route

module.exports = router;
