import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

function DashboardPage() {
  const { user, logout } = useAuth();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLeagues = async () => {
      setLoading(true);
      setError(null);
      try {
        // Try the test endpoint first to confirm route is working
        try {
          const testResponse = await axios.get('http://localhost:5001/api/leagues/test', {
            withCredentials: true
          });
          console.log('Test endpoint response:', testResponse.data);
        } catch (testErr) {
          console.warn('Test endpoint failed:', testErr.message);
        }

        // Use the public endpoint that doesn't require authentication
        const response = await axios.get('http://localhost:5001/api/leagues/public', {
          withCredentials: true
        });
        setLeagues(response.data || []);
        
        // Only try the authenticated endpoint if we have a user
        if (user) {
          try {
            // Try the authenticated endpoint
            const authResponse = await axios.get('http://localhost:5001/api/leagues', {
              withCredentials: true
            });
            // If successful, override with the real data
            if (authResponse.data && authResponse.data.length > 0) {
              setLeagues(authResponse.data);
            }
          } catch (authErr) {
            console.warn('Authenticated endpoint failed:', authErr.message);
            // Continue using the public data, no need to show error
          }
        }
      } catch (err) {
        console.error("Error fetching leagues:", err);
        setError(err.response?.data?.message || 'Failed to fetch leagues');
        if (err.response?.status === 401) {
          setError('Authentication error. Please log in again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLeagues();
  }, [user]);

  if (!user) {
    return (
      <div className="loading-container">
        <p>Please log in to view your dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Dashboard</h1>
      {user && <p>Welcome, {user.displayName || 'Yahoo Fantasy User'}!</p>}
      <div style={{ color: 'blue', padding: '10px', margin: '10px 0', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
        <p><strong>Note:</strong> Fetching real league data from Yahoo Fantasy API.</p>
      </div>
      <button onClick={logout}>Logout</button>

      <h2>Your Leagues</h2>
      {loading && <p>Loading leagues...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {!loading && !error && leagues.length === 0 && <p>No leagues found.</p>}
      {!loading && !error && leagues.length > 0 && (
        <ul>
          {leagues.map(league => (
            <li key={league._id}>
              <Link to={`/league/${league._id}`}>
                {league.name} ({league.season})
              </Link>
              <div style={{ fontSize: '0.85em', marginLeft: '1em', color: '#666' }}>
                {league.leagueType} league | {league.scoringType} scoring | Teams: {league.numTeams}
                {league.currentWeek && <span> | Current Week: {league.currentWeek}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default DashboardPage;
