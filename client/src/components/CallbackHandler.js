import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../api/apiService';

// This component handles the redirect back from Yahoo OAuth
function CallbackHandler() {
  const navigate = useNavigate();
  const { completeLogin, checkAuthStatus } = useAuth();
  const [message, setMessage] = React.useState('Processing authentication...');

  useEffect(() => {
    // When this component mounts, the backend should have already set the session cookie.
    // We just need to fetch the user data to confirm and update the context.
    const fetchUserAndRedirect = async () => {
      try {
        // Use checkAuthStatus which already fetches /api/auth/user
        await checkAuthStatus(); 
        // If checkAuthStatus succeeds, the user state in AuthContext is updated.
        // Now we can redirect to the dashboard.
        setMessage('Authentication successful! Redirecting...');
        navigate('/dashboard', { replace: true });
      } catch (error) {
        // This catch might not be necessary if checkAuthStatus handles its own errors
        console.error('Authentication failed after callback:', error);
        setMessage('Authentication failed. Please try logging in again.');
        // Optionally redirect to login after a delay
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      }
    };

    fetchUserAndRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, checkAuthStatus]); // Depend on checkAuthStatus from context

  return <div>{message}</div>;
}

export default CallbackHandler;
