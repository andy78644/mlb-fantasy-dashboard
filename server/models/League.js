const mongoose = require('mongoose');

const LeagueSchema = new mongoose.Schema({
  yahooLeagueId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  season: {
    type: Number,
    required: true,
  },
  gameCode: { // e.g., 'mlb'
    type: String,
    required: true,
  },
  users: [{ // Users participating in this league
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  teams: [{ // Teams within this league
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
  }],
  lastSynced: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('League', LeagueSchema);
