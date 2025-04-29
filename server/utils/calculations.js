const Team = require('../models/Team');
const League = require('../models/League');
const WeeklyStats = require('../models/WeeklyStats');
const yahooApiService = require('./yahooApiService'); // Import the new service

// --- Stat Definitions (Example - Needs Verification/Configuration) ---
// Define which stat IDs are considered "negative" (lower is better)
// These are examples and might need adjustment based on specific league settings.
const NEGATIVE_STAT_IDS = [
    '47', // ERA (Earned Run Average)
    '50'  // WHIP (Walks plus Hits per Innings Pitched)
    // Add other relevant negative stat IDs if applicable (e.g., Errors)
];

/**
 * Fetches weekly stats for all teams in a league using the provided access token.
 * @param {string} accessToken - Yahoo API access token.
 * @param {string} leagueId - The MongoDB league ID.
 * @param {number} week - The fantasy week number.
 * @returns {Promise<Array<object>>} - Array of objects, each containing teamId (DB) and stats map.
 */
async function fetchAllTeamStatsForWeek(accessToken, leagueId, week) {
    const league = await League.findById(leagueId).populate('teams');
    if (!league) {
        throw new Error(`League not found with ID: ${leagueId}`);
    }
    if (!league.teams || league.teams.length === 0) {
        console.warn(`No teams found populated for league ${leagueId}. Fetching teams first might be necessary.`);
        // Optionally, you could try fetching teams here, but it might complicate the flow.
        // For now, we assume teams are populated beforehand (e.g., via getLeagueTeams controller).
        return [];
    }

    const teamStatsPromises = league.teams.map(async (team) => {
        // Ensure the team object has the necessary yahooTeamKey
        if (!team.yahooTeamKey) {
            console.error(`Team ${team._id} (Yahoo ID: ${team.yahooTeamId}) is missing yahooTeamKey.`);
            return {
                teamId: team._id,
                stats: {},
                error: true,
                errorMessage: 'Missing yahooTeamKey'
            };
        }

        const yahooTeamKey = team.yahooTeamKey;
        const apiUrl = yahooApiService.myWeeklyStats(yahooTeamKey, week); // Use URL builder

        try {
            // Use the new service and pass the accessToken
            const yahooData = await yahooApiService.makeAPIrequest(apiUrl, accessToken);
            const fantasyContent = yahooData.fantasy_content;
            // Adjust path based on actual response structure
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
                processedStats[statsArrays.stat_id] = isNaN(value) ? statsArrays.value : value;
            }

            return {
                teamId: team._id,
                stats: processedStats,
            };
        } catch (error) {
            console.error(`Failed to fetch stats for team ${team.yahooTeamKey} (DB ID: ${team._id}) week ${week}:`, error.message);
            // Pass specific error info if available (e.g., token expired)
            return {
                teamId: team._id,
                stats: {},
                error: true,
                isTokenExpired: error.isTokenExpired, // Propagate token expiry flag
                errorMessage: error.message
            };
        }
    });

    const results = await Promise.all(teamStatsPromises);

    // Check if any call failed due to token expiry
    const tokenExpiredError = results.find(r => r.isTokenExpired);
    if (tokenExpiredError) {
        // Re-throw an error that the controller can catch to trigger 401
        const error = new Error('Token expired during batch stat fetch.');
        error.isTokenExpired = true;
        throw error;
    }

    return results;
}

/**
 * Calculates the Power Index for all teams in a league for a specific week.
 * @param {string} accessToken - Yahoo API access token.
 * @param {string} leagueId - The MongoDB league ID.
 * @param {number} week - The fantasy week number.
 * @param {number} year - The season year.
 * @returns {Promise<Array<object>>} - Array of updated/created WeeklyStats documents, populated with team info.
 */
async function calculateAndStorePowerIndex(accessToken, leagueId, week, year) {
    // Pass accessToken to fetch function
    const allTeamStats = await fetchAllTeamStatsForWeek(accessToken, leagueId, week);
    const validTeamStats = allTeamStats.filter(ts => !ts.error && Object.keys(ts.stats).length > 0);

    if (validTeamStats.length < 2) {
        console.warn(`Not enough valid team stats found for league ${leagueId}, week ${week} to calculate Power Index.`);
        // Return existing stats if any, or empty array
        const existingStats = await WeeklyStats.find({ league: leagueId, week: week, year: year })
                                            .populate('team', 'name managerName teamLogoUrl yahooTeamId');
        return existingStats;
    }

    const powerIndexResults = [];

    for (let i = 0; i < validTeamStats.length; i++) {
        const currentTeam = validTeamStats[i];
        let powerIndex = 0;

        for (let j = 0; j < validTeamStats.length; j++) {
            if (i === j) continue;
            const opponentTeam = validTeamStats[j];

            for (const statId in currentTeam.stats) {
                const currentStatValue = currentTeam.stats[statId];
                const opponentStatValue = opponentTeam.stats[statId];

                if (opponentStatValue === undefined || typeof currentStatValue !== 'number' || typeof opponentStatValue !== 'number') {
                    continue;
                }

                const isNegativeStat = NEGATIVE_STAT_IDS.includes(statId);

                if (isNegativeStat) {
                    if (currentStatValue < opponentStatValue) powerIndex += 1;
                    else if (currentStatValue > opponentStatValue) powerIndex -= 1;
                } else {
                    if (currentStatValue > opponentStatValue) powerIndex += 1;
                    else if (currentStatValue < opponentStatValue) powerIndex -= 1;
                }
            }
        }

        const weeklyStatData = {
            team: currentTeam.teamId,
            league: leagueId,
            week: week,
            year: year,
            stats: currentTeam.stats,
            powerIndex: powerIndex,
            calculatedAt: new Date(),
        };

        const updatedStat = await WeeklyStats.findOneAndUpdate(
            { team: currentTeam.teamId, league: leagueId, week: week, year: year },
            weeklyStatData,
            { new: true, upsert: true }
        ).populate('team', 'name managerName teamLogoUrl yahooTeamId'); // Populate necessary team fields

        powerIndexResults.push(updatedStat);
    }

    console.log(`Calculated and stored Power Index for league ${leagueId}, week ${week}`);
    // Sort results by power index descending before returning
    powerIndexResults.sort((a, b) => b.powerIndex - a.powerIndex);
    return powerIndexResults;
}

module.exports = { calculateAndStorePowerIndex, fetchAllTeamStatsForWeek };
