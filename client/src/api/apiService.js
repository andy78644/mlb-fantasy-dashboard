import axios from 'axios';

// Create an axios instance with Yahoo Fantasy API capabilities
const apiService = axios.create({
  baseURL: 'http://localhost:5001', // Backend server address
  withCredentials: true, // Send cookies with requests (important for session handling)
});

// Authentication error handling
apiService.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      // If we get a 401, it means the session is invalid or expired.
      // Redirect to login page.
      // Avoid redirecting if the original request was to the /api/auth/user endpoint
      // during the initial auth check, as that's expected to fail if not logged in.
      if (!error.config.url.endsWith('/api/auth/user')) {
         console.log('Received 401 Unauthorized. Redirecting to login.');
         // Use window.location to force a full page reload and clear state if needed
         window.location.href = '/login';
      }
    }
    // Return the error so components can handle it if needed
    return Promise.reject(error);
  }
);

// Add Yahoo Fantasy API specific methods
apiService.yahoo = {
  // User and league info
  getUserInfo: () => apiService.get('/api/leagues'),
  getLeagueMetadata: (leagueKey) => apiService.get(`/api/leagues/${leagueKey}/metadata`),
  
  // Team related methods
  getTeamRoster: (teamKey, week) => {
    const weekParam = week ? `?week=${week}` : '';
    return apiService.get(`/api/teams/${teamKey}/roster${weekParam}`);
  },
  getTeamWeeklyStats: (teamKey, week) => apiService.get(`/api/teams/${teamKey}/stats?week=${week}`),
  getTeamMatchup: (teamKey, week) => apiService.get(`/api/teams/${teamKey}/matchups?week=${week}`),
  
  // League data
  getScoreboard: (leagueKey, week) => apiService.get(`/api/leagues/${leagueKey}/scoreboard?week=${week}`),
  getFreeAgents: (leagueKey, start = 0, count = 25) => 
    apiService.get(`/api/leagues/${leagueKey}/players/free-agents?start=${start}&count=${count}`),
  
  // Other methods
  getTransactions: (leagueKey) => apiService.get(`/api/leagues/${leagueKey}/transactions`),
  getStatCategories: () => apiService.get('/api/stats/categories'),
  
  // Helper methods for working with Yahoo data
  parseYahooResponse: (data) => {
    // Helper to parse Yahoo's response format
    if (!data || !data.fantasy_content) {
      return null;
    }
    return data.fantasy_content;
  }
};

export default apiService;
