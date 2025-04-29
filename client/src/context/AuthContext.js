import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import apiService from '../api/apiService'; // We'll create this next

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Start loading until we check auth status

  // Function to check authentication status on initial load
  const checkAuthStatus = useCallback(async () => {
    setLoading(true);
    try {
      // Use apiService which has the correct baseURL and credentials setting
      const response = await apiService.get('/api/auth/user');
      if (response.data && response.data.yahooId) { // Check for a valid user object
        setUser(response.data);
      } else {
        setUser(null); // Explicitly set to null if response is not a valid user
      }
    } catch (error) {
      // It's expected to get a 401 here if not logged in, apiService interceptor handles redirects
      // We only log if it's not a 401 or if the interceptor doesn't handle it
      if (!error.response || error.response.status !== 401) {
          console.error('Error checking auth status:', error.response ? error.response.data : error.message);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Login function (redirects to backend OAuth route)
  const login = () => {
    // Redirect the whole window to the backend route that starts the Yahoo OAuth flow
    // Use the full backend URL
    window.location.href = `${apiService.defaults.baseURL}/api/auth/yahoo`;
  };

  // Logout function
  const logout = async () => {
    try {
      await apiService.get('/api/auth/logout');
      setUser(null);
      // Redirect to login page after logout
      // Use frontend routing if available, otherwise full page reload
      window.location.href = '/login'; // Assuming '/login' is a frontend route
    } catch (error) {
      console.error('Logout failed:', error.response ? error.response.data : error.message);
    }
  };

  // Function to be called by CallbackHandler after successful auth
  // This might not be strictly necessary if checkAuthStatus runs after redirect
  const completeLogin = (userData) => {
    setUser(userData);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    checkAuthStatus, // Expose checkAuthStatus if needed elsewhere
    completeLogin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
