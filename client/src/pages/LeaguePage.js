import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiService from '../api/apiService';

function LeaguePage() {
  const { leagueId } = useParams();
  const [leagueDetails, setLeagueDetails] = useState(null);
  const [powerIndexData, setPowerIndexData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(1); // Default or fetch current week
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear()); // Default or fetch from league

  // TODO: Fetch league details (name, season, etc.) if needed
  // useEffect(() => { ... fetch league details ... }, [leagueId]);

  useEffect(() => {
    const fetchPowerIndex = async () => {
      setLoading(true);
      setError(null);
      try {
        // TODO: Get year dynamically from league details or state
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

  const handleDownloadReport = async () => {
    try {
        const response = await apiService.get(`/api/reports/${leagueId}/weekly?week=${selectedWeek}&year=${selectedYear}`, {
            responseType: 'blob', // Important for file download
        });

        // Create a URL for the blob object
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;

        // Extract filename from content-disposition header if available
        const contentDisposition = response.headers['content-disposition'];
        let filename = `weekly_report_week_${selectedWeek}_${selectedYear}.xlsx`; // Default filename
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
            if (filenameMatch && filenameMatch.length === 2)
                filename = filenameMatch[1];
        }

        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();

        // Clean up
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);

    } catch (err) {
        console.error("Error downloading report:", err);
        setError(err.response?.data?.message || 'Failed to download report');
        // Handle blob error specifically if needed
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
        } else {
             setError(err.response?.data?.message || 'Failed to download report');
        }
    }
};


  // TODO: Add controls to change selectedWeek and selectedYear

  return (
    <div>
      <h1>League Details (ID: {leagueId})</h1>
      {/* Display league name/details here */} 

      <h2>Power Index - Week {selectedWeek}, {selectedYear}</h2>

      <button onClick={handleDownloadReport}>Download Week {selectedWeek} Report</button>

      {loading && <p>Loading power index...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {!loading && !error && powerIndexData.length === 0 && <p>No power index data found for this week/year.</p>}
      {!loading && !error && powerIndexData.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Logo</th>
              <th>Team Name</th>
              <th>Manager</th>
              <th>Power Index</th>
              {/* Add more stat headers if needed */}
            </tr>
          </thead>
          <tbody>
            {powerIndexData.map((teamStat, index) => (
              <tr key={teamStat._id}>
                <td>{index + 1}</td>
                <td>{teamStat.team?.teamLogoUrl && <img src={teamStat.team.teamLogoUrl} alt="logo" style={{width: '30px', height: '30px'}} />}</td>
                <td>{teamStat.team?.name || 'N/A'}</td>
                <td>{teamStat.team?.managerName || 'N/A'}</td>
                <td>{teamStat.powerIndex}</td>
                {/* Render individual stats if available in teamStat.stats */}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default LeaguePage;
