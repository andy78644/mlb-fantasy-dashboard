const express = require('express');
// const connectDB = require('./config/db');
const dotenv = require('dotenv');
const session = require('express-session');
// const MongoStore = require('connect-mongo');
const path = require('path'); // Needed for serving static files
const cors = require('cors'); // Import the cors middleware

// Load env vars
dotenv.config();

// Connect to database
// connectDB();

const app = express();

// CORS Middleware - Allow requests from the frontend origin
app.use(cors({
  origin: 'http://localhost:3000', // Allow the frontend origin
  credentials: true // Allow cookies/session info to be sent
}));

// Init Middleware
app.use(express.json({ extended: false }));
app.use(express.urlencoded({ extended: true })); // For form data if needed

// Sessions Middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'keyboard cat', // Use an environment variable for secret
    resave: false,
    saveUninitialized: false, // Don't create session until something stored
    // Using memory store instead of MongoDB
    // Note: Memory store is not suitable for production as sessions are lost on server restart
    cookie: {
        // secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        maxAge: 1000 * 60 * 60 * 24 * 7 // Session expires in 7 days
    }
  })
);

// Define Routes
app.use('/api/auth', require('./routes/auth'));

// Add debug middleware for leagues route
app.use('/api/leagues', (req, res, next) => {
  console.log('DEBUG: Leagues route accessed:', {
    method: req.method,
    path: req.path,
    hasSession: !!req.session,
    hasYahooTokens: !!(req.session && req.session.yahooTokens),
  });
  next();
});

app.use('/api/leagues', require('./routes/leagues')); // Re-enabled leagues route
app.use('/api/teams', require('./routes/teams')); // Re-enabled teams route
// app.use('/api/reports', require('./routes/reports'));

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client', 'build', 'index.html'));
  });
} else {
    app.get('/', (req, res) => res.send('API Running (Development Mode)'));
}


const PORT = process.env.PORT || 5001;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
