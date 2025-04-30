import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiService from '../api/apiService';
import './LeaguePage.css'; // We'll create this CSS file

function LeaguePage() {
  const { leagueId } = useParams();
  const [leagueDetails, setLeagueDetails] = useState(null);
  const [teams, setTeams] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [rosterData, setRosterData] = useState([]);
  const [matchupData, setMatchupData] = useState(null);
  const [powerIndexData, setPowerIndexData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState('roster'); // 'roster', 'matchup', 'powerIndex'

  // Fetch league details and current week
  useEffect(() => {
    const fetchLeagueDetails = async () => {
      setLoading(true);
      try {
        // Fetch the league metadata from API
        const response = await apiService.get(`/api/leagues/${leagueId}/metadata`);
        const leagueContent = response.data.fantasy_content.league;
        
        setLeagueDetails({
          name: leagueContent.name,
          season: leagueContent.season,
          numTeams: leagueContent.num_teams,
          scoringType: leagueContent.scoring_type,
          currentWeek: parseInt(leagueContent.current_week),
          startWeek: parseInt(leagueContent.start_week),
          endWeek: parseInt(leagueContent.end_week)
        });
        
        // Set the current week and selected week
        const week = parseInt(leagueContent.current_week);
        setCurrentWeek(week);
        setSelectedWeek(week);
      } catch (err) {
        console.error("Error fetching league details:", err);
        setError(err.response?.data?.message || 'Failed to fetch league details');
      } finally {
        setLoading(false);
      }
    };

    fetchLeagueDetails();
  }, [leagueId]);

  // Fetch teams when the league details are loaded
  useEffect(() => {
    const fetchTeams = async () => {
      if (!leagueDetails) return;
      
      try {
        const response = await apiService.get(`/api/teams/${leagueId}`);
        setTeams(response.data);
        
        // Find the user's team 
        // For simplicity, we'll just use the first team for the demo
        // In a real app, you'd check which team belongs to the current user
        if (response.data.length > 0) {
          setMyTeam(response.data[0]);
        }
      } catch (err) {
        console.error("Error fetching teams:", err);
        setError(err.response?.data?.message || 'Failed to fetch teams');
      }
    };

    fetchTeams();
  }, [leagueId, leagueDetails]);

  // Fetch team roster when the user's team and selected week are available
  useEffect(() => {
    const fetchRoster = async () => {
      if (!myTeam || !selectedWeek) return;
      
      try {
        const response = await apiService.yahoo.getTeamRoster(myTeam.yahooTeamKey, selectedWeek);
        console.log("Roster data:", response.data);
        
        // Process the roster data
        const fantasyContent = response.data.fantasy_content;
        const rosterData = fantasyContent?.team?.roster?.players?.player;
        
        if (rosterData) {
          const processedRoster = Array.isArray(rosterData) ? rosterData : [rosterData];
          setRosterData(processedRoster.map(player => ({
            player_key: player.player_key,
            player_id: player.player_id,
            name: player.name?.full,
            editorial_team_abbr: player.editorial_team_abbr,
            display_position: player.display_position,
            position_type: player.position_type,
            selected_position: player.selected_position?.position,
            status: player.status || '',
            headshot: player.headshot?.url,
          })));
        }
      } catch (err) {
        console.error("Error fetching roster:", err);
        setError(err.response?.data?.message || 'Failed to fetch roster');
      }
    };

    fetchRoster();
  }, [myTeam, selectedWeek]);

  // Fetch team matchup when the user's team and selected week are available
  useEffect(() => {
    const fetchMatchup = async () => {
      if (!myTeam || !selectedWeek) return;
      
      try {
        const response = await apiService.yahoo.getTeamMatchup(myTeam.yahooTeamKey, selectedWeek);
        console.log("Matchup data:", response.data);
        setMatchupData(response.data);
      } catch (err) {
        console.error("Error fetching matchup:", err);
        setError(err.response?.data?.message || 'Failed to fetch matchup');
      }
    };

    fetchMatchup();
  }, [myTeam, selectedWeek]);

  // Fetch power index data when leagueId, selectedWeek, and selectedYear are available
  useEffect(() => {
    const fetchPowerIndex = async () => {
      if (!leagueId || !selectedWeek || !selectedYear) return;
      
      setLoading(true);
      setError(null);
      try {
        const response = await apiService.get(`/api/leagues/${leagueId}/powerindex?week=${selectedWeek}&year=${selectedYear}`);
        setPowerIndexData(response.data || []);
      } catch (err) {
        console.error("Error fetching power index:", err);
        setError(err.response?.data?.message || 'Failed to fetch power index data');
      } finally {
        setLoading(false);
      }
    };

    fetchPowerIndex();
  }, [leagueId, selectedWeek, selectedYear]);

  const handleWeekChange = (e) => {
    setSelectedWeek(parseInt(e.target.value));
  };

  const handleDownloadReport = async () => {
    try {
      const response = await apiService.get(`/api/reports/${leagueId}/weekly?week=${selectedWeek}&year=${selectedYear}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      const contentDisposition = response.headers['content-disposition'];
      let filename = `weekly_report_week_${selectedWeek}_${selectedYear}.xlsx`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch && filenameMatch.length === 2)
          filename = filenameMatch[1];
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading report:", err);
      setError(err.response?.data?.message || 'Failed to download report');
      
      if (err.response?.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const errorJson = JSON.parse(reader.result);
            setError(errorJson.message || 'Failed to download report (server error)');
          } catch (parseError) {
            setError('Failed to download report and parse error response.');
          }
        };
        reader.onerror = () => {
          setError('Failed to read error response from download.');
        };
        reader.readAsText(err.response.data);
      }
    }
  };

  // Generate week selector options
  const renderWeekOptions = () => {
    if (!leagueDetails) return null;
    
    const options = [];
    for (let week = leagueDetails.startWeek; week <= leagueDetails.endWeek; week++) {
      options.push(
        <option key={week} value={week}>
          Week {week} {week === currentWeek ? '(Current)' : ''}
        </option>
      );
    }
    return options;
  };

  // Render roster content
  const renderRoster = () => {
    if (!rosterData || rosterData.length === 0) {
      return <p>No roster data available.</p>;
    }

    return (
      <div className="roster-container">
        <h3>My Team Roster - Week {selectedWeek}</h3>
        <div className="roster-grid">
          {rosterData.map(player => (
            <div key={player.player_key} className="player-card">
              <div className="player-header">
                <div className="player-position">{player.selected_position}</div>
                <div className="player-team">{player.editorial_team_abbr}</div>
              </div>
              <div className="player-photo">
                {player.headshot ? (
                  <img src={player.headshot} alt={player.name} />
                ) : (
                  <div className="player-photo-placeholder">
                    <span>{player.name.split(' ').map(n => n[0]).join('')}</span>
                  </div>
                )}
              </div>
              <div className="player-name">{player.name}</div>
              <div className="player-details">
                <span>{player.display_position}</span>
                {player.status && <span className="player-status">{player.status}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render matchup content
  const renderMatchup = () => {
    if (!matchupData || !matchupData.teams || matchupData.teams.length === 0) {
      return <p>No matchup data available for Week {selectedWeek}.</p>;
    }

    return (
      <div className="matchup-container">
        <h3>Week {selectedWeek} Matchup</h3>
        <div className="matchup-grid">
          {matchupData.teams.map((team, index) => (
            <div key={team.team_key} className={`team-card ${team.team_key === myTeam?.yahooTeamKey ? 'my-team' : ''}`}>
              <div className="team-header">
                <img 
                  src={team.team_logo || 'https://yahoofantasysports-res.cloudinary.com/image/upload/t_s192sq/fantasy-logos/56507241142_10d540.jpg'} 
                  alt={team.name} 
                  className="team-logo"
                />
                <h4>{team.name}</h4>
                <p>{team.manager_name}</p>
              </div>
              
              <div className="team-points">
                <span className="points-value">{team.points}</span>
                <span className="points-label">Points</span>
              </div>

              {index === 0 && (
                <div className="matchup-vs">
                  <span>VS</span>
                </div>
              )}

              <div className="team-stats">
                {Object.entries(team.stats).map(([statId, stat]) => (
                  <div key={statId} className="stat-row">
                    <span className="stat-name">Stat {statId}</span>
                    <span className="stat-value">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render power index content
  const renderPowerIndex = () => {
    if (!powerIndexData || !Array.isArray(powerIndexData) || powerIndexData.length === 0) {
      return <p>No power index data available for Week {selectedWeek}.</p>;
    }

    return (
      <div className="power-index-container">
        <h3>Power Index - Week {selectedWeek}</h3>
        <table className="power-index-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Logo</th>
              <th>Team</th>
              <th>Manager</th>
              <th>Power Index</th>
            </tr>
          </thead>
          <tbody>
            {powerIndexData.map((teamStat, index) => (
              <tr key={index} className={teamStat.team?._id === myTeam?._id ? 'my-team-row' : ''}>
                <td>{index + 1}</td>
                <td>
                  {teamStat.team?.teamLogoUrl && (
                    <img 
                      src={teamStat.team.teamLogoUrl}
                      alt="Team Logo"
                      className="team-small-logo"
                    />
                  )}
                </td>
                <td>{teamStat.team?.name || 'N/A'}</td>
                <td>{teamStat.team?.managerName || 'N/A'}</td>
                <td className="power-index-value">{teamStat.powerIndex}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="download-btn" onClick={handleDownloadReport}>
          Download Week {selectedWeek} Report
        </button>
      </div>
    );
  };

  return (
    <div className="league-page">
      {loading && !leagueDetails && <div className="loading">Loading league details...</div>}
      {error && <div className="error-message">Error: {error}</div>}
      
      {leagueDetails && (
        <>
          <div className="league-header">
            <div className="league-header-content">
              <h1>{leagueDetails.name}</h1>
              <div className="league-meta">
                <span>Season: {leagueDetails.season}</span>
                <span>Teams: {leagueDetails.numTeams}</span>
                <span>Scoring: {leagueDetails.scoringType}</span>
                <span>Current Week: {currentWeek}</span>
              </div>
            </div>
          </div>

          <div className="controls-container">
            <div className="week-selector">
              <label htmlFor="week-select">Select Week:</label>
              <select 
                id="week-select"
                value={selectedWeek || ''}
                onChange={handleWeekChange}
              >
                {renderWeekOptions()}
              </select>
            </div>

            <div className="tabs">
              <button 
                className={`tab-btn ${activeTab === 'roster' ? 'active' : ''}`}
                onClick={() => setActiveTab('roster')}
              >
                My Roster
              </button>
              <button 
                className={`tab-btn ${activeTab === 'matchup' ? 'active' : ''}`}
                onClick={() => setActiveTab('matchup')}
              >
                Current Matchup
              </button>
              <button 
                className={`tab-btn ${activeTab === 'powerIndex' ? 'active' : ''}`}
                onClick={() => setActiveTab('powerIndex')}
              >
                Power Index
              </button>
            </div>
          </div>

          <div className="content-container">
            {activeTab === 'roster' && renderRoster()}
            {activeTab === 'matchup' && renderMatchup()}
            {activeTab === 'powerIndex' && renderPowerIndex()}
          </div>
        </>
      )}
    </div>
  );
}

export default LeaguePage;
