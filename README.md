# MLB Fantasy Baseball Dashboard

A full-stack web application for managing and analyzing your Yahoo Fantasy Baseball leagues.

## Overview

The MLB Fantasy Baseball Dashboard provides fantasy baseball managers with a comprehensive platform to:

- Connect with the Yahoo Fantasy Sports API
- View and manage multiple fantasy baseball leagues
- Monitor team performance and statistics
- Analyze player data and matchups
- Track weekly performance metrics

## Features

- **Yahoo Fantasy API Integration**: Seamless connection to Yahoo's Fantasy Baseball platform
- **Authentication System**: Secure user login and session management
- **League Management**: View and interact with all your fantasy baseball leagues
- **Team Analysis**: Detailed performance metrics for your fantasy teams
- **Player Statistics**: Real-time player data and performance tracking
- **Responsive Design**: User-friendly interface that works across devices

## Tech Stack

### Frontend
- React.js
- React Router for navigation
- Context API for state management
- CSS for styling

### Backend
- Node.js
- Express.js
- RESTful API architecture
- Session-based authentication

### External APIs
- Yahoo Fantasy Sports API

## Project Structure

```
├── client/               # React frontend
│   ├── public/           # Static files
│   └── src/              # Source files
│       ├── api/          # API service functions
│       ├── components/   # Reusable UI components
│       ├── context/      # React context providers
│       └── pages/        # Page components
│
└── server/               # Node.js backend
    ├── config/           # Configuration files
    ├── controllers/      # Request handlers
    ├── middleware/       # Express middleware
    ├── models/           # Data models
    ├── routes/           # API routes
    └── utils/            # Utility functions
```

## Setup and Installation

### Prerequisites
- Node.js (v14 or later recommended)
- npm or yarn
- Yahoo Developer account (for API access)

### Environment Setup
1. Create a `.env` file in the server directory with the following variables:
```
PORT=5001
NODE_ENV=development
SESSION_SECRET=your_session_secret
YAHOO_CLIENT_ID=your_yahoo_client_id
YAHOO_CLIENT_SECRET=your_yahoo_client_secret
```

### Installation Steps
1. Clone the repository
   ```
   git clone https://github.com/yourusername/mlb-fantasy-dashboard.git
   cd mlb-fantasy-dashboard
   ```

2. Install server dependencies
   ```
   cd server
   npm install
   ```

3. Install client dependencies
   ```
   cd ../client
   npm install
   ```

4. Start the development servers
   ```
   # In the server directory
   npm run dev

   # In the client directory (in a separate terminal)
   npm start
   ```

5. Access the application at `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/yahoo`: Initiate Yahoo OAuth flow
- `GET /api/auth/yahoo/callback`: Yahoo OAuth callback handler
- `GET /api/auth/user`: Get current authenticated user
- `POST /api/auth/logout`: Logout current user

### Leagues
- `GET /api/leagues`: Get user's fantasy leagues
- `GET /api/leagues/:leagueId`: Get specific league details

### Teams
- `GET /api/teams/:teamId`: Get team details
- `GET /api/teams/:teamId/roster`: Get team roster
- `GET /api/teams/:teamId/stats`: Get team statistics

## Contribution Guidelines

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[MIT License](LICENSE)

## Acknowledgements

- [Yahoo Fantasy Sports API](https://developer.yahoo.com/fantasy/)
- [React](https://reactjs.org/)
- [Express](https://expressjs.com/)