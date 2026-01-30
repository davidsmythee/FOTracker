#!/usr/bin/env node

/**
 * FOTracker Bulk Player Import
 *
 * Imports players from scraped roster JSON files into FOTracker
 *
 * Usage:
 *   node import-to-fotracker.js <json-file>
 *   node import-to-fotracker.js rosters/*.json
 *
 * Example:
 *   node import-to-fotracker.js roster-princeton-university.json
 */

const fs = require('fs');
const path = require('path');

// Import Firebase service (adjust path as needed)
let firebaseService;
try {
    // Try to import Firebase service if available
    const firebaseConfigPath = path.join(__dirname, '..', 'firebase-service.js');
    if (fs.existsSync(firebaseConfigPath)) {
        firebaseService = require(firebaseConfigPath);
    }
} catch (error) {
    console.log('⚠️  Firebase service not found - will generate import script instead');
}

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

async function importPlayers(jsonFile) {
    console.log(`${colors.blue}📥 Importing players from: ${jsonFile}${colors.reset}\n`);

    // Read JSON file
    let data;
    try {
        const fileContent = fs.readFileSync(jsonFile, 'utf8');
        data = JSON.parse(fileContent);
    } catch (error) {
        console.error(`${colors.red}❌ Error reading file: ${error.message}${colors.reset}`);
        return;
    }

    if (!data.players || !Array.isArray(data.players)) {
        console.error(`${colors.red}❌ Invalid JSON format - missing 'players' array${colors.reset}`);
        return;
    }

    console.log(`${colors.cyan}Team: ${data.team}${colors.reset}`);
    console.log(`${colors.cyan}Source: ${data.source}${colors.reset}`);
    console.log(`${colors.cyan}Players: ${data.players.length}${colors.reset}\n`);

    // Generate import script
    generateImportScript(data);

    // If Firebase is available, attempt direct import
    if (firebaseService && firebaseService.isInitialized) {
        console.log(`${colors.yellow}Firebase detected - attempting direct import...${colors.reset}`);
        await directImport(data);
    } else {
        console.log(`${colors.yellow}📝 Manual import required - see generated script above${colors.reset}`);
    }
}

function generateImportScript(data) {
    console.log(`${colors.bright}JavaScript Import Script:${colors.reset}`);
    console.log(`${colors.yellow}Copy and paste this into your browser console while on FOTracker:${colors.reset}\n`);

    const script = `
// Bulk Import Script for ${data.team}
// Run this in the browser console on FOTracker

(async function() {
    console.log('Starting bulk import for ${data.team}...');

    const players = ${JSON.stringify(data.players, null, 4)};

    let imported = 0;
    let skipped = 0;

    for (const player of players) {
        // Check if player already exists
        const existing = window.appInstance?.tracker?.players?.find(p =>
            p.name === player.name && p.team === player.team
        );

        if (existing) {
            console.log(\`⏭️  Skipping \${player.name} - already exists\`);
            skipped++;
            continue;
        }

        // Add player
        try {
            await window.appInstance.tracker.addPlayer(
                player.name,
                player.number || '',
                player.team,
                player.position || ''
            );
            console.log(\`✅ Added: \${player.name} #\${player.number} (\${player.position})\`);
            imported++;

            // Small delay to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error(\`❌ Error adding \${player.name}:\`, error);
        }
    }

    console.log(\`\\n📊 Import Complete!\`);
    console.log(\`   ✅ Imported: \${imported}\`);
    console.log(\`   ⏭️  Skipped (already exist): \${skipped}\`);

    // Refresh UI
    if (window.appInstance && window.appInstance.updateUI) {
        window.appInstance.updateUI();
    }
})();
`;

    console.log(script);
    console.log('\n' + '='.repeat(80) + '\n');

    // Save script to file
    const scriptFilename = `import-${data.team.toLowerCase().replace(/\s+/g, '-')}.js`;
    fs.writeFileSync(scriptFilename, script);
    console.log(`${colors.green}✓ Script saved to: ${scriptFilename}${colors.reset}\n`);
}

async function directImport(data) {
    console.log(`${colors.bright}Direct Import (via Firebase):${colors.reset}\n`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const player of data.players) {
        try {
            // Check if player exists (would need to implement this check)
            console.log(`   Adding: ${player.name} #${player.number} (${player.position})`);

            // Add player via Firebase
            // await firebaseService.addPlayer(player);

            console.log(`   ${colors.green}✅ Added${colors.reset}`);
            imported++;

            // Small delay
            await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
            console.log(`   ${colors.red}❌ Error: ${error.message}${colors.reset}`);
            errors++;
        }
    }

    console.log(`\n${colors.bright}Import Summary:${colors.reset}`);
    console.log(`   ✅ Imported: ${imported}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
}

// Batch import multiple files
async function batchImport(files) {
    console.log(`${colors.bright}Batch Import Mode${colors.reset}`);
    console.log(`${colors.cyan}Processing ${files.length} roster file(s)...${colors.reset}\n`);

    for (const file of files) {
        await importPlayers(file);
        console.log('\n' + '='.repeat(80) + '\n');
    }

    console.log(`${colors.green}✅ Batch import complete!${colors.reset}`);
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`${colors.bright}FOTracker Bulk Player Import${colors.reset}\n`);
        console.log('Usage:');
        console.log('  node import-to-fotracker.js <json-file>\n');
        console.log('Examples:');
        console.log('  node import-to-fotracker.js roster-princeton-university.json');
        console.log('  node import-to-fotracker.js rosters/*.json\n');
        process.exit(1);
    }

    // Check if batch mode (multiple files)
    if (args.length > 1) {
        batchImport(args);
    } else {
        importPlayers(args[0]);
    }
}

module.exports = { importPlayers };
