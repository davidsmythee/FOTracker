# Face-Off Tracker 🥍

A visual analytics web application for tracking lacrosse face-off wins and losses during games.

## Features

### Core Functionality
- **Visual Field Interface**: Interactive lacrosse field with accurate proportions and markings
- **Pin Placement**: Click anywhere on the field to mark face-off locations
- **Win/Loss Tracking**: Toggle between Win (green) and Loss (red) modes
- **Game Management**: Create multiple games with opponent names, dates, and notes
- **Real-time Statistics**: Live win percentage, total face-offs, and performance metrics

### User Experience
- **Modern UI**: Beautiful dark theme with smooth animations
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Persistent Storage**: All data saved locally in browser (no login required)
- **Quick Actions**: Undo last pin, clear all pins, switch between games
- **Visual Feedback**: Latest pin highlighted, color-coded pins, hover effects

## How to Use

### Getting Started
1. Open `index.html` in a web browser
2. Click "**+ New Game**" to create your first game
3. Enter opponent name, game date, and optional notes
4. Start clicking on the field to place pins!

### Placing Pins
1. Select **Win** or **Loss** mode using the toggle buttons
2. Click anywhere on the lacrosse field to place a pin
3. Green pins = Face-off wins
4. Red pins = Face-off losses

### Managing Games
- **Switch Games**: Use the dropdown to select different games
- **Delete Game**: Remove the current game (with confirmation)
- **Undo**: Remove the most recently placed pin
- **Clear All**: Remove all pins from the current game

### Statistics Dashboard
The stats automatically update as you place pins:
- **Wins**: Total face-offs won
- **Losses**: Total face-offs lost
- **Win Rate**: Win percentage
- **Total Face-Offs**: Combined wins and losses

## Technical Details

### Technologies Used
- **HTML5**: Structure and canvas element
- **CSS3**: Modern styling with animations and gradients
- **Vanilla JavaScript**: No dependencies, pure JavaScript
- **LocalStorage API**: Data persistence without backend

### File Structure
```
FOTracker/
├── index.html      # Main HTML structure
├── styles.css      # All styling and responsive design
├── script.js       # Application logic and data management
└── README.md       # Documentation (this file)
```

### Browser Compatibility
- Chrome/Edge (recommended)
- Firefox
- Safari
- Any modern browser with HTML5 Canvas support

## Use Cases

### For Coaches
- Analyze face-off tendencies during games
- Identify hot and cold zones on the field
- Track performance against different opponents
- Make real-time adjustments during games

### For Players
- Review personal face-off statistics
- Identify patterns in wins/losses
- Study field positioning
- Track improvement over time

### For Analysts
- Visualize spatial data
- Calculate zone-based win percentages
- Compare performance across multiple games
- Export visual data for presentations

## Future Enhancement Ideas

- **Heat Maps**: Show concentration of wins/losses
- **Export Data**: Download as CSV or image
- **Player Tracking**: Assign pins to specific players
- **Game Clock**: Add timestamps to pins
- **Notes**: Add notes to individual pins
- **Opponent Analysis**: Track tendencies by opponent
- **Season Stats**: Aggregate statistics across games
- **Share Games**: Export/import game data

## Privacy & Data

All data is stored locally in your browser using LocalStorage. No data is sent to any server. Your game information stays on your device.

To backup your data:
- Export browser data
- Use browser sync features
- Manually save LocalStorage data

## Support

For issues, suggestions, or contributions, please contact the development team.

---

**Built with ❤️ for the lacrosse community**

