const yahooApiService = require('./yahooApiService'); // Import the new service

// --- Stat Definitions (Example - Needs Verification/Configuration) ---
// Define which stat IDs are considered "negative" (lower is better)
// These match the STAT_DOC mapping in LeaguePage.js
const NEGATIVE_STAT_IDS = [
    '26', // ERA (Earned Run Average)
    '27', // WHIP (Walks plus Hits per Innings Pitched)
    '39'  // Pitcher BB - negative
];

/**
 * Fetches weekly stats for all teams in a league using the provided access token.
 * @param {string} accessToken - Yahoo API access token.
 * @param {string} leagueId - Yahoo league ID.
 * @param {number} week - The fantasy week number.
 * @returns {Promise<Array<object>>} - Array of objects, each containing teamId and stats map.
 */
async function fetchAllTeamStatsForWeek(accessToken, leagueId, week) {
    try {
        // First, fetch all teams in the league directly from the Yahoo API
        const leagueTeamsUrl = `${yahooApiService.YAHOO_BASE_URL}/league/${leagueId}/teams`;
        const teamsData = await yahooApiService.makeAPIrequest(leagueTeamsUrl, accessToken);
        
        if (!teamsData || !teamsData.fantasy_content || !teamsData.fantasy_content.league || !teamsData.fantasy_content.league.teams) {
            console.error('Invalid teams data structure from Yahoo API');
            return [];
        }
        
        // Extract teams array from the response
        let teams = teamsData.fantasy_content.league.teams.team;
        if (!teams) {
            console.warn(`No teams found for league ${leagueId}`);
            return [];
        }
        
        // Ensure teams is an array
        teams = Array.isArray(teams) ? teams : [teams];
        
        console.log(`Found ${teams.length} teams in league ${leagueId}`);
        
        // Fetch stats for each team
        const teamStatsPromises = teams.map(async (team) => {
            const yahooTeamKey = team.team_key;
            const teamId = team.team_id;
            const teamName = team.name;
            const managerName = team.managers?.manager?.nickname || 'Unknown Manager';
            
            if (!yahooTeamKey) {
                console.error(`Team ${teamId} is missing team_key.`);
                return {
                    teamId: teamId,
                    yahooTeamKey: null,
                    name: teamName,
                    managerName: managerName,
                    stats: {},
                    error: true,
                    errorMessage: 'Missing team_key'
                };
            }
            
            const apiUrl = yahooApiService.myWeeklyStats(yahooTeamKey, week);
            
            try {
                // Fetch team stats from Yahoo API
                const yahooData = await yahooApiService.makeAPIrequest(apiUrl, accessToken);
                const fantasyContent = yahooData.fantasy_content;
                // Extract team stats from response
                const teamStatsData = fantasyContent?.team?.team_stats;
                const statsArray = teamStatsData?.stats?.stat;
                
                const processedStats = {};
                if (Array.isArray(statsArray)) {
                    statsArray.forEach(statInfo => {
                        const value = parseFloat(statInfo.value);
                        processedStats[statInfo.stat_id] = isNaN(value) ? statInfo.value : value;
                    });
                } else if (statsArray) { // Handle single stat object
                    const value = parseFloat(statsArray.value);
                    processedStats[statsArray.stat_id] = isNaN(value) ? statsArray.value : value;
                }
                
                return {
                    teamId: teamId,
                    yahooTeamKey: yahooTeamKey,
                    name: teamName,
                    managerName: managerName,
                    stats: processedStats,
                };
            } catch (error) {
                console.error(`Failed to fetch stats for team ${yahooTeamKey} week ${week}:`, error.message);
                return {
                    teamId: teamId,
                    yahooTeamKey: yahooTeamKey,
                    name: teamName,
                    managerName: managerName,
                    stats: {},
                    error: true,
                    isTokenExpired: error.isTokenExpired,
                    errorMessage: error.message
                };
            }
        });
        
        const results = await Promise.all(teamStatsPromises);
        
        // Check if any call failed due to token expiry
        const tokenExpiredError = results.find(r => r.isTokenExpired);
        if (tokenExpiredError) {
            const error = new Error('Token expired during batch stat fetch.');
            error.isTokenExpired = true;
            throw error;
        }
        
        return results;
    } catch (error) {
        console.error(`Error fetching team stats for league ${leagueId}, week ${week}:`, error.message);
        throw error;
    }
}

/**
 * Calculates the Power Index for all teams in a league for a specific week.
 * @param {string} accessToken - Yahoo API access token.
 * @param {string} leagueId - The Yahoo league ID.
 * @param {number} week - The fantasy week number.
 * @param {number} year - The season year.
 * @returns {Promise<Array<object>>} - Array of team stats with power index calculated.
 */
async function calculateAndStorePowerIndex(accessToken, leagueId, week, year) {
    // Pass accessToken to fetch function
    const allTeamStats = await fetchAllTeamStatsForWeek(accessToken, leagueId, week);
    const validTeamStats = allTeamStats.filter(ts => !ts.error && Object.keys(ts.stats).length > 0);
    console.log(`Found valid team stats for league ${leagueId}, week ${week}: `, validTeamStats.length);
    console.log('Teams found:', validTeamStats.map(team => team.name).join(', '));
    
    if (validTeamStats.length < 2) {
        console.warn(`Not enough valid team stats found for league ${leagueId}, week ${week} to calculate Power Index.`);
        // Return empty array since we can't calculate power index with less than 2 teams
        return [];
    }

    const powerIndexResults = [];
    console.log('\n=== POWER INDEX CALCULATION DETAILS ===');

    for (let i = 0; i < validTeamStats.length; i++) {
        const currentTeam = validTeamStats[i];
        let powerIndex = 0;
        
        console.log(`\n----- ${currentTeam.name} (${currentTeam.managerName}) Matchups -----`);
        const matchupDetails = [];

        for (let j = 0; j < validTeamStats.length; j++) {
            if (i === j) continue;
            const opponentTeam = validTeamStats[j];
            
            let matchupScore = 0;
            const statComparisons = [];

            console.log(`\n  vs ${opponentTeam.name} (${opponentTeam.managerName}):`);

            for (const statId in currentTeam.stats) {
                if (statId === "60" || statId === "50") continue; // Skip "60" stat ID (e.g., "Total Bases" or similar)
                const currentStatValue = currentTeam.stats[statId];
                const opponentStatValue = opponentTeam.stats[statId];

                if (opponentStatValue === undefined || typeof opponentStatValue !== 'number') {
                    opponentStatValue = 0;
                }
                if (typeof currentStatValue !== 'number' || typeof currentStatValue !== 'number') {
                    currentStatValue = 0;
                }

                const isNegativeStat = NEGATIVE_STAT_IDS.includes(statId);
                let comparisonResult = 0;

                if (isNegativeStat) {
                    if (currentStatValue < opponentStatValue) comparisonResult = 1;
                    else if (currentStatValue > opponentStatValue) comparisonResult = -1;
                } else {
                    if (currentStatValue > opponentStatValue) comparisonResult = 1;
                    else if (currentStatValue < opponentStatValue) comparisonResult = -1;
                }
                
                matchupScore += comparisonResult;
                
                statComparisons.push({
                    statId,
                    currentValue: currentStatValue,
                    opponentValue: opponentStatValue,
                    isNegative: isNegativeStat,
                    result: comparisonResult
                });
                
                console.log(`    Stat ${statId}: ${currentTeam.name} ${currentStatValue} vs ${opponentTeam.name} ${opponentStatValue} = ${comparisonResult} ${isNegativeStat ? '(Negative Stat)' : ''}`);
            }
            
            powerIndex += matchupScore;
            console.log(`  Matchup score vs ${opponentTeam.name}: ${matchupScore}`);
            
            matchupDetails.push({
                opponent: opponentTeam.name,
                score: matchupScore,
                details: statComparisons
            });
        }

        console.log(`\n  Total Power Index for ${currentTeam.name}: ${powerIndex}`);

        // Create power index result object
        const powerIndexResult = {
            team: {
                yahooTeamId: currentTeam.teamId,
                yahooTeamKey: currentTeam.yahooTeamKey,
                name: currentTeam.name,
                managerName: currentTeam.managerName,
            },
            stats: currentTeam.stats,
            powerIndex: powerIndex,
            matchupDetails: matchupDetails, // Store the detailed breakdown
            league: leagueId,
            week: week,
            year: year,
            calculatedAt: new Date()
        };

        powerIndexResults.push(powerIndexResult);
    }

    console.log('\n=== FINAL POWER INDEX RANKINGS ===');
    // Sort results by power index descending before returning
    powerIndexResults.sort((a, b) => b.powerIndex - a.powerIndex);
    
    // Print final rankings
    powerIndexResults.forEach((result, index) => {
        console.log(`${index + 1}. ${result.team.name}: ${result.powerIndex}`);
    });
    
    return powerIndexResults;
}

module.exports = { calculateAndStorePowerIndex, fetchAllTeamStatsForWeek };
