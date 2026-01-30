#!/bin/bash

# Scrape all D1 Lacrosse Teams
# This script iterates through all D1 teams and scrapes their rosters
# Usage: chmod +x scrape-all-d1-teams.sh && ./scrape-all-d1-teams.sh

echo "🥍 D1 Lacrosse Roster Scraper - Batch Mode"
echo "=========================================="
echo ""

# Array of team URLs and names
# Format: "URL|Team Name"
teams=(
  # Ivy League
  "https://goprincetontigers.com/sports/mens-lacrosse/roster|Princeton University"
  "https://cornellbigred.com/sports/mens-lacrosse/roster|Cornell University"
  "https://yalebulldogs.com/sports/mens-lacrosse/roster|Yale University"
  "https://gocrimson.com/sports/mens-lacrosse/roster|Harvard University"
  "https://brownbears.com/sports/mens-lacrosse/roster|Brown University"
  "https://dartmouthsports.com/sports/mens-lacrosse/roster|Dartmouth College"
  "https://pennathletics.com/sports/mens-lacrosse/roster|University of Pennsylvania"
  "https://gocolumbialions.com/sports/mens-lacrosse/roster|Columbia University"

  # ACC
  "https://goduke.com/sports/mens-lacrosse/roster|Duke University"
  "https://goheels.com/sports/mens-lacrosse/roster|University of North Carolina at Chapel Hill"
  "https://virginiasports.com/sports/mens-lacrosse/roster|University of Virginia"
  "https://cuse.com/sports/mens-lacrosse/roster|Syracuse University"
  "https://und.com/sports/mens-lacrosse/roster|University of Notre Dame"

  # Big Ten
  "https://hopkinssports.com/sports/mens-lacrosse/roster|Johns Hopkins University"
  "https://umterps.com/sports/mens-lacrosse/roster|University of Maryland"
  "https://gopsusports.com/sports/mens-lacrosse/roster|Penn State"
  "https://ohiostatebuckeyes.com/sports/mens-lacrosse/roster|Ohio State University"
  "https://mgoblue.com/sports/mens-lacrosse/roster|University of Michigan"
  "https://scarletknights.com/sports/mens-lacrosse/roster|Rutgers University"

  # Patriot League
  "https://goleopards.com/sports/mens-lacrosse/roster|Lafayette College"
  "https://lehighsports.com/sports/mens-lacrosse/roster|Lehigh University"
  "https://goarmywestpoint.com/sports/mens-lacrosse/roster|United States Military Academy"
  "https://navysports.com/sports/mens-lacrosse/roster|United States Naval Academy"
  "https://gobison.com/sports/mens-lacrosse/roster|Bucknell University"
  "https://goholycross.com/sports/mens-lacrosse/roster|College of the Holy Cross"
  "https://bupanthers.com/sports/mens-lacrosse/roster|Boston University"
  "https://loyolagreyhounds.com/sports/mens-lacrosse/roster|Loyola University Maryland"
  "https://gogate.com/sports/mens-lacrosse/roster|Colgate University"

  # Add more teams as needed...
)

success_count=0
fail_count=0
total_players=0

# Create output directory
mkdir -p rosters
cd rosters

# Scrape each team
for team in "${teams[@]}"; do
  IFS='|' read -r url name <<< "$team"

  echo "📥 Scraping: $name"
  echo "   URL: $url"

  # Run the scraper
  if node ../roster-scraper.js "$url" "$name" 2>/dev/null; then
    echo "   ✅ Success"
    ((success_count++))

    # Count players in the JSON file
    filename="roster-${name,,}"
    filename="${filename// /-}.json"
    if [ -f "$filename" ]; then
      player_count=$(grep -o '"name"' "$filename" | wc -l)
      echo "   📊 Found $player_count players"
      ((total_players+=player_count))
    fi
  else
    echo "   ❌ Failed - check URL or page structure"
    ((fail_count++))
  fi

  echo ""

  # Be respectful - add delay between requests
  sleep 5
done

cd ..

echo "=========================================="
echo "📊 Summary"
echo "=========================================="
echo "Total teams attempted: ${#teams[@]}"
echo "✅ Successful: $success_count"
echo "❌ Failed: $fail_count"
echo "👥 Total players scraped: $total_players"
echo ""
echo "JSON files saved in: ./rosters/"
echo ""
echo "Next steps:"
echo "1. Review the JSON files in the rosters/ directory"
echo "2. Use import-to-fotracker.js to bulk import players"
echo "3. Manually fix any failed scrapes using roster-parser.html"
