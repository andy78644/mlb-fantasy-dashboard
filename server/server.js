const express = require('express');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const path = require('path'); // Needed for serving static files
const cors = require('cors'); // Import the cors middleware

// Load env vars
dotenv.config();

// Passport config
require('./config/passport')(passport); // Pass passport for configuration

// Connect to database
connectDB();

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
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: {
        // secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        maxAge: 1000 * 60 * 60 * 24 * 7 // Session expires in 7 days
    }
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/leagues', require('./routes/leagues'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/reports', require('./routes/reports'));

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
