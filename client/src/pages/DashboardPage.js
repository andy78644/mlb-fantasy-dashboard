import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../api/apiService';

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
        const response = await apiService.get('/api/leagues');
        setLeagues(response.data || []);
      } catch (err) {
        console.error("Error fetching leagues:", err);
        setError(err.response?.data?.message || 'Failed to fetch leagues');
        if (err.response?.status === 401) {
          // Handle unauthorized, maybe redirect to login or show message
          setError('Authentication error. Please log in again.');
          // Optionally call logout()
        }
      } finally {
        setLoading(false);
      }
    };

    if (user) { // Only fetch if user is logged in
      fetchLeagues();
    }
  }, [user]); // Re-fetch if user changes

  return (
    <div>
      <h1>Dashboard</h1>
      {user && <p>Welcome, {user.displayName || user.yahooId}!</p>}
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default DashboardPage;
