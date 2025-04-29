const ExcelJS = require('exceljs');
const WeeklyStats = require('../models/WeeklyStats');
const League = require('../models/League');
const { calculateAndStorePowerIndex } = require('../utils/calculations'); // To potentially trigger calculation

// Generate and send a weekly report
exports.generateWeeklyReport = async (req, res) => {
  try {
    const accessToken = req.accessToken; // Get token from middleware
    const { leagueId } = req.params; // DB League ID
    const week = parseInt(req.query.week);
    const year = parseInt(req.query.year);

    if (!accessToken) {
        return res.status(401).json({ message: 'Access token not available.' });
    }
    if (!week || !year) {
      return res.status(400).json({ message: 'Week and Year query parameters are required' });
    }

    // 1. Fetch league details (optional, for report title)
    const league = await League.findById(leagueId);
    const leagueName = league ? league.name : `League ${leagueId}`;

    // 2. Fetch Power Index / Weekly Stats data
    let weeklyStatsData = await WeeklyStats.find({ league: leagueId, week: week, year: year })
                                        .sort({ powerIndex: -1 }) // Sort by Power Index descending
                                        .populate('team', 'name managerName yahooTeamId');

    // If no data found, try calculating it first
    if (!weeklyStatsData || weeklyStatsData.length === 0) {
        console.log(`No pre-calculated stats found for report (League ${leagueId}, Week ${week}, Year ${year}). Triggering calculation.`);
        // Pass accessToken to the calculation function
        weeklyStatsData = await calculateAndStorePowerIndex(accessToken, leagueId, week, year);
        // Re-sort after calculation (calculateAndStorePowerIndex now sorts internally)
        // weeklyStatsData.sort((a, b) => b.powerIndex - a.powerIndex);
    }

    if (!weeklyStatsData || weeklyStatsData.length === 0) {
        return res.status(404).json({ message: `No stats data found or could be calculated for league ${leagueId}, week ${week}, year ${year}.` });
    }

    // 3. Create Excel Workbook and Worksheet
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Yahoo Fantasy Dashboard';
    workbook.lastModifiedBy = 'Yahoo Fantasy Dashboard';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet(`Week ${week} Power Index`);

    // --- Define Columns --- 
    // TODO: Dynamically get stat names/IDs from league settings if possible
    const columns = [
        { header: 'Rank', key: 'rank', width: 8 },
        { header: 'Team Name', key: 'teamName', width: 30 },
        { header: 'Manager', key: 'managerName', width: 25 },
        { header: 'Power Index', key: 'powerIndex', width: 15, numFmt: '0.00' }, // Added number format
    ];

    // Dynamically add stat columns based on the first team's stats
    const firstTeamStats = weeklyStatsData[0].stats;
    const statHeaders = {}; // To store statId -> header mapping (if available)
    // TODO: Fetch stat metadata (names/abbreviations) from Yahoo API
    // For now, use stat IDs as headers
    const statMetadata = {}; // Placeholder for fetched stat names

    if (firstTeamStats) {
        Object.keys(firstTeamStats).sort().forEach(statId => {
            const headerName = statMetadata[statId]?.name || `Stat_${statId}`; // Use fetched name or fallback
            statHeaders[statId] = headerName;
            columns.push({ 
                header: headerName, 
                key: `stat_${statId}`, 
                width: 12, 
                // Apply number format if the value is numeric
                numFmt: typeof firstTeamStats[statId] === 'number' ? '0.00' : undefined 
            });
        });
    }
    worksheet.columns = columns;

    // --- Add Header Row(s) ---
    worksheet.mergeCells('A1', `${String.fromCharCode(64 + columns.length)}1`); // Merge cells for title
    worksheet.getCell('A1').value = `${leagueName} - Week ${week}, ${year} Power Index Report`;
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    worksheet.getRow(2).values = columns.map(col => col.header);
    worksheet.getRow(2).font = { bold: true };
    worksheet.getRow(2).alignment = { horizontal: 'center' };

    // --- Populate Rows --- 
    weeklyStatsData.forEach((data, index) => {
        const rowData = {
            rank: index + 1,
            teamName: data.team ? data.team.name : 'N/A',
            managerName: data.team ? data.team.managerName : 'N/A',
            powerIndex: data.powerIndex,
        };
        // Add individual stat values
        if (data.stats) {
            Object.keys(statHeaders).forEach(statId => {
                rowData[`stat_${statId}`] = data.stats[statId] !== undefined ? data.stats[statId] : '-';
            });
        }
        const row = worksheet.addRow(rowData);
        // Center align rank and power index
        row.getCell('rank').alignment = { horizontal: 'center' };
        row.getCell('powerIndex').alignment = { horizontal: 'center' };
    });

    // --- Style and Formatting (Optional) ---
    worksheet.eachRow({ includeEmpty: false }, function(row, rowNumber) {
        if (rowNumber > 1) { // Skip title row
            row.eachCell({ includeEmpty: true }, function(cell, colNumber) {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                if (rowNumber === 2) { // Header row
                    cell.fill = {
                        type: 'pattern',
                        pattern:'solid',
                        fgColor:{argb:'FFD3D3D3'} // Light grey fill
                    };
                }
            });
        }
    });

    // 4. Set Response Headers for Download
    const fileName = `Yahoo_MLB_${leagueName.replace(/\W+/g, '_')}_Week_${week}_${year}_Report.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );

    // 5. Write Workbook to Response
    await workbook.xlsx.write(res);
    res.end(); // End the response after writing the file

  } catch (err) {
    console.error('Error generating weekly report:', err.message);
    // Ensure headers aren't already sent before sending error response
    if (!res.headersSent) {
        // Check for token errors propagated from calculations
        if (err.isTokenExpired || err.message.includes('401') || (err.response && err.response.status === 401)) {
            return res.status(401).json({ message: 'Authentication error with Yahoo. Please login again.' });
        }
        res.status(500).send('Server Error generating report');
    }
  }
};
