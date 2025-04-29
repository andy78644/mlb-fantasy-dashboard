const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  yahooId: { // Store the user's unique Yahoo ID
    type: String,
    required: true,
    unique: true,
  },
  displayName: {
    type: String,
  },
  accessToken: { // Store the OAuth access token
    type: String,
    required: true,
  },
  refreshToken: { // Store the OAuth refresh token
    type: String,
    required: true,
  },
  tokenExpiresAt: { // Store token expiration time
    type: Date,
  },
  leagues: [{ // Reference to leagues the user is in
    type: mongoose.Schema.Types.ObjectId,
    ref: 'League',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', UserSchema);
