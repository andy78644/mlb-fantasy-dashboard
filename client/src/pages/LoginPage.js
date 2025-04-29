import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function LoginPage() {
  const [authCode, setAuthCode] = useState('');
  const [error, setError] = useState('');
  const [yahooAuthUrl, setYahooAuthUrl] = useState('#'); // Store the URL in state
  const location = useLocation();
  const navigate = useNavigate();
  const processedUrlErrorCodeRef = useRef(null);
  const hasSetUrlRef = useRef(false); // Track if we've set the Yahoo URL already

  // Initialize Yahoo Auth URL on component mount
  useEffect(() => {
    if (!hasSetUrlRef.current) {
      const clientId = process.env.REACT_APP_YAHOO_CLIENT_ID;
      if (!clientId) {
        setError('Yahoo Client ID is not configured in the frontend environment.');
        setYahooAuthUrl('#');
      } else {
        const redirectUri = 'oob';
        const responseType = 'code';
        const scope = 'fspt-r';
        setYahooAuthUrl(`https://api.login.yahoo.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=${responseType}&scope=${scope}`);
      }
      hasSetUrlRef.current = true;
    }
  }, []); // Empty dependency array - run once on mount

  // Handle URL error parameters
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const errorCode = queryParams.get('error');

    // Only process if there is an error code AND it's different from the one we just processed
    if (errorCode && errorCode !== processedUrlErrorCodeRef.current) {
      processedUrlErrorCodeRef.current = errorCode;

      let errorMessage = 'An unknown authentication error occurred.';
      switch (errorCode) {
        case 'no_code':
          errorMessage = 'Authorization code was missing.';
          break;
        case 'token_exchange_failed':
        case 'token_exchange_error':
          errorMessage = 'Failed to exchange code for tokens with Yahoo.';
          break;
        case 'invalid_code':
        case 'invalid_grant':
          errorMessage = 'The provided authorization code was invalid or expired.';
          break;
        default:
          errorMessage = `Authentication failed: ${errorCode}`;
      }
      
      setError(errorMessage);
      
      // Use setTimeout to break the potential render cycle
      // This schedules the navigation for the next tick after the render completes
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 0);
    } else if (!errorCode) {
      processedUrlErrorCodeRef.current = null;
    }
  }, [location.search, navigate]);

  const handleManualLogin = () => {
    if (!authCode.trim()) {
      setError('Please paste the Yahoo authorization code first.');
      return;
    }
    setError('');
    processedUrlErrorCodeRef.current = null;
    
    const callbackUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/auth/yahoo/callback?code=${encodeURIComponent(authCode.trim())}`;
    window.location.href = callbackUrl;
  };

  return (
    <div>
      <h1>Login Required</h1>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <p>
        To use the dashboard, you need to authorize with Yahoo Fantasy Sports.
      </p>
      <ol>
        <li>
          <a href={yahooAuthUrl} target="_blank" rel="noopener noreferrer">
            Click here to get your Yahoo Authorization Code
          </a>
           (opens in a new tab).
        </li>
        <li>Log in to Yahoo if prompted.</li>
        <li>Grant access to the application.</li>
        <li>Yahoo will display an authorization code. Copy that code.</li>
        <li>Paste the code into the input field below and click "Login".</li>
      </ol>

      <input
        type="text"
        value={authCode}
        onChange={(e) => setAuthCode(e.target.value)}
        placeholder="Paste Yahoo Authorization Code Here"
        style={{ width: '400px', marginBottom: '10px', padding: '8px' }}
        aria-label="Yahoo Authorization Code"
      />
      <br />
      <button onClick={handleManualLogin} style={{ padding: '10px 15px' }}>
        Login with Pasted Code
      </button>
    </div>
  );
}

export default LoginPage;
