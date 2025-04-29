import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './DashboardPage.css';

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
        // Only try the authenticated endpoint if we have a user
        if (user) {
          try {
            // Try the authenticated endpoint
            const authResponse = await axios.get('http://localhost:5001/api/leagues', {
              withCredentials: true
            });
            // If successful, use the real data
            if (authResponse.data && authResponse.data.length > 0) {
              setLeagues(authResponse.data);
            } else {
              // Fallback to public data if no leagues found
              const response = await axios.get('http://localhost:5001/api/leagues/public', {
                withCredentials: true
              });
              setLeagues(response.data || []);
            }
          } catch (authErr) {
            console.warn('Authenticated endpoint failed:', authErr.message);
            // Try the public endpoint as fallback
            const response = await axios.get('http://localhost:5001/api/leagues/public', {
              withCredentials: true
            });
            setLeagues(response.data || []);
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
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Please log in to view your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="welcome-user">
          <h1>Fantasy Baseball Dashboard</h1>
          <p>Welcome, {user.displayName || 'Yahoo Fantasy User'}!</p>
        </div>
        <button className="logout-btn" onClick={logout}>Logout</button>
      </div>

      <div className="dashboard-info">
        <div className="info-box">
          <h3>MLB Fantasy Dashboard</h3>
          <p>Access your Yahoo fantasy baseball leagues, view team rosters, weekly matchups, and power rankings all in one place.</p>
        </div>
      </div>

      <div className="leagues-section">
        <h2>Your Leagues</h2>
        {loading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading leagues...</p>
          </div>
        )}
        
        {error && <div className="error-message">Error: {error}</div>}
        
        {!loading && !error && leagues.length === 0 && (
          <div className="no-leagues">
            <p>No leagues found.</p>
            <p>You don't appear to be a member of any MLB Fantasy leagues.</p>
          </div>
        )}
        
        {!loading && !error && leagues.length > 0 && (
          <div className="leagues-grid">
            {leagues.map(league => (
              <div key={league._id} className="league-card">
                <div className="league-card-content">
                  <h3>{league.name}</h3>
                  <div className="league-meta-info">
                    <span className="season-tag">Season {league.season}</span>
                    <span className="league-type">{league.leagueType} league</span>
                    <span className="scoring-type">{league.scoringType} scoring</span>
                  </div>
                  <div className="league-details">
                    <p><strong>Teams:</strong> {league.numTeams}</p>
                    {league.currentWeek && <p><strong>Current Week:</strong> {league.currentWeek}</p>}
                  </div>
                  <Link to={`/league/${league._id}`} className="view-league-btn">
                    View League
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <footer className="dashboard-footer">
        <p>MLB Fantasy Dashboard ©2025</p>
      </footer>
    </div>
  );
}

export default DashboardPage;
