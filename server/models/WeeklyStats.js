const mongoose = require('mongoose');

// Represents the calculated stats and power index for a team for a specific week
const WeeklyStatsSchema = new mongoose.Schema({
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
  },
  league: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'League',
    required: true,
  },
  week: {
    type: Number,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  stats: { // Store the raw cumulative stats for the week
    type: Map,
    of: mongoose.Schema.Types.Mixed, // Allows storing various stat types (numbers, strings)
  },
  powerIndex: {
    type: Number,
    required: true,
  },
  calculatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure unique combination of team, league, week, and year
WeeklyStatsSchema.index({ team: 1, league: 1, week: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyStats', WeeklyStatsSchema);
