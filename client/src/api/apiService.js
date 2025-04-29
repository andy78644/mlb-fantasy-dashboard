import axios from 'axios';

// Create an axios instance
const apiService = axios.create({
  // Explicitly set the backend URL
  baseURL: 'http://localhost:5001', // Use the backend server address
  withCredentials: true, // Send cookies with requests (important for session handling)
});

// For example, automatically redirecting to login on 401 errors
apiService.interceptors.response.use(
  response => response, // Simply return successful responses
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

export default apiService;
