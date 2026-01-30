# Lacrosse Roster Scraper

Tools to extract player data (name, number, position) from lacrosse team roster pages.

## 🚀 Quick Start

### Option 1: Node.js Scraper (Recommended)

Automatically fetches and parses roster pages.

```bash
# Navigate to the scraper directory
cd scraper

# Run the scraper
node roster-scraper.js "https://goprincetontigers.com/sports/mens-lacrosse/roster" "Princeton University"
```

**Output:**
- Displays player data in the terminal
- Saves JSON file: `roster-princeton-university.json`

### Option 2: HTML Parser Tool

Manual method that works when automated scraping is blocked.

1. Open `roster-parser.html` in your browser
2. Go to the team's roster page
3. Right-click → "View Page Source" (or `Ctrl+U` / `Cmd+Option+U`)
4. Copy all the HTML
5. Paste into the parser tool
6. Get JSON output

## 📋 Usage Examples

### Scrape Princeton's Roster
```bash
node roster-scraper.js "https://goprincetontigers.com/sports/mens-lacrosse/roster" "Princeton University"
```

### Scrape Cornell's Roster
```bash
node roster-scraper.js "https://cornellbigred.com/sports/mens-lacrosse/roster" "Cornell University"
```

### Scrape Johns Hopkins' Roster
```bash
node roster-scraper.js "https://hopkinssports.com/sports/mens-lacrosse/roster" "Johns Hopkins University"
```

## 📦 JSON Output Format

```json
{
  "team": "Princeton University",
  "source": "https://goprincetontigers.com/sports/mens-lacrosse/roster",
  "scrapedAt": "2024-01-28T12:00:00.000Z",
  "players": [
    {
      "name": "John Smith",
      "number": "12",
      "position": "FOGO",
      "team": "Princeton University"
    },
    {
      "name": "Mike Johnson",
      "number": "24",
      "position": "Attack",
      "team": "Princeton University"
    }
  ]
}
```

## 🔧 Position Normalization

The scraper automatically normalizes position abbreviations:

| Input | Output |
|-------|--------|
| `A`, `Attack`, `Attacker` | `Attack` |
| `M`, `Midfield`, `Midfielder` | `Midfielder` |
| `D`, `Defense`, `Defender` | `Defense` |
| `G`, `Goalie`, `Goalkeeper` | `Goalie` |
| `LSM`, `Long Stick Midfielder` | `LSM` |
| `FOGO`, `Face-Off`, `Faceoff` | `FOGO` |

## 🎯 Importing Data into FOTracker

### Method 1: Automated Script (Future Enhancement)

Create a bulk import script:

```javascript
// Example: import-players.js
const fs = require('fs');

const rosterData = JSON.parse(fs.readFileSync('roster-princeton-university.json'));

rosterData.players.forEach(player => {
    // Add player to FOTracker via API or direct database insert
    console.log(`Adding player: ${player.name} #${player.number} (${player.position})`);
});
```

### Method 2: Manual Import

1. Run the scraper to get JSON output
2. Copy the player data
3. In FOTracker, use "Manage Players" to add each player
4. Or create a bulk import feature in FOTracker

## 🌐 Supported Roster Page Formats

The scraper works with:

✅ **Table-based layouts**
- Most common format
- Uses `<table>`, `<tr>`, `<td>` elements
- Example: goprincetontigers.com, cornellbigred.com

✅ **Card-based layouts**
- Modern responsive designs
- Uses `<div>` with class names like "player-card"
- Example: Some newer athletic department sites

✅ **Sidearm Sports platforms**
- Used by many NCAA programs
- Standard roster table format

## 🐛 Troubleshooting

### "No players found"

**Causes:**
- Page structure not recognized
- JavaScript-rendered content (React/Vue apps)
- Protected/login-required pages

**Solutions:**
1. Use the HTML Parser Tool (`roster-parser.html`)
2. Manually view page source and copy HTML
3. Check if the page requires authentication

### CORS Errors (Browser Only)

**Cause:** Browsers block cross-origin requests

**Solution:** Use the Node.js scraper instead of browser-based tools

### Rate Limiting

**Cause:** Too many requests too quickly

**Solution:** Add delays between scraping multiple teams

```bash
# Scrape with delays
node roster-scraper.js "url1" "Team 1"
sleep 5
node roster-scraper.js "url2" "Team 2"
sleep 5
node roster-scraper.js "url3" "Team 3"
```

## 📝 Batch Processing

Create a script to scrape all D1 teams:

```bash
#!/bin/bash
# scrape-all-teams.sh

teams=(
  "https://goprincetontigers.com/sports/mens-lacrosse/roster|Princeton University"
  "https://cornellbigred.com/sports/mens-lacrosse/roster|Cornell University"
  "https://yalebulldogs.com/sports/mens-lacrosse/roster|Yale University"
  # Add more teams...
)

for team in "${teams[@]}"; do
  IFS='|' read -r url name <<< "$team"
  echo "Scraping $name..."
  node roster-scraper.js "$url" "$name"
  sleep 5  # Be respectful, add delay
done

echo "All teams scraped!"
```

## ⚖️ Legal & Ethical Considerations

✅ **Appropriate Use:**
- Scraping publicly available roster data
- Personal/educational use
- Analytics and statistics

⚠️ **Be Respectful:**
- Don't overload servers (add delays)
- Respect robots.txt
- Check terms of service
- Consider rate limiting
- Don't resell scraped data

## 🔮 Future Enhancements

- [ ] Add support for more roster formats
- [ ] Batch processing with CSV input
- [ ] Integration with FOTracker database
- [ ] Automatic team color extraction
- [ ] Player photo URLs
- [ ] Year/class information
- [ ] Height/weight data
- [ ] Hometown information

## 📞 Support

If the scraper doesn't work for a specific roster page:

1. Try the manual HTML parser tool
2. Check the page source structure
3. Modify the parsing logic in `roster-scraper.js`
4. Open an issue with the failing URL

## 🎓 Example D1 Roster URLs

```
Princeton: https://goprincetontigers.com/sports/mens-lacrosse/roster
Cornell: https://cornellbigred.com/sports/mens-lacrosse/roster
Yale: https://yalebulldogs.com/sports/mens-lacrosse/roster
Duke: https://goduke.com/sports/mens-lacrosse/roster
Syracuse: https://cuse.com/sports/mens-lacrosse/roster
Johns Hopkins: https://hopkinssports.com/sports/mens-lacrosse/roster
Maryland: https://umterps.com/sports/mens-lacrosse/roster
Virginia: https://virginiasports.com/sports/mens-lacrosse/roster
Notre Dame: https://und.com/sports/mens-lacrosse/roster
Penn State: https://gopsusports.com/sports/mens-lacrosse/roster
```
