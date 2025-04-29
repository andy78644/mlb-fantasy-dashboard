const Team = require('../models/Team');
const League = require('../models/League');
const WeeklyStats = require('../models/WeeklyStats');
const { makeYahooApiRequest } = require('./yahooApi');

// --- Stat Definitions (Example - Needs Verification/Configuration) ---
// Define which stat IDs are considered "negative" (lower is better)
// These are examples and might need adjustment based on specific league settings.
const NEGATIVE_STAT_IDS = [
    '47', // ERA (Earned Run Average)
    '50'  // WHIP (Walks plus Hits per Innings Pitched)
    // Add other relevant negative stat IDs if applicable (e.g., Errors)
];

/**
 * Fetches weekly stats for all teams in a league.
 * @param {string} userId - The MongoDB user ID making the request.
 * @param {string} leagueId - The MongoDB league ID.
 * @param {number} week - The fantasy week number.
 * @returns {Promise<Array<object>>} - Array of objects, each containing teamId (DB) and stats map.
 */
async function fetchAllTeamStatsForWeek(userId, leagueId, week) {
    const league = await League.findById(leagueId).populate('teams');
    if (!league) {
        throw new Error(`League not found with ID: ${leagueId}`);
    }

    const yahooLeagueKey = league.yahooLeagueId;
    const leagueKeyParts = yahooLeagueKey.split('.');
    const gameCode = leagueKeyParts[0];
    const yahooLeagueId = leagueKeyParts[2];

    const teamStatsPromises = league.teams.map(async (team) => {
        const yahooTeamKey = `${gameCode}.l.${yahooLeagueId}.t.${team.yahooTeamId}`;
        const apiUrl = `/team/${yahooTeamKey}/stats;type=week;week=${week}`;

        try {
            const yahooData = await makeYahooApiRequest(userId, apiUrl);
            const fantasyContent = yahooData.fantasy_content;
            const teamStatsData = fantasyContent.team[1].team_stats;
            const statsArray = teamStatsData.stats; // Array of stat objects

            const processedStats = {};
            statsArray.forEach(statObj => {
                const statInfo = statObj.stat;
                // Store value as a number if possible, otherwise keep original
                const value = parseFloat(statInfo.value);
                processedStats[statInfo.stat_id] = isNaN(value) ? statInfo.value : value;
            });

            return {
                teamId: team._id, // Use DB team ID
                stats: processedStats,
            };
        } catch (error) {
            console.error(`Failed to fetch stats for team ${team.yahooTeamId} (DB ID: ${team._id}) week ${week}:`, error.message);
            // Return null or empty stats for this team if fetching fails
            return {
                teamId: team._id,
                stats: {},
                error: true // Flag that there was an error
            };
        }
    });

    return Promise.all(teamStatsPromises);
}

/**
 * Calculates the Power Index for all teams in a league for a specific week.
 * @param {string} userId - The MongoDB user ID making the request.
 * @param {string} leagueId - The MongoDB league ID.
 * @param {number} week - The fantasy week number.
 * @param {number} year - The season year.
 * @returns {Promise<Array<object>>} - Array of updated/created WeeklyStats documents.
 */
async function calculateAndStorePowerIndex(userId, leagueId, week, year) {
    const allTeamStats = await fetchAllTeamStatsForWeek(userId, leagueId, week);
    const validTeamStats = allTeamStats.filter(ts => !ts.error && Object.keys(ts.stats).length > 0);

    if (validTeamStats.length < 2) {
        console.warn(`Not enough team stats found for league ${leagueId}, week ${week} to calculate Power Index.`);
        return [];
    }

    const powerIndexResults = [];

    for (let i = 0; i < validTeamStats.length; i++) {
        const currentTeam = validTeamStats[i];
        let powerIndex = 0;

        for (let j = 0; j < validTeamStats.length; j++) {
            if (i === j) continue; // Don't compare team against itself

            const opponentTeam = validTeamStats[j];

            // Iterate through stats of the current team
            for (const statId in currentTeam.stats) {
                const currentStatValue = currentTeam.stats[statId];
                const opponentStatValue = opponentTeam.stats[statId];

                // Skip if opponent doesn't have the stat or values are not comparable numbers
                if (opponentStatValue === undefined || typeof currentStatValue !== 'number' || typeof opponentStatValue !== 'number') {
                    continue;
                }

                const isNegativeStat = NEGATIVE_STAT_IDS.includes(statId);

                if (isNegativeStat) {
                    // Lower is better for negative stats
                    if (currentStatValue < opponentStatValue) {
                        powerIndex += 1;
                    } else if (currentStatValue > opponentStatValue) {
                        powerIndex -= 1;
                    }
                    // If equal, score is 0 (no change)
                } else {
                    // Higher is better for positive stats
                    if (currentStatValue > opponentStatValue) {
                        powerIndex += 1;
                    } else if (currentStatValue < opponentStatValue) {
                        powerIndex -= 1;
                    }
                    // If equal, score is 0 (no change)
                }
            }
        }

        // Store or update the WeeklyStats document
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
            { new: true, upsert: true } // Create if not found, return updated doc
        ).populate('team', 'name yahooTeamId'); // Populate team name for easier display

        powerIndexResults.push(updatedStat);
    }

    console.log(`Calculated and stored Power Index for league ${leagueId}, week ${week}`);
    return powerIndexResults;
}

module.exports = { calculateAndStorePowerIndex, fetchAllTeamStatsForWeek };
