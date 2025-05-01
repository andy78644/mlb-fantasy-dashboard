import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiService from '../api/apiService';
import './LeaguePage.css'; // We'll create this CSS file

// Define the STAT_DOC mapping with stat type (positive/negative/neutral)
// Format matches the .env file structure
const STAT_DOC = {
    "3": { name: "AVG", type: "positive" },
    "7": { name: "BB", type: "positive" },
    "12": { name: "HR", type: "positive" },
    "16": { name: "SB", type: "positive" },
    "18": { name: "R", type: "positive" },
    "13": { name: "RBI", type: "positive" },
    "26": { name: "ERA", type: "negative" },
    "27": { name: "WHIP", type: "negative" },
    "28": { name: "W", type: "positive" },
    "32": { name: "SV", type: "positive" },
    "39": { name: "BB", type: "negative" }, // Pitcher BB - negative
    "42": { name: "K", type: "positive" },
    "50": { name: "IP", type: "neutral" },
    "55": { name: "OPS", type: "positive" },
    "60": { name: "H/AB", type: "neutral" },
    "83": { name: "QS", type: "positive" }
};


function LeaguePage() {
  const { leagueId } = useParams();
  const [leagueDetails, setLeagueDetails] = useState(null);
  const [teams, setTeams] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [selectedManagerName, setSelectedManagerName] = useState('子右 楊');
  const [rosterData, setRosterData] = useState([]);
  const [matchupData, setMatchupData] = useState(null); // This will hold the raw matchup data
  const [powerIndexData, setPowerIndexData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState('roster');
  const [statDefinitions, setStatDefinitions] = useState({}); // State to hold stat definitions

  // Fetch league details and current week
  useEffect(() => {
    const fetchLeagueDetails = async () => {
      setLoading(true);
      setError(null); // Clear previous errors
      try {
        const response = await apiService.get(`/api/leagues/${leagueId}/metadata`);
        console.log("League metadata response:", response.data);
        const leagueContent = response.data?.fantasy_content?.league; // Safer access
        if (!leagueContent) {
          throw new Error("Invalid league metadata structure received.");
        }
        console.log("League metadata content:", leagueContent);
        setLeagueDetails({
          name: leagueContent.name,
          season: leagueContent.season,
          numTeams: leagueContent.num_teams,
          scoringType: leagueContent.scoring_type,
          currentWeek: parseInt(leagueContent.current_week),
          startWeek: parseInt(leagueContent.start_week),
          endWeek: parseInt(leagueContent.end_week)
        });

        // Extract and store stat definitions
        const statsArray = leagueContent.settings?.stat_categories?.stats?.stat;
        if (statsArray && Array.isArray(statsArray)) {
          const definitions = statsArray.reduce((acc, stat) => {
            acc[stat.stat_id] = stat.display_name || `Stat ${stat.stat_id}`;
            return acc;
          }, {});
          setStatDefinitions(definitions);
          console.log("Stat definitions set:", definitions);
        } else {
           console.warn("Could not find stat definitions in league metadata.");
           setStatDefinitions({}); // Set empty if not found
        }


        const week = parseInt(leagueContent.current_week);
        setCurrentWeek(week);
        // Only set selectedWeek if it hasn't been set yet (e.g., by user interaction)
        if (selectedWeek === null) {
            setSelectedWeek(week);
        }
      } catch (err) {
        console.error("Error fetching league details:", err);
        setError(err.message || err.response?.data?.message || 'Failed to fetch league details');
      } finally {
        setLoading(false);
      }
    };

    fetchLeagueDetails();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]); // Removed selectedWeek dependency here

  // Fetch teams when the league details are loaded
  useEffect(() => {
    const fetchTeams = async () => {
      if (!leagueDetails) return; // Wait for league details

      // setLoading(true); // Consider a separate loading state for teams if needed
      setError(null);
      try {
        const response = await apiService.get(`/api/teams/${leagueId}`);
        console.log("Teams data:", response.data);
        const fetchedTeams = response.data || [];
        setTeams(fetchedTeams);

        // Set the initial selected manager if the default isn't found or if teams load
        if (fetchedTeams.length > 0) {
            const defaultManagerExists = fetchedTeams.some(team => team.managerName === '子右 楊');
            if (!defaultManagerExists) {
                setSelectedManagerName(fetchedTeams[0].managerName); // Fallback to first manager
            }
            // If default manager exists, it's already set, no need to change
        } else {
            setSelectedManagerName(''); // No teams, clear selection
        }

      } catch (err) {
        console.error("Error fetching teams:", err);
        setError(err.response?.data?.message || 'Failed to fetch teams');
        setTeams([]); // Clear teams on error
        setSelectedManagerName('');
      } finally {
        // setLoading(false);
      }
    };

    fetchTeams();
  }, [leagueId, leagueDetails]); // Depend on leagueId and leagueDetails

  // Update myTeam whenever selectedManagerName or teams change
  useEffect(() => {
    if (teams.length > 0 && selectedManagerName) {
      const selectedTeam = teams.find(team => team.managerName === selectedManagerName);
      setMyTeam(selectedTeam || null);
      console.log("Selected team set:", selectedTeam);
    } else {
      setMyTeam(null); // Reset if no teams or manager selected
      console.log("Selected team reset.");
    }
  }, [teams, selectedManagerName]);


  // Fetch team roster when the selected team and week are available
  useEffect(() => {
    const fetchRoster = async () => {
      if (!myTeam || !selectedWeek) { // Use myTeam directly now
        setRosterData([]);
        return;
      }

      // setLoading(true); // Consider specific loading state
      setError(null);
      try {
        // Use the yahooTeamKey from the myTeam object
        const response = await apiService.yahoo.getTeamRoster(myTeam.yahooTeamKey, selectedWeek);
        console.log("Roster data for", selectedManagerName, "Week", selectedWeek, ":", response.data);

        const fantasyContent = response.data?.fantasy_content;
        const rosterPlayers = fantasyContent?.team?.roster?.players?.player;

        if (rosterPlayers) {
          const processedRoster = Array.isArray(rosterPlayers) ? rosterPlayers : [rosterPlayers];
          setRosterData(processedRoster.map(player => ({
            player_key: player.player_key,
            player_id: player.player_id,
            name: player.name?.full || 'Unknown Player',
            editorial_team_abbr: player.editorial_team_abbr || 'N/A',
            display_position: player.display_position || 'N/A',
            position_type: player.position_type || 'N/A',
            selected_position: player.selected_position?.position || 'Bench', // Default to Bench if missing
            status: player.status || '',
            headshot: player.headshot?.url,
          })));
        } else {
          console.log("No roster players found in response for week", selectedWeek);
          setRosterData([]); // Clear if no roster data in response
        }
      } catch (err) {
        console.error("Error fetching roster:", err);
        setError(err.response?.data?.message || 'Failed to fetch roster');
        setRosterData([]); // Clear roster on error
      } finally {
        // setLoading(false);
      }
    };

    fetchRoster();
  }, [myTeam, selectedWeek]); // Depend on myTeam and selectedWeek


    // Fetch team matchup when the selected team and week are available
    useEffect(() => {
      const fetchMatchup = async () => {
        if (!myTeam || !selectedWeek || !leagueId) {
          setMatchupData(null);
          return;
        }

        // Reset matchup data when dependencies change before fetching
        setMatchupData(null);
        setError(null); // Clear previous matchup errors

        try {
          const response = await apiService.yahoo.getTeamMatchup(myTeam.yahooTeamKey, selectedWeek);
          console.log(`Matchup data fetched for ${selectedManagerName}, Week ${selectedWeek}:`, response.data);

          // Directly set the data; parsing happens in renderMatchup
          setMatchupData(response.data);

        } catch (err) {
          console.error("Error fetching matchup:", err);
          setError(err.response?.data?.message || 'Failed to fetch matchup');
          setMatchupData(null); // Clear matchup on error
        } finally {
          // setLoadingMatchup(false);
        }
      };

      fetchMatchup();
    }, [myTeam, selectedWeek, leagueId, selectedManagerName]); // Added selectedManagerName to dependencies


  // Fetch power index data when leagueId, selectedWeek, and selectedYear are available
  useEffect(() => {
    const fetchPowerIndex = async () => {
      if (!leagueId || !selectedWeek || !selectedYear) return;

      // setLoading(true); // Consider specific loading state
      setError(null);
      try {
        const response = await apiService.get(`/api/leagues/${leagueId}/powerindex?week=${selectedWeek}&year=${selectedYear}`);
        setPowerIndexData(response.data || []);
      } catch (err) {
        console.error("Error fetching power index:", err);
        setError(err.response?.data?.message || 'Failed to fetch power index data');
        setPowerIndexData([]); // Clear on error
      } finally {
        // setLoading(false);
      }
    };

    // Only fetch if the power index tab is active or maybe always fetch?
    // For now, fetch when dependencies change, regardless of tab.
    fetchPowerIndex();
  }, [leagueId, selectedWeek, selectedYear]);

  const handleWeekChange = (e) => {
    const newWeek = parseInt(e.target.value);
    console.log("Week changed to:", newWeek);
    setSelectedWeek(newWeek);
    // Reset data that depends on the week
    setRosterData([]);
    setMatchupData(null);
    setPowerIndexData([]);
  };

  // Handler for manager dropdown change
  const handleManagerChange = (e) => {
    const newManager = e.target.value;
    console.log("Manager changed to:", newManager);
    setSelectedManagerName(newManager);
     // Reset data that depends on the manager/team
    setRosterData([]);
    setMatchupData(null);
    // Power index doesn't depend on selected manager, so no need to reset it here
  };

  const handleDownloadReport = async () => {
    setError(null); // Clear previous errors
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
      let errorMessage = 'Failed to download report';
      if (err.response?.data instanceof Blob) {
        // Try to read the error message from the blob response
        try {
            const errorText = await err.response.data.text();
            const errorJson = JSON.parse(errorText); // Assuming error is JSON
            errorMessage = errorJson.message || errorMessage;
        } catch (parseError) {
            console.error("Could not parse error blob:", parseError);
            errorMessage = 'Failed to download report (server error, unreadable response)';
        }
      } else if (err.response?.data?.message) {
          errorMessage = err.response.data.message;
      } else if (err.message) {
          errorMessage = err.message;
      }
      setError(errorMessage);
    }
  };

  // Generate week selector options
  const renderWeekOptions = () => {
    if (!leagueDetails) return <option>Loading...</option>;

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

  // Generate manager selector options
  const renderManagerOptions = () => {
    if (!teams || teams.length === 0) return <option>Loading...</option>;

    return teams.map(team => (
      // Use yahooTeamKey for stability if _id isn't always present
      <option key={team.yahooTeamKey || team._id} value={team.managerName}>
        {team.managerName} ({team.name}) {/* Show team name too */}
      </option>
    ));
  };


  // Render roster content
  const renderRoster = () => {
    if (!myTeam) {
      return <p>Select a team to view the roster.</p>;
    }
    // Add a check for loading state if you implement specific loading for roster
    // if (loadingRoster) return <p>Loading roster...</p>;

    if (!rosterData || rosterData.length === 0) {
      // Check if we attempted to load but got nothing vs. haven't loaded yet
      // This distinction might require more state, for now, assume empty means no data found
      return <p>No roster data available for {selectedManagerName} in Week {selectedWeek}. It might be loading or the roster is empty.</p>;
    }

    return (
      <div className="roster-container">
        <h3>{selectedManagerName}'s Roster - Week {selectedWeek}</h3>
        <div className="roster-grid">
          {rosterData.map(player => (
            <div key={player.player_key} className="player-card">
              <div className="player-header">
                <div className="player-position">{player.selected_position}</div>
                <div className="player-team">{player.editorial_team_abbr}</div>
              </div>
              <div className="player-photo">
                {player.headshot ? (
                  <img
                    src={player.headshot}
                    alt={player.name}
                    onError={(e) => { e.target.onerror = null; e.target.src='https://via.placeholder.com/80?text=No+Img'; }} // Placeholder on error
                   />
                ) : (
                  <div className="player-photo-placeholder">
                    {/* Simple initials placeholder */}
                    <span>{player.name?.split(' ').map(n => n[0]).join('') || '?'}</span>
                  </div>
                )}
              </div>
              <div className="player-name" title={player.name}>{player.name}</div> {/* Add title for long names */}
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

  // Render matchup content based on the provided format
  const renderMatchup = () => {
    if (!myTeam) {
      return <p>Select a team to view the matchup.</p>;
    }

    if (!matchupData) {
      return <p>No matchup data available for {selectedManagerName} in Week {selectedWeek}. It might be loading or data is missing.</p>;
    }

    // Parse the matchup data according to the format provided
    const fantasyContent = matchupData?.fantasy_content;
    if (!fantasyContent || !fantasyContent.team) {
      console.error("Invalid matchup data format:", matchupData);
      return <p>Invalid matchup data format received. Check console for details.</p>;
    }

    // Extract matchup data
    const teamData = fantasyContent.team;
    const matchups = teamData.matchups?.matchup;
    
    if (!matchups || !Array.isArray(matchups) || matchups.length === 0) {
      return <p>No matchup data found for {selectedManagerName} in Week {selectedWeek}.</p>;
    }

    // Get the first matchup (could filter by week if needed)
    const currentMatchup = matchups[0]; // Taking the first matchup
    
    if (!currentMatchup.teams || !Array.isArray(currentMatchup.teams) || currentMatchup.teams.length < 2) {
      return <p>Matchup data structure is incomplete. Expected two teams in the matchup.</p>;
    }

    // Find my team and opponent in the teams array
    const myTeamData = currentMatchup.teams.find(team => team.team_key === teamData.team_key);
    const opponentTeam = currentMatchup.teams.find(team => team.team_key !== teamData.team_key);
    
    if (!myTeamData || !opponentTeam) {
      return <p>Could not identify teams in the matchup data.</p>;
    }

    console.log("My team data:", myTeamData);
    console.log("Opponent team data:", opponentTeam);

    // Render the stat comparison
    const renderStatComparison = () => {
      // Get all unique stat IDs from both teams
      const allStatIds = new Set([
        ...Object.keys(myTeamData.stats || {}),
        ...Object.keys(opponentTeam.stats || {})
      ]);

      if (allStatIds.size === 0) {
        return <p>No stats available for comparison.</p>;
      }

      // Define offense and defense stat IDs based on STAT_DOC keys
      const offenseStatIds = ["3", "7", "12", "16", "18", "13", "55", "60"];
      const defenseStatIds = ["26", "27", "28", "32", "39", "42", "50", "83"];

      // Filter the available stat IDs into offense and defense categories
      const availableOffenseIds = Array.from(allStatIds).filter(id => offenseStatIds.includes(id)).sort();
      const availableDefenseIds = Array.from(allStatIds).filter(id => defenseStatIds.includes(id)).sort();
      const otherStatIds = Array.from(allStatIds).filter(id => !offenseStatIds.includes(id) && !defenseStatIds.includes(id)).sort(); // Catch any others

      // Updated renderStatRows to create a more structured layout
      const renderStatRows = (statIds, category) => {
        if (statIds.length === 0) return null;
        
        return (
          <tbody className={`${category}-stats`}>
            <tr className="section-header">
              <th colSpan="3">{category === 'offense' ? 'Offense' : 'Defense'}</th>
            </tr>
            {statIds.map(statId => {
              // Use STAT_DOC first, then fetched definitions, then default
              const statName = STAT_DOC[statId]?.name || statDefinitions[statId] || `Stat ${statId}`;
              const myValue = myTeamData.stats?.[statId]?.value || "-";
              const opponentValue = opponentTeam.stats?.[statId]?.value || "-";
              
              // Determine the stat type (positive/negative/neutral)
              const statType = STAT_DOC[statId]?.type || "neutral";
              
              // Set comparison classes based on the stat type and values
              let comparisonClass = "";
              
              if (myValue !== "-" && opponentValue !== "-") {
                const myValueNum = parseFloat(myValue);
                const oppValueNum = parseFloat(opponentValue);
                
                if (!isNaN(myValueNum) && !isNaN(oppValueNum)) {
                  if (statType === "positive") {
                    // For positive stats (higher is better)
                    comparisonClass = myValueNum > oppValueNum ? "stat-winning" : 
                                     (myValueNum < oppValueNum ? "stat-losing" : "");
                  } else if (statType === "negative") {
                    // For negative stats (lower is better)
                    comparisonClass = myValueNum < oppValueNum ? "stat-winning" : 
                                     (myValueNum > oppValueNum ? "stat-losing" : "");
                  }
                }
              }

              return (
                <tr key={statId} className={comparisonClass}>
                  <td>{statName}</td>
                  <td className="my-team-value">{myValue}</td>
                  <td>{opponentValue}</td>
                </tr>
              );
            })}
          </tbody>
        );
      };

      return (
        <div className="stats-comparison">
          <h3>Stats Comparison</h3>
          <table className="stats-table">
            <thead>
              <tr>
                <th>Stat</th>
                <th>{myTeamData.name}</th>
                <th>{opponentTeam.name}</th>
              </tr>
            </thead>
            {/* Offense Section */}
            {availableOffenseIds.length > 0 && renderStatRows(availableOffenseIds, 'offense')}
            {/* Defense Section */}
            {availableDefenseIds.length > 0 && renderStatRows(availableDefenseIds, 'defense')}
            {/* Other Stats Section (Optional) */}
            {otherStatIds.length > 0 && renderStatRows(otherStatIds, 'other')}
          </table>
        </div>
      );
    };

    // Render a team card with modern styling
    const renderTeamCard = (team) => {
      // Define offense and defense stat IDs
      const offenseStatIds = ["3", "7", "12", "16", "18", "13", "55", "60"];
      const defenseStatIds = ["26", "27", "28", "32", "39", "42", "50", "83"];
      
      // Filter the team stats into categories
      const offenseStats = {};
      const defenseStats = {};
      const otherStats = {};
      
      // Organize stats by category
      Object.entries(team.stats || {}).forEach(([statId, stat]) => {
        if (offenseStatIds.includes(statId)) {
          offenseStats[statId] = stat;
        } else if (defenseStatIds.includes(statId)) {
          defenseStats[statId] = stat;
        } else {
          otherStats[statId] = stat;
        }
      });
      
      // Helper function to render stats for a category
      const renderStatsByCategory = (statsObject, categoryName) => {
        if (Object.keys(statsObject).length === 0) return null;
        
        return (
          <div className={`team-stats-section ${categoryName.toLowerCase()}-section`}>
            <h4 className="stats-category-header">{categoryName}</h4>
            <div className="team-stats-grid">
              {Object.entries(statsObject).map(([statId, stat]) => {
                // Determine if this team is the user's team
                const isMyTeam = team.team_key === myTeamData.team_key;
                
                // Get the stat values for both teams to compare
                const myTeamValue = myTeamData.stats?.[statId]?.value || "-";
                const opponentValue = opponentTeam.stats?.[statId]?.value || "-";
                
                // Determine the stat type (positive/negative/neutral)
                const statType = STAT_DOC[statId]?.type || "neutral";
                
                // Set comparison class based on the stat type and comparison
                let comparisonClass = "";
                
                if (myTeamValue !== "-" && opponentValue !== "-") {
                  const myValueNum = parseFloat(myTeamValue);
                  const oppValueNum = parseFloat(opponentValue);
                  
                  if (!isNaN(myValueNum) && !isNaN(oppValueNum)) {
                    if (isMyTeam) {
                      // For my team card
                      if (statType === "positive") {
                        comparisonClass = myValueNum > oppValueNum ? "stat-winning" : 
                                        (myValueNum < oppValueNum ? "stat-losing" : "");
                      } else if (statType === "negative") {
                        comparisonClass = myValueNum < oppValueNum ? "stat-winning" : 
                                        (myValueNum > oppValueNum ? "stat-losing" : "");
                      }
                    } else {
                      // For opponent team card - reverse the logic
                      if (statType === "positive") {
                        comparisonClass = oppValueNum > myValueNum ? "stat-winning" : 
                                        (oppValueNum < myValueNum ? "stat-losing" : "");
                      } else if (statType === "negative") {
                        comparisonClass = oppValueNum < myValueNum ? "stat-winning" : 
                                        (oppValueNum > myValueNum ? "stat-losing" : "");
                      }
                    }
                  }
                }
                
                return (
                  <div key={statId} className={`stat-item ${comparisonClass}`}>
                    <span className="stat-name">{STAT_DOC[statId]?.name || statDefinitions[statId] || `Stat ${statId}`}</span>
                    <span className="stat-value">{stat.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      };
      
      return (
        <div className="team-card">
          <div className="team-header">
            <div className="team-logo">
              <img 
                src={team.team_logo} 
                alt={`${team.name} logo`}
                onError={(e) => { 
                  e.target.onerror = null; 
                  e.target.src = 'https://via.placeholder.com/100?text=Logo'; 
                }}
              />
            </div>
            <div className="team-info">
              <h3 className="team-name">{team.name}</h3>
              <p className="manager-name">Manager: {team.manager_name}</p>
              {team.points && <p className="team-points large">{team.points}</p>}
            </div>
          </div>
          
          <div className="team-stats-container">
            {renderStatsByCategory(offenseStats, "Offense")}
            {renderStatsByCategory(defenseStats, "Defense")}
            {Object.keys(otherStats).length > 0 && renderStatsByCategory(otherStats, "Other")}
          </div>
        </div>
      );
    };

    // Render the matchup status info
    const renderMatchupStatus = () => {
      let statusText = "In Progress";
      if (currentMatchup.status === "postevent") {
        statusText = currentMatchup.winner_team_key ? 
          `Winner: ${currentMatchup.winner_team_key === myTeamData.team_key ? myTeamData.name : opponentTeam.name}` : 
          "Completed (Tie)";
      } else if (currentMatchup.status === "preevent") {
        statusText = "Not Started";
      }
      
      const isPlayoffs = currentMatchup.is_playoffs === "1";
      const isConsolation = currentMatchup.is_consolation === "1";
      
      return (
        <div className="matchup-status">
          <p><strong>Status:</strong> {statusText}</p>
          {isPlayoffs && <p className="playoffs-tag">Playoff Matchup</p>}
          {isConsolation && <p className="consolation-tag">Consolation Matchup</p>}
        </div>
      );
    };

    return (
      <div className="matchup-container modern">
        <h2>Week {currentMatchup.week} Matchup</h2>
        {renderMatchupStatus()}
        
        <div className="matchup-teams">
          <div className="my-team">
            {renderTeamCard(myTeamData)}
          </div>
          <div className="vs-indicator">VS</div>
          <div className="opponent-team">
            {renderTeamCard(opponentTeam)}
          </div>
        </div>
        
        {renderStatComparison()}
      </div>
    );
  };


  // Render power index content
  const renderPowerIndex = () => {
    // Add loading check if specific loading state exists
    // if (loadingPowerIndex) return <p>Loading power index...</p>;

    if (!powerIndexData || !Array.isArray(powerIndexData) || powerIndexData.length === 0) {
      return <p>No power index data available for Week {selectedWeek}. It might be loading or data is missing.</p>;
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
              <tr key={teamStat.team?.yahooTeamKey || index} className={teamStat.team?.managerName === selectedManagerName ? 'my-team-row' : ''}>
                <td>{index + 1}</td>
                <td>
                  {teamStat.team?.teamLogoUrl ? (
                    <img
                      src={teamStat.team.teamLogoUrl}
                      alt="Team Logo"
                      className="team-small-logo"
                       onError={(e) => { e.target.onerror = null; e.target.src='https://via.placeholder.com/30?text=Logo'; }} // Placeholder
                    />
                  ) : (
                     <div className="team-small-logo-placeholder">?</div> // Placeholder div
                  )}
                </td>
                <td>{teamStat.team?.name || 'N/A'}</td>
                <td>{teamStat.team?.managerName || 'N/A'}</td>
                <td className="power-index-value">{teamStat.powerIndex?.toFixed(2) || 'N/A'}</td> {/* Format PI */}
              </tr>
            ))}
          </tbody>
        </table>
        <button
            className="download-btn"
            onClick={handleDownloadReport}
            disabled={!leagueId || !selectedWeek || !selectedYear} // Disable if needed info is missing
        >
          Download Week {selectedWeek} Report
        </button>
      </div>
    );
  };

  // Main component return
  return (
    <div className="league-page">
       {/* Global loading indicator (optional, could be more granular) */}
       {/* {loading && <div className="loading-overlay">Loading...</div>} */}

       {/* Display error prominently */}
       {error && <div className="error-message">Error: {error} <button onClick={() => setError(null)}>Dismiss</button></div>}

      {/* Render header only when leagueDetails are available */}
      {leagueDetails ? (
        <div className="league-header">
          <div className="league-header-content">
            <h1>{leagueDetails.name}</h1>
            <div className="league-meta">
              <span>Season: {leagueDetails.season}</span>
              <span>Teams: {leagueDetails.numTeams}</span>
              <span>Scoring: {leagueDetails.scoringType}</span>
              <span>Current Week: {currentWeek ?? '...'}</span>
            </div>
          </div>
        </div>
      ) : (
         !error && <div className="loading">Loading league details...</div> // Show loading only if no error
      )}

      {/* Render controls only when leagueDetails are available */}
      {leagueDetails && (
        <div className="controls-container">
          <div className="week-selector">
            <label htmlFor="week-select">Select Week:</label>
            <select
              id="week-select"
              value={selectedWeek ?? ''} // Handle null case
              onChange={handleWeekChange}
              disabled={!leagueDetails} // Already checked leagueDetails above, but good practice
            >
               {renderWeekOptions()}
            </select>
          </div>

          <div className="manager-selector">
            <label htmlFor="manager-select">Select Team:</label>
            <select
              id="manager-select"
              value={selectedManagerName}
              onChange={handleManagerChange}
              disabled={teams.length === 0} // Disable only if teams haven't loaded
            >
              {teams.length === 0 && !error ? ( // Show loading only if no error
                <option>Loading teams...</option>
              ) : (
                renderManagerOptions()
              )}
               {teams.length === 0 && error && <option>Error loading teams</option>}
            </select>
          </div>


          <div className="tabs">
            <button
              className={`tab-btn ${activeTab === 'roster' ? 'active' : ''}`}
              onClick={() => setActiveTab('roster')}
              disabled={!myTeam} // Disable if no team selected
            >
              Team Roster
            </button>
            <button
              className={`tab-btn ${activeTab === 'matchup' ? 'active' : ''}`}
              onClick={() => setActiveTab('matchup')}
              disabled={!myTeam} // Disable if no team selected
            >
              Team Matchup
            </button>
            <button
              className={`tab-btn ${activeTab === 'powerIndex' ? 'active' : ''}`}
              onClick={() => setActiveTab('powerIndex')}
              // Power index doesn't strictly require a selected team, so keep enabled
            >
              Power Index
            </button>
          </div>
        </div>
      )}

      {/* Render content area only when leagueDetails are available */}
      {leagueDetails && (
          <div className="content-container">
            {/* Add loading indicators within tabs if needed */}
            {activeTab === 'roster' && renderRoster()}
            {activeTab === 'matchup' && renderMatchup()}
            {activeTab === 'powerIndex' && renderPowerIndex()}
          </div>
      )}

    </div>
  );
}

export default LeaguePage;
