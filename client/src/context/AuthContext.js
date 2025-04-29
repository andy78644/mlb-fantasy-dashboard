import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import apiService from '../api/apiService';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  // User state might just be a boolean or hold minimal info like GUID if fetched
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Function to check authentication status using the new /status endpoint
  const checkAuthStatus = useCallback(async () => {
    setLoading(true);
    try {
      // Use the new /api/auth/status endpoint
      const response = await apiService.get('/api/auth/status');
      setIsAuthenticated(response.data.isAuthenticated);
      
      // If authenticated, fetch minimal user data
      if (response.data.isAuthenticated) {
        try {
          const userResponse = await apiService.get('/api/auth/user');
          setUser({
            displayName: 'Yahoo Fantasy User', // Placeholder since we don't have DB
            yahooId: 'Yahoo User',
            isAuthenticated: true
          });
        } catch (userError) {
          console.error('Error fetching user details:', userError);
          // Still set a minimal user object so the dashboard can render
          setUser({ displayName: 'Yahoo User', isAuthenticated: true });
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error.response ? error.response.data : error.message);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Logout function
  const logout = async () => {
    try {
      // Call the backend logout endpoint
      await apiService.get('/api/auth/logout');
      setIsAuthenticated(false);
      setUser(null);
      // Redirect to login page after logout - handled by frontend routing
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error.response ? error.response.data : error.message);
      // Still attempt to clear local state and redirect
      setIsAuthenticated(false);
      setUser(null);
      window.location.href = '/login';
    }
  };

  const value = {
    isAuthenticated,
    user,
    loading,
    logout,
    checkAuthStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
