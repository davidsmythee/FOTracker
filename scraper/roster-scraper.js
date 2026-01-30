#!/usr/bin/env node

/**
 * Lacrosse Roster Scraper
 * Extracts player name, number, and position from team roster pages
 *
 * Usage:
 *   node roster-scraper.js <url> <team-name>
 *
 * Example:
 *   node roster-scraper.js "https://goprincetontigers.com/sports/mens-lacrosse/roster" "Princeton University"
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m'
};

function parseHTML(html, teamName) {
    // Common patterns for roster tables
    const players = [];

    // Strategy 1: Look for table rows with player data
    // Most roster pages use tables with class names like 'roster', 'players', etc.
    const tableRowRegex = /<tr[^>]*class="[^"]*(?:roster|player)[^"]*"[^>]*>(.*?)<\/tr>/gis;
    const rowMatches = html.matchAll(tableRowRegex);

    for (const rowMatch of rowMatches) {
        const rowHtml = rowMatch[1];

        // Extract data from table cells
        const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
        const cells = Array.from(rowHtml.matchAll(cellRegex)).map(m =>
            m[1].replace(/<[^>]+>/g, '').trim()
        );

        if (cells.length >= 2) {
            // Common formats:
            // [number, name, position, ...]
            // [name, number, position, ...]
            // [number, name, year, position, ...]

            let number = '';
            let name = '';
            let position = '';
            let classYear = '';

            // Detect which cell is which
            for (let i = 0; i < Math.min(cells.length, 5); i++) {
                const cell = cells[i];
                const cellLower = cell.toLowerCase();

                // Number: Usually 1-2 digits, sometimes with #
                if (/^#?\d{1,2}$/.test(cell) && !number) {
                    number = cell.replace('#', '');
                }
                // Class Year: Check for year keywords
                else if (!classYear && (
                    cellLower === 'fr' || cellLower === 'fr.' ||
                    cellLower === 'so' || cellLower === 'so.' ||
                    cellLower === 'jr' || cellLower === 'jr.' ||
                    cellLower === 'sr' || cellLower === 'sr.' ||
                    cellLower.includes('freshman') || cellLower.includes('fresh.') ||
                    cellLower.includes('sophomore') || cellLower.includes('soph.') ||
                    cellLower.includes('junior') ||
                    cellLower.includes('senior') ||
                    cellLower.includes('graduate') || cellLower === 'grad' || cellLower === 'gr'
                )) {
                    classYear = cell;
                }
                // Position: Check for position-related keywords (more flexible matching)
                else if (!position && (
                    cellLower.includes('fogo') || cellLower.includes('face') || cellLower === 'fo' || cellLower === 'f/o' || cellLower.includes('m/fo') || cellLower.includes('/fo') ||
                    cellLower.includes('lsm') || cellLower.includes('long stick') ||
                    cellLower.includes('ssdm') || (cellLower.includes('short stick') && cellLower.includes('def')) ||
                    cellLower === 'a' || cellLower === 'att' || cellLower.includes('attack') ||
                    cellLower === 'm' || cellLower === 'mid' || cellLower.includes('midfield') ||
                    cellLower === 'd' || cellLower === 'def' || cellLower.includes('defense') || cellLower.includes('defender') ||
                    cellLower === 'g' || cellLower.includes('goal') || cellLower.includes('keeper')
                )) {
                    position = cell;
                }
                // Name: Usually has spaces or capitalized words
                else if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(cell) && !name) {
                    name = cell;
                }
            }

            // Fallback: use positional parsing if not found
            if (!name && cells.length >= 2) {
                name = cells.find(c => /^[A-Z][a-z]+(\s+[A-Z]|[a-z])+/.test(c)) || cells[1];
            }
            if (!number) {
                number = cells.find(c => /^\d{1,2}$/.test(c)) || '';
            }
            if (!classYear) {
                classYear = cells.find(c => {
                    const lower = c.toLowerCase();
                    return lower === 'fr' || lower === 'fr.' ||
                           lower === 'so' || lower === 'so.' ||
                           lower === 'jr' || lower === 'jr.' ||
                           lower === 'sr' || lower === 'sr.' ||
                           lower.includes('freshman') || lower.includes('sophomore') ||
                           lower.includes('junior') || lower.includes('senior') ||
                           lower.includes('graduate') || lower === 'grad' || lower === 'gr';
                }) || '';
            }
            if (!position) {
                // More flexible position detection
                position = cells.find(c => {
                    const lower = c.toLowerCase();
                    return lower.includes('fogo') || lower.includes('face') || lower === 'fo' || lower === 'f/o' || lower.includes('m/fo') || lower.includes('/fo') ||
                           lower.includes('lsm') || lower.includes('long stick') ||
                           lower.includes('ssdm') || lower.includes('short stick') ||
                           lower === 'a' || lower === 'att' || lower.includes('attack') ||
                           lower === 'm' || lower === 'mid' || lower.includes('midfield') ||
                           lower === 'd' || lower === 'def' || lower.includes('defense') ||
                           lower === 'g' || lower.includes('goal');
                }) || '';
            }

            // Only include if they have name, number, AND position (filters out coaches/staff)
            if (name && name.trim().length > 2 && number && position) {
                players.push({
                    name: name.trim(),
                    number: number.replace('#', '').trim(),
                    position: normalizePosition(position.trim()),
                    classYear: normalizeClassYear(classYear.trim()),
                    team: teamName
                });
            }
        }
    }

    // Strategy 2: If no table rows found, try div-based layouts
    if (players.length === 0) {
        const playerCardRegex = /<div[^>]*class="[^"]*(?:player-card|roster-player|athlete)[^"]*"[^>]*>(.*?)<\/div>/gis;
        const cardMatches = html.matchAll(playerCardRegex);

        for (const cardMatch of cardMatches) {
            const cardHtml = cardMatch[1];

            const nameMatch = cardHtml.match(/<(?:h\d|span|div)[^>]*class="[^"]*name[^"]*"[^>]*>(.*?)<\//i);
            const numberMatch = cardHtml.match(/<(?:span|div)[^>]*class="[^"]*(?:number|jersey)[^"]*"[^>]*>.*?(\d{1,2})/i);
            const positionMatch = cardHtml.match(/<(?:span|div)[^>]*class="[^"]*position[^"]*"[^>]*>(.*?)<\//i);
            const classYearMatch = cardHtml.match(/<(?:span|div)[^>]*class="[^"]*(?:year|class)[^"]*"[^>]*>(.*?)<\//i);

            // Only include if they have name, number, AND position (filters out coaches/staff)
            if (nameMatch && numberMatch && positionMatch) {
                players.push({
                    name: nameMatch[1].replace(/<[^>]+>/g, '').trim(),
                    number: numberMatch[1],
                    position: normalizePosition(positionMatch[1].replace(/<[^>]+>/g, '').trim()),
                    classYear: normalizeClassYear(classYearMatch ? classYearMatch[1].replace(/<[^>]+>/g, '').trim() : ''),
                    team: teamName
                });
            }
        }
    }

    return players;
}

function normalizePosition(position) {
    if (!position) return '';

    const pos = position.toLowerCase().trim();

    // Face-off specialists (many variations)
    if (pos.includes('fogo') || pos.includes('face') || pos === 'fo' || pos === 'f/o' || pos.includes('m/fo') || pos.includes('/fo')) return 'FOGO';

    // Long Stick Midfielder
    if (pos.includes('lsm') || pos.includes('long stick')) return 'LSM';

    // Short Stick Defensive Midfielder
    if (pos.includes('ssdm') || (pos.includes('short stick') && pos.includes('def'))) return 'SSDM';

    // Attack
    if (pos === 'a' || pos === 'att' || pos.includes('attack')) return 'Attack';

    // Midfielder
    if (pos === 'm' || pos === 'mid' || pos.includes('midfield')) return 'Midfielder';

    // Defense
    if (pos === 'd' || pos === 'def' || pos.includes('defense') || pos.includes('defender')) return 'Defense';

    // Goalie
    if (pos === 'g' || pos.includes('goal') || pos.includes('keeper')) return 'Goalie';

    // Return original with first letter capitalized if no match
    return position.charAt(0).toUpperCase() + position.slice(1).toLowerCase();
}

function normalizeClassYear(classYear) {
    if (!classYear) return '';

    const year = classYear.toLowerCase().trim();

    // Freshman variations
    if (year === 'fr' || year === 'fr.' || year.includes('freshman') || year.includes('fresh.')) return 'Freshman';

    // Sophomore variations
    if (year === 'so' || year === 'so.' || year.includes('sophomore') || year.includes('soph.')) return 'Sophomore';

    // Junior variations
    if (year === 'jr' || year === 'jr.' || year.includes('junior')) return 'Junior';

    // Senior variations
    if (year === 'sr' || year === 'sr.' || year.includes('senior')) return 'Senior';

    // Graduate variations
    if (year === 'gr' || year === 'gr.' || year === 'grad' || year.includes('graduate')) return 'Graduate';

    // Return original with first letter capitalized if no match
    return classYear.charAt(0).toUpperCase() + classYear.slice(1).toLowerCase();
}

function fetchURL(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;

        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };

        client.get(url, options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to fetch: ${res.statusCode}`));
                return;
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function scrapeRoster(url, teamName) {
    try {
        console.log(`${colors.blue}Fetching roster from: ${url}${colors.reset}`);

        const html = await fetchURL(url);

        console.log(`${colors.green}✓ Page fetched successfully${colors.reset}`);
        console.log(`${colors.yellow}Parsing player data...${colors.reset}\n`);

        const players = parseHTML(html, teamName);

        if (players.length === 0) {
            console.log(`${colors.red}⚠ No players found. The page structure may not be recognized.${colors.reset}`);
            console.log(`${colors.yellow}Try using the manual HTML parser tool instead.${colors.reset}`);
            return;
        }

        console.log(`${colors.green}✓ Found ${players.length} players${colors.reset}\n`);

        // Create output
        const output = {
            team: teamName,
            scrapedAt: new Date().toISOString(),
            playerCount: players.length,
            players: players
        };

        // Display JSON
        console.log(`${colors.bright}JSON Output:${colors.reset}`);
        console.log(JSON.stringify(output, null, 2));

        // Save to file
        const fs = require('fs');
        const filename = `roster-${teamName.toLowerCase().replace(/\s+/g, '-')}.json`;
        fs.writeFileSync(filename, JSON.stringify(output, null, 2));

        console.log(`\n${colors.green}✓ Saved to: ${filename}${colors.reset}`);

    } catch (error) {
        console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
        process.exit(1);
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log(`${colors.bright}Lacrosse Roster Scraper${colors.reset}\n`);
        console.log('Usage:');
        console.log('  node roster-scraper.js <url> <team-name>\n');
        console.log('Example:');
        console.log('  node roster-scraper.js "https://goprincetontigers.com/sports/mens-lacrosse/roster" "Princeton University"\n');
        process.exit(1);
    }

    const [url, ...teamParts] = args;
    const teamName = teamParts.join(' ');

    scrapeRoster(url, teamName);
}

module.exports = { scrapeRoster, parseHTML };
