const YahooStrategy = require('passport-yahoo-oauth2').Strategy;
const User = require('../models/User'); // Adjust path as needed

module.exports = function (passport) {
  passport.use(
    new YahooStrategy(
      {
        consumerKey: process.env.YAHOO_CLIENT_ID, // Reverted: Use consumerKey
        consumerSecret: process.env.YAHOO_CLIENT_SECRET, // Reverted: Use consumerSecret
        callbackURL: process.env.YAHOO_REDIRECT_URI,
      },
      async (accessToken, refreshToken, profile, done) => {
        console.log('Yahoo Profile:', profile); // Log profile for debugging
        const newUser = {
          yahooId: profile.id,
          displayName: profile.displayName,
          accessToken: accessToken,
          refreshToken: refreshToken,
          // Add token expiration if provided by Yahoo, otherwise manage manually
        };

        try {
          let user = await User.findOne({ yahooId: profile.id });

          if (user) {
            // Update tokens if they have changed
            user.accessToken = accessToken;
            user.refreshToken = refreshToken;
            // Update expiration if needed
            await user.save();
            done(null, user);
          } else {
            user = await User.create(newUser);
            done(null, user);
          }
        } catch (err) {
          console.error('Error in Yahoo Strategy:', err);
          done(err, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id); // Use MongoDB's default _id for session
  });

  passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
  });
};
