const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  yahooTeamId: {
    type: String,
    required: true,
  },
  league: { // Reference to the league this team belongs to
    type: mongoose.Schema.Types.ObjectId,
    ref: 'League',
    required: true,
  },
  user: { // Reference to the user managing this team
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  teamLogoUrl: {
    type: String,
  },
  managerName: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure unique combination of league and yahooTeamId
TeamSchema.index({ league: 1, yahooTeamId: 1 }, { unique: true });

module.exports = mongoose.model('Team', TeamSchema);
