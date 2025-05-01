# MLB Fantasy Baseball Dashboard

A full-stack web application for managing and analyzing your Yahoo Fantasy Baseball leagues with powerful visualization and tracking tools.

## Overview

The MLB Fantasy Baseball Dashboard provides fantasy baseball managers with a comprehensive platform to:

- Connect with the Yahoo Fantasy Sports API
- View and manage multiple fantasy baseball leagues
- Monitor team performance and statistics
- Analyze player data and matchups
- Track weekly performance metrics with Power Index visualization

![telegram-cloud-photo-size-5-6098229433308661131-y](https://github.com/user-attachments/assets/4ca12246-98cc-4bdb-a47c-b51b6847e21a)
![telegram-cloud-photo-size-5-6098229433308661132-y](https://github.com/user-attachments/assets/8f04e1f0-5ff3-424c-bd98-a4d3d60dc196)



## Features

- **Yahoo Fantasy API Integration**: Seamless connection to Yahoo's Fantasy Baseball platform
- **Authentication System**: Secure user login and session management
- **League Management**: View and interact with all your fantasy baseball leagues
- **Team Analysis**: Detailed performance metrics for your fantasy teams
- **Player Statistics**: Real-time player data and performance tracking
- **Matchup Visualization**: Compare team stats with color-coded performance indicators
- **Power Index Tracking**: Track team performance over time with interactive charts
- **Weekly Reports**: Generate and download comprehensive weekly performance reports
- **Responsive Design**: User-friendly interface that works across devices

## Tech Stack

### Frontend
- React.js
- React Router for navigation
- Context API for state management
- Chart.js for data visualization
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
- `GET /api/leagues/:leagueId/powerindex`: Get power index data for teams in a league

### Teams
- `GET /api/teams/:teamId`: Get team details
- `GET /api/teams/:teamId/roster`: Get team roster
- `GET /api/teams/:teamId/stats`: Get team statistics

### Reports
- `GET /api/reports/weekly/:leagueId`: Get weekly report for a league
- `GET /api/reports/weekly/:leagueId/download`: Download weekly report as PDF

## License

MIT License

## Acknowledgements

- [Yahoo Fantasy Sports API](https://developer.yahoo.com/fantasy/)
- [React](https://reactjs.org/)
- [Express](https://expressjs.com/)
- [Chart.js](https://www.chartjs.org/)
