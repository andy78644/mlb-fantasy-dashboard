const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { ensureAuth } = require('../middleware/authMiddleware'); // Import auth middleware

// @route   GET /api/reports/:leagueId/weekly
// @desc    Generate and download a weekly report for a league
// @access  Private
router.get('/:leagueId/weekly', ensureAuth, reportController.generateWeeklyReport); // Protect route

module.exports = router;
