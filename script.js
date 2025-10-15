// ===== Import Firebase Service =====
import firebaseService from './firebase-service.js';

// ===== Data Model =====
class FaceOffTracker {
    constructor(useFirebase = true) {
        this.useFirebase = useFirebase;
        this.games = {};
        this.currentGameId = null;
        this.currentMode = 'win'; // 'win' or 'loss'
        this.currentPlayer = null; // Currently selected player
        this.players = [];
        this.SEASON_TOTAL_ID = 'season_total';
        this.isLoading = false;
        this.onDataChangeCallback = null;
    }

    async initialize() {
        if (this.useFirebase && firebaseService.getUserId()) {
            await this.loadFromFirebase();
            this.setupFirebaseListeners();
        } else {
            this.loadFromLocalStorage();
        }
        await this.ensureSeasonTotalExists();
        
        // Set current game to Season Total if none selected or invalid
        if (!this.currentGameId || !this.games[this.currentGameId]) {
            this.currentGameId = this.SEASON_TOTAL_ID;
            await this.saveCurrentGameId();
        }
    }

    async loadFromFirebase() {
        try {
            this.isLoading = true;
            const [games, players, currentGameId] = await Promise.all([
                firebaseService.getAllGames(),
                firebaseService.getAllPlayers(),
                firebaseService.getCurrentGameId()
            ]);
            
            this.games = games;
            this.players = players;
            this.currentGameId = currentGameId;
            this.isLoading = false;
        } catch (error) {
            console.error('Error loading from Firebase:', error);
            this.isLoading = false;
            // Fallback to localStorage
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        this.games = this.loadGames();
        this.currentGameId = this.loadCurrentGameId();
        this.players = this.loadPlayers();
    }

    setupFirebaseListeners() {
        // Listen to real-time updates
        firebaseService.listenToGames((games) => {
            this.games = games;
            // Just update local state, don't trigger any saves
            // Season Total is already correct in Firebase
            if (this.onDataChangeCallback) {
                this.onDataChangeCallback('games');
            }
        });

        firebaseService.listenToPlayers((players) => {
            this.players = players;
            if (this.onDataChangeCallback) {
                this.onDataChangeCallback('players');
            }
        });
    }

    onDataChange(callback) {
        this.onDataChangeCallback = callback;
    }

    loadPlayers() {
        const saved = localStorage.getItem('faceoff_players');
        return saved ? JSON.parse(saved) : [];
    }

    async savePlayers() {
        if (this.useFirebase && firebaseService.getUserId()) {
            // Save each player individually to Firebase
            for (const player of this.players) {
                await firebaseService.savePlayer(player.id, player);
            }
        } else {
            localStorage.setItem('faceoff_players', JSON.stringify(this.players));
        }
    }

    async addPlayer(name, number = '', team = '') {
        const player = {
            id: Date.now().toString(),
            name,
            number,
            team,
            createdAt: new Date().toISOString()
        };
        this.players.push(player);
        
        if (this.useFirebase && firebaseService.getUserId()) {
            await firebaseService.savePlayer(player.id, player);
        } else {
            this.savePlayers();
        }
        
        return player;
    }

    getTeams() {
        // Get unique teams from all players
        const teams = new Set();
        this.players.forEach(player => {
            if (player.team) {
                teams.add(player.team);
            }
        });
        return Array.from(teams).sort();
    }

    async deletePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
        if (this.currentPlayer === playerId) {
            this.currentPlayer = null;
        }
        
        if (this.useFirebase && firebaseService.getUserId()) {
            await firebaseService.deletePlayer(playerId);
        } else {
            this.savePlayers();
        }
    }

    async addPlayerToRoster(gameId, playerId) {
        const game = this.games[gameId];
        if (!game || game.id === this.SEASON_TOTAL_ID) return;
        
        // Initialize roster if it doesn't exist (for older games)
        if (!game.roster) {
            game.roster = [];
        }
        
        // Add player if not already in roster
        if (!game.roster.includes(playerId)) {
            game.roster.push(playerId);
            await this.saveGame(gameId);
        }
    }

    async removePlayerFromRoster(gameId, playerId) {
        const game = this.games[gameId];
        if (!game || game.id === this.SEASON_TOTAL_ID) return;
        
        if (game.roster) {
            // Remove player from roster
            game.roster = game.roster.filter(id => id !== playerId);
            
            // Remove all pins by this player from the game
            game.pins = game.pins.filter(pin => pin.playerId !== playerId);
            
            await this.saveGame(gameId);
            
            // Rebuild and save season total
            this.rebuildSeasonTotal();
            if (this.useFirebase && firebaseService.getUserId()) {
                await firebaseService.saveGame(this.SEASON_TOTAL_ID, this.games[this.SEASON_TOTAL_ID]);
            }
        }
    }

    getGameRoster(gameId) {
        const game = this.games[gameId];
        if (!game || game.id === this.SEASON_TOTAL_ID) return [];
        
        // Initialize roster if it doesn't exist
        if (!game.roster) {
            game.roster = [];
        }
        
        // Return player objects for roster IDs
        return game.roster
            .map(id => this.players.find(p => p.id === id))
            .filter(p => p); // Filter out any undefined (deleted players)
    }

    async ensureSeasonTotalExists() {
        if (!this.games[this.SEASON_TOTAL_ID]) {
            this.games[this.SEASON_TOTAL_ID] = {
                id: this.SEASON_TOTAL_ID,
                opponent: '🏆 Season Total',
                date: new Date().toISOString(),
                notes: 'All face-offs from every game',
                pins: [],
                isSeasonTotal: true,
                createdAt: new Date().toISOString()
            };
            
            // Rebuild Season Total from all games
            this.rebuildSeasonTotal();
            
            // Save the newly created Season Total
            await this.saveGame(this.SEASON_TOTAL_ID);
        } else {
            // Just rebuild Season Total in memory from existing games
            this.rebuildSeasonTotal();
        }
    }

    rebuildSeasonTotal() {
        // Collect all pins from all regular games
        const allPins = [];
        Object.keys(this.games).forEach(gameId => {
            if (gameId !== this.SEASON_TOTAL_ID) {
                const game = this.games[gameId];
                if (game && game.pins) {
                    allPins.push(...game.pins.map(pin => ({...pin})));
                }
            }
        });

        // Update Season Total with all pins (in memory only)
        if (this.games[this.SEASON_TOTAL_ID]) {
            this.games[this.SEASON_TOTAL_ID].pins = allPins;
        }
    }

    loadGames() {
        const saved = localStorage.getItem('faceoff_games');
        return saved ? JSON.parse(saved) : {};
    }

    async saveGames() {
        if (this.useFirebase && firebaseService.getUserId()) {
            // Firebase real-time listeners handle this automatically
            // No need to manually save all games
        } else {
            localStorage.setItem('faceoff_games', JSON.stringify(this.games));
        }
    }

    async saveGame(gameId) {
        const game = this.games[gameId];
        if (!game) return;
        
        if (this.useFirebase && firebaseService.getUserId()) {
            await firebaseService.saveGame(gameId, game);
        } else {
            this.saveGames();
        }
    }

    loadCurrentGameId() {
        return localStorage.getItem('faceoff_current_game');
    }

    async saveCurrentGameId() {
        if (this.useFirebase && firebaseService.getUserId()) {
            await firebaseService.saveCurrentGameId(this.currentGameId);
        } else {
            localStorage.setItem('faceoff_current_game', this.currentGameId);
        }
    }

    async createGame(opponent, date, notes = '') {
        const id = Date.now().toString();
        this.games[id] = {
            id,
            opponent,
            date,
            notes,
            pins: [],
            roster: [], // Array of player IDs in this game
            createdAt: new Date().toISOString()
        };
        this.currentGameId = id;
        
        if (this.useFirebase && firebaseService.getUserId()) {
            await firebaseService.saveGame(id, this.games[id]);
            await this.saveCurrentGameId();
        } else {
            this.saveGames();
            this.saveCurrentGameId();
        }
        
        return id;
    }

    async deleteGame(id) {
        // Don't allow deleting season total
        if (id === this.SEASON_TOTAL_ID) return;

        const game = this.games[id];
        if (game) {
            // Delete the game
            delete this.games[id];
            
            if (this.currentGameId === id) {
                const gameIds = Object.keys(this.games).filter(id => id !== this.SEASON_TOTAL_ID);
                this.currentGameId = gameIds.length > 0 ? gameIds[0] : this.SEASON_TOTAL_ID;
            }
            
            if (this.useFirebase && firebaseService.getUserId()) {
                await firebaseService.deleteGame(id);
                await this.saveCurrentGameId();
                
                // Rebuild and save season total
                this.rebuildSeasonTotal();
                await firebaseService.saveGame(this.SEASON_TOTAL_ID, this.games[this.SEASON_TOTAL_ID]);
            } else {
                this.saveGames();
                this.saveCurrentGameId();
            }
        }
    }

    getCurrentGame() {
        return this.currentGameId ? this.games[this.currentGameId] : null;
    }

    async addPin(x, y, type) {
        const game = this.getCurrentGame();
        if (game) {
            const newPin = { 
                x, 
                y, 
                type, 
                timestamp: Date.now(),
                playerId: this.currentPlayer // Add player info to pin
            };
            game.pins.push(newPin);
            
            // Save the game with the new pin
            await this.saveGame(game.id);
            
            // Rebuild and save season total if this is a regular game
            if (game.id !== this.SEASON_TOTAL_ID) {
                this.rebuildSeasonTotal();
                // Save Season Total to Firebase (but not through Firebase listener)
                if (this.useFirebase && firebaseService.getUserId()) {
                    await firebaseService.saveGame(this.SEASON_TOTAL_ID, this.games[this.SEASON_TOTAL_ID]);
                }
            }
        }
    }

    async removeLastPin() {
        const game = this.getCurrentGame();
        if (game && game.pins.length > 0) {
            game.pins.pop();
            
            await this.saveGame(game.id);
            
            // Rebuild and save season total if this is a regular game
            if (game.id !== this.SEASON_TOTAL_ID) {
                this.rebuildSeasonTotal();
                if (this.useFirebase && firebaseService.getUserId()) {
                    await firebaseService.saveGame(this.SEASON_TOTAL_ID, this.games[this.SEASON_TOTAL_ID]);
                }
            }
            
            return true;
        }
        return false;
    }

    async clearAllPins() {
        const game = this.getCurrentGame();
        if (game) {
            if (game.id === this.SEASON_TOTAL_ID) {
                // If clearing season total, clear all games
                for (const g of Object.values(this.games)) {
                    g.pins = [];
                    await this.saveGame(g.id);
                }
                // Rebuild season total (will be empty)
                this.rebuildSeasonTotal();
                if (this.useFirebase && firebaseService.getUserId()) {
                    await firebaseService.saveGame(this.SEASON_TOTAL_ID, this.games[this.SEASON_TOTAL_ID]);
                }
            } else {
                // Clear this game's pins
                game.pins = [];
                
                await this.saveGame(game.id);
                
                // Rebuild and save season total
                this.rebuildSeasonTotal();
                if (this.useFirebase && firebaseService.getUserId()) {
                    await firebaseService.saveGame(this.SEASON_TOTAL_ID, this.games[this.SEASON_TOTAL_ID]);
                }
            }
        }
    }

    getStats() {
        const game = this.getCurrentGame();
        if (!game) {
            return { wins: 0, losses: 0, total: 0, percentage: 0 };
        }

        const wins = game.pins.filter(p => p.type === 'win').length;
        const losses = game.pins.filter(p => p.type === 'loss').length;
        const total = wins + losses;
        const percentage = total > 0 ? Math.round((wins / total) * 100) : 0;

        return { wins, losses, total, percentage };
    }
}

// ===== Field Renderer =====
class FieldRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.pins = [];
        this.setupCanvas();
    }

    setupCanvas() {
        // Lacrosse field: 110 yards tall × 80 yards wide
        const FIELD_WIDTH_YARDS = 80;
        const FIELD_HEIGHT_YARDS = 110;
        const ASPECT_RATIO = FIELD_HEIGHT_YARDS / FIELD_WIDTH_YARDS;
        
        const containerWidth = this.canvas.parentElement.clientWidth - 60;
        // Ensure we have a valid width, default to 640 if container isn't ready
        const maxWidth = containerWidth > 100 ? Math.min(containerWidth, 700) : 640;
        
        this.canvas.width = maxWidth;
        this.canvas.height = maxWidth * ASPECT_RATIO;
        
        // Store actual dimensions for calculations
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        // Store yard-to-pixel conversion factor
        this.yardsToPixels = (this.width - 20) / FIELD_WIDTH_YARDS; // Accounting for margins
    }

    drawField() {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
      
        // Safety check - don't draw if canvas isn't properly sized
        if (!w || !h || w < 100 || h < 100) {
            return;
        }
      
        // --- basics
        ctx.clearRect(0, 0, w, h);
        
        // Draw green field background
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, '#2d5016');
        gradient.addColorStop(0.5, '#3a6b1e');
        gradient.addColorStop(1, '#2d5016');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        // Add subtle grass texture
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.lineWidth = 1;
        for (let i = 0; i < h; i += 3) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(w, i);
            ctx.stroke();
        }
        
        ctx.save();
      
        // proportions (tweak if you want tighter/looser spacing)
        const borderW = Math.max(6, Math.round(Math.min(w, h) * 0.012));   // outer border thickness
        const pad      = Math.max(6, Math.round(Math.min(w, h) * 0.02));   // outer padding used for interior shapes
        const restrain = Math.round(h * 0.27);                              // distance of restraining lines from each end
        const wingHalf = Math.round(h * 0.10);                              // half-height of wing lines
        const wingDx   = Math.round(w * 0.32);                              // horizontal offset of wing lines from center
        const boxSideInset = Math.round(w * 0.16);                          // left/right inset for top/bottom boxes
        const creaseR  = Math.max(6, Math.round(Math.min(w, h) * 0.035));   // goal crease radius
        const minusLen = Math.round(creaseR * 0.9);                         // length of the "–" inside crease
      
        // common styles - WHITE LINES
        ctx.strokeStyle = "#ffffff";
        ctx.fillStyle   = "#ffffff";
        ctx.lineCap     = "butt";
        ctx.lineJoin    = "miter";
        ctx.lineWidth   = borderW;
      
        const centerX = w / 2;
        const topY    = borderW / 2;
        const botY    = h - borderW / 2;
      
        // --- outer border
        ctx.strokeRect(borderW / 2, borderW / 2, w - borderW, h - borderW);
      
        // --- restraining lines (full width)
        const topRestrainingY    = topY + restrain;
        const bottomRestrainingY = botY - restrain;
      
        ctx.beginPath();
        ctx.moveTo(borderW / 2, topRestrainingY);
        ctx.lineTo(w - borderW / 2, topRestrainingY);
        ctx.moveTo(borderW / 2, bottomRestrainingY);
        ctx.lineTo(w - borderW / 2, bottomRestrainingY);
        ctx.stroke();
      
        // --- midfield line
        const midY = h / 2;
        ctx.beginPath();
        ctx.moveTo(borderW / 2, midY);
        ctx.lineTo(w - borderW / 2, midY);
        ctx.stroke();
      
        // --- center "X"
        const xSize = Math.round(Math.min(w, h) * 0.025);
        ctx.beginPath();
        ctx.moveTo(centerX - xSize, midY - xSize);
        ctx.lineTo(centerX + xSize, midY + xSize);
        ctx.moveTo(centerX + xSize, midY - xSize);
        ctx.lineTo(centerX - xSize, midY + xSize);
        ctx.lineWidth = Math.max(2, Math.round(borderW * 0.5));
        ctx.stroke();
      
        // --- wing lines (short verticals centered on the midfield line)
        ctx.beginPath();
        // left
        ctx.moveTo(centerX - wingDx, midY - wingHalf);
        ctx.lineTo(centerX - wingDx, midY + wingHalf);
        // right
        ctx.moveTo(centerX + wingDx, midY - wingHalf);
        ctx.lineTo(centerX + wingDx, midY + wingHalf);
        ctx.lineWidth = borderW; // match image thickness
        ctx.stroke();
      
        // --- top & bottom large boxes (span between end line and restraining line
        //     with left/right insets)
        ctx.lineWidth = borderW;
        // top box
        ctx.strokeRect(
          boxSideInset,
          topY + borderW / 2,
          w - 2 * boxSideInset,
          topRestrainingY - (topY + borderW / 2)
        );
        // bottom box
        ctx.strokeRect(
          boxSideInset,
          bottomRestrainingY,
          w - 2 * boxSideInset,
          (botY - borderW / 2) - bottomRestrainingY
        );
      
        // --- goal creases with "–" inside (top & bottom centers)
        ctx.lineWidth = borderW;
        // top crease
        const topCreaseY = Math.round(topY + restrain * 0.45);
        ctx.beginPath();
        ctx.arc(centerX, topCreaseY, creaseR, 0, Math.PI * 2);
        ctx.stroke();
        // minus sign
        ctx.beginPath();
        ctx.moveTo(centerX - minusLen / 2, topCreaseY);
        ctx.lineTo(centerX + minusLen / 2, topCreaseY);
        ctx.stroke();
      
        // bottom crease
        const botCreaseY = Math.round(botY - restrain * 0.45);
        ctx.beginPath();
        ctx.arc(centerX, botCreaseY, creaseR, 0, Math.PI * 2);
        ctx.stroke();
        // minus sign
        ctx.beginPath();
        ctx.moveTo(centerX - minusLen / 2, botCreaseY);
        ctx.lineTo(centerX + minusLen / 2, botCreaseY);
        ctx.stroke();
      
        ctx.restore();
      }
      

    drawPins(pins) {
        this.pins = pins;
        
        pins.forEach((pin, index) => {
            this.drawPin(pin.x, pin.y, pin.type, index === pins.length - 1);
        });
    }

    drawPin(x, y, type, isLatest = false) {
        const ctx = this.ctx;
        const radius = 8;

        // Pin shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // Pin color
        ctx.fillStyle = type === 'win' ? '#10b981' : '#ef4444';
        
        // Draw pin
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        // White border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Highlight latest pin
        if (isLatest) {
            ctx.strokeStyle = type === 'win' ? '#10b981' : '#ef4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    render(pins) {
        this.drawField();
        this.drawPins(pins);
    }

    renderHeatmap(pins) {
        this.drawField();
        
        if (pins.length === 0) return;

        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        // Create heat map grid
        const gridSize = 30; // Size of each heat map cell
        const cols = Math.ceil(w / gridSize);
        const rows = Math.ceil(h / gridSize);
        const winGrid = Array(rows).fill().map(() => Array(cols).fill(0));
        const lossGrid = Array(rows).fill().map(() => Array(cols).fill(0));

        // Count pins in each grid cell
        pins.forEach(pin => {
            const col = Math.floor(pin.x / gridSize);
            const row = Math.floor(pin.y / gridSize);
            
            if (row >= 0 && row < rows && col >= 0 && col < cols) {
                if (pin.type === 'win') {
                    winGrid[row][col]++;
                } else {
                    lossGrid[row][col]++;
                }
            }
        });

        // Find max values for normalization
        let maxWins = 0;
        let maxLosses = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                maxWins = Math.max(maxWins, winGrid[r][c]);
                maxLosses = Math.max(maxLosses, lossGrid[r][c]);
            }
        }

        // Draw heat map
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = c * gridSize;
                const y = r * gridSize;
                const wins = winGrid[r][c];
                const losses = lossGrid[r][c];
                
                if (wins > 0 || losses > 0) {
                    let color, alpha;
                    
                    if (wins > losses) {
                        // More wins - green
                        alpha = Math.min(0.7, (wins / maxWins) * 0.7);
                        color = `rgba(16, 185, 129, ${alpha})`;
                    } else if (losses > wins) {
                        // More losses - red
                        alpha = Math.min(0.7, (losses / maxLosses) * 0.7);
                        color = `rgba(239, 68, 68, ${alpha})`;
                    } else {
                        // Equal - yellow
                        alpha = 0.5;
                        color = `rgba(245, 158, 11, ${alpha})`;
                    }
                    
                    ctx.fillStyle = color;
                    ctx.fillRect(x, y, gridSize, gridSize);
                    
                    // Draw count in cell if significant
                    const total = wins + losses;
                    if (total >= 3) {
                        ctx.fillStyle = 'white';
                        ctx.font = 'bold 12px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(total, x + gridSize / 2, y + gridSize / 2);
                    }
                }
            }
        }

        // Draw legend on the field
        this.drawHeatmapLegend();
    }

    drawHeatmapLegend() {
        const ctx = this.ctx;
        const legendX = 20;
        const legendY = this.height - 80;
        
        // Background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(legendX, legendY, 200, 60);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(legendX, legendY, 200, 60);
        
        // Title
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Heat Map Legend:', legendX + 10, legendY + 15);
        
        // Color samples
        const sampleY = legendY + 35;
        const sampleSize = 15;
        
        // Green (wins)
        ctx.fillStyle = 'rgba(16, 185, 129, 0.7)';
        ctx.fillRect(legendX + 10, sampleY, sampleSize, sampleSize);
        ctx.fillStyle = 'white';
        ctx.font = '11px sans-serif';
        ctx.fillText('Win Zone', legendX + 30, sampleY + 11);
        
        // Red (losses)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
        ctx.fillRect(legendX + 100, sampleY, sampleSize, sampleSize);
        ctx.fillStyle = 'white';
        ctx.fillText('Loss Zone', legendX + 120, sampleY + 11);
    }

    getClickCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        };
    }
}

// ===== UI Controller =====
class UIController {
    constructor() {
        this.tracker = new FaceOffTracker();
        this.fieldRenderer = new FieldRenderer(document.getElementById('lacrosse-field'));
        this.displayType = 'pins'; // 'pins' or 'heatmap'
        this.currentViewMode = 'team'; // 'team' or player ID
        this.initializeElements();
        this.attachEventListeners();
        this.updateUI();
        
        // Force initial render with multiple attempts to ensure canvas is ready
        requestAnimationFrame(() => {
            this.fieldRenderer.setupCanvas();
            this.render();
            
            // Double-check render after layout is complete
            setTimeout(() => {
                this.fieldRenderer.setupCanvas();
                this.render();
            }, 50);
        });
        
        // Redraw on window resize
        window.addEventListener('resize', () => {
            this.fieldRenderer.setupCanvas();
            this.render();
        });
    }

    initializeElements() {
        this.elements = {
            sidebar: document.getElementById('sidebar'),
            toggleSidebar: document.getElementById('toggle-sidebar'),
            gamesList: document.getElementById('games-list'),
            newGameBtn: document.getElementById('new-game-btn'),
            deleteGameBtn: document.getElementById('delete-game-btn'),
            currentOpponent: document.getElementById('current-opponent'),
            currentDate: document.getElementById('current-date'),
            modeWin: document.getElementById('mode-win'),
            modeLoss: document.getElementById('mode-loss'),
            viewPins: document.getElementById('view-pins'),
            viewHeatmap: document.getElementById('view-heatmap'),
            playerSelect: document.getElementById('player-select'),
            addToRosterBtn: document.getElementById('add-to-roster-btn'),
            rosterList: document.getElementById('roster-list'),
            viewTeamBtn: document.getElementById('view-team'),
            playerViewList: document.getElementById('player-view-list'),
            undoBtn: document.getElementById('undo-btn'),
            clearBtn: document.getElementById('clear-btn'),
            canvas: document.getElementById('lacrosse-field'),
            modal: document.getElementById('new-game-modal'),
            newGameForm: document.getElementById('new-game-form'),
            cancelModal: document.getElementById('cancel-modal'),
            rosterModal: document.getElementById('add-to-roster-modal'),
            availablePlayersList: document.getElementById('available-players-list'),
            createNewPlayerBtn: document.getElementById('create-new-player-btn'),
            cancelRosterModal: document.getElementById('cancel-roster-modal'),
            playerModal: document.getElementById('add-player-modal'),
            addPlayerForm: document.getElementById('add-player-form'),
            cancelPlayerModal: document.getElementById('cancel-player-modal'),
            managePlayersModal: document.getElementById('manage-players-modal'),
            closeManagePlayers: document.getElementById('close-manage-players'),
            playersList: document.getElementById('players-list'),
            statWins: document.getElementById('stat-wins'),
            statLosses: document.getElementById('stat-losses'),
            statPercentage: document.getElementById('stat-percentage'),
            statTotal: document.getElementById('stat-total'),
            viewIndicator: document.getElementById('view-indicator'),
            seasonGames: document.getElementById('season-games'),
            seasonWins: document.getElementById('season-wins'),
            seasonLosses: document.getElementById('season-losses'),
            seasonPercentage: document.getElementById('season-percentage')
        };
    }

    attachEventListeners() {
        // Sidebar toggle
        this.elements.toggleSidebar.addEventListener('click', () => {
            this.elements.sidebar.classList.toggle('collapsed');
        });

        // New game button
        this.elements.newGameBtn.addEventListener('click', () => {
            this.showNewGameModal();
        });

        // Delete game button
        this.elements.deleteGameBtn.addEventListener('click', async () => {
            if (this.tracker.currentGameId && confirm('Are you sure you want to delete this game?')) {
                await this.tracker.deleteGame(this.tracker.currentGameId);
                this.updateUI();
            }
        });

        // Mode buttons
        this.elements.modeWin.addEventListener('click', () => {
            this.setMode('win');
        });

        this.elements.modeLoss.addEventListener('click', () => {
            this.setMode('loss');
        });

        // Display type buttons (pins vs heatmap)
        this.elements.viewPins.addEventListener('click', () => {
            this.setDisplayType('pins');
        });

        this.elements.viewHeatmap.addEventListener('click', () => {
            this.setDisplayType('heatmap');
        });

        // Player selection for face-off
        this.elements.playerSelect.addEventListener('change', (e) => {
            this.tracker.currentPlayer = e.target.value || null;
        });

        // Add player to roster button
        this.elements.addToRosterBtn.addEventListener('click', () => {
            this.showAddToRosterModal();
        });

        // Create new player from roster modal
        this.elements.createNewPlayerBtn.addEventListener('click', () => {
            this.hideAddToRosterModal();
            this.showAddPlayerModal();
        });

        // Team view button
        this.elements.viewTeamBtn.addEventListener('click', () => {
            this.setViewMode('team');
        });

        // Roster and player modals
        this.elements.cancelRosterModal.addEventListener('click', () => {
            this.hideAddToRosterModal();
        });

        // Undo button
        this.elements.undoBtn.addEventListener('click', async () => {
            if (await this.tracker.removeLastPin()) {
                this.render();
                this.updateStats();
            }
        });

        // Clear button
        this.elements.clearBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all pins?')) {
                await this.tracker.clearAllPins();
                this.render();
                this.updateStats();
            }
        });

        // Canvas click
        this.elements.canvas.addEventListener('click', (e) => {
            this.handleCanvasClick(e);
        });

        // Modal
        this.elements.cancelModal.addEventListener('click', () => {
            this.hideNewGameModal();
        });

        this.elements.newGameForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createNewGame();
        });

        // Close modal on outside click
        this.elements.modal.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) {
                this.hideNewGameModal();
            }
        });

        // Player modal
        this.elements.cancelPlayerModal.addEventListener('click', () => {
            this.hideAddPlayerModal();
        });

        this.elements.addPlayerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addNewPlayer();
        });

        // Close player modal on outside click
        this.elements.playerModal.addEventListener('click', (e) => {
            if (e.target === this.elements.playerModal) {
                this.hideAddPlayerModal();
            }
        });

        // Manage players modal
        this.elements.closeManagePlayers.addEventListener('click', () => {
            this.hideManagePlayersModal();
        });

        this.elements.managePlayersModal.addEventListener('click', (e) => {
            if (e.target === this.elements.managePlayersModal) {
                this.hideManagePlayersModal();
            }
        });
    }

    setMode(mode) {
        this.tracker.currentMode = mode;
        
        // Update button states
        this.elements.modeWin.classList.toggle('active', mode === 'win');
        this.elements.modeLoss.classList.toggle('active', mode === 'loss');
    }

    setDisplayType(type) {
        this.displayType = type;
        
        // Update button states
        this.elements.viewPins.classList.toggle('active', type === 'pins');
        this.elements.viewHeatmap.classList.toggle('active', type === 'heatmap');
        
        // Re-render with new display type
        this.render();
    }

    setViewMode(mode) {
        // mode is either 'team' or a player ID
        this.currentViewMode = mode;
        
        // Update view mode buttons
        this.elements.viewTeamBtn.classList.toggle('active', mode === 'team');
        
        // Update player view buttons (will be created dynamically)
        document.querySelectorAll('.player-view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.playerId === mode);
        });
        
        // Update stats and re-render
        this.updateStats();
        this.render();
    }

    async handleCanvasClick(event) {
        if (!this.tracker.currentGameId) {
            alert('Please create a game first!');
            return;
        }

        // Don't allow pins on Season Total
        const currentGame = this.tracker.getCurrentGame();
        if (currentGame && currentGame.id === this.tracker.SEASON_TOTAL_ID) {
            alert('Cannot place pins on Season Total view. Please select a specific game.');
            return;
        }

        // Enforce player selection
        if (!this.tracker.currentPlayer) {
            alert('Please select a player from the roster before placing a face-off pin.\n\nIf the roster is empty, click "Add Player to Game" first.');
            return;
        }

        const coords = this.fieldRenderer.getClickCoordinates(event);
        await this.tracker.addPin(coords.x, coords.y, this.tracker.currentMode);
        this.render();
        this.updateStats();
    }

    showNewGameModal() {
        // Set default date to today
        document.getElementById('game-date').valueAsDate = new Date();
        this.elements.modal.classList.add('show');
    }

    hideNewGameModal() {
        this.elements.modal.classList.remove('show');
        this.elements.newGameForm.reset();
    }

    async createNewGame() {
        const opponent = document.getElementById('opponent-name').value;
        const date = document.getElementById('game-date').value;
        const notes = document.getElementById('game-notes').value;

        await this.tracker.createGame(opponent, date, notes);
        this.hideNewGameModal();
        this.updateUI();
    }

    showAddToRosterModal() {
        const currentGame = this.tracker.getCurrentGame();
        if (!currentGame || currentGame.id === this.tracker.SEASON_TOTAL_ID) {
            alert('Please select a specific game first.');
            return;
        }
        
        this.updateAvailablePlayersList();
        this.elements.rosterModal.classList.add('show');
    }

    hideAddToRosterModal() {
        this.elements.rosterModal.classList.remove('show');
    }

    updateAvailablePlayersList() {
        const container = this.elements.availablePlayersList;
        const currentGame = this.tracker.getCurrentGame();
        
        if (!currentGame) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No game selected</p>';
            return;
        }

        const roster = currentGame.roster || [];
        const availablePlayers = this.tracker.players.filter(p => !roster.includes(p.id));

        if (availablePlayers.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">All players are already in the roster.<br>Create a new player to add more.</p>';
            return;
        }

        container.innerHTML = '';
        availablePlayers.forEach(player => {
            const item = document.createElement('div');
            item.className = 'available-player-item';
            
            const displayName = player.number ? `#${player.number} ${player.name}` : player.name;
            
            item.innerHTML = `
                <div class="available-player-info">
                    <div class="available-player-name">${displayName}</div>
                    <div class="available-player-team">${player.team}</div>
                </div>
                <button class="btn-add-to-roster" data-player-id="${player.id}">Add to Game</button>
            `;
            
            const addBtn = item.querySelector('.btn-add-to-roster');
            addBtn.addEventListener('click', async () => {
                await this.tracker.addPlayerToRoster(currentGame.id, player.id);
                this.updateRosterList();
                this.updatePlayerSelect();
                this.updatePlayerViewList();
                this.updateAvailablePlayersList();
            });
            
            container.appendChild(item);
        });
    }

    showAddPlayerModal() {
        this.updateTeamsList();
        this.updatePlayersDatalist();
        this.setupPlayerNameAutofill();
        this.elements.playerModal.classList.add('show');
    }

    updateTeamsList() {
        const datalist = document.getElementById('teams-list');
        datalist.innerHTML = '';
        
        const teams = this.tracker.getTeams();
        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team;
            datalist.appendChild(option);
        });
    }

    updatePlayersDatalist() {
        const datalist = document.getElementById('players-datalist');
        datalist.innerHTML = '';
        
        this.tracker.players.forEach(player => {
            const option = document.createElement('option');
            const displayText = player.number 
                ? `#${player.number} ${player.name}` 
                : player.name;
            option.value = player.name;
            option.setAttribute('data-player-id', player.id);
            option.setAttribute('data-number', player.number || '');
            option.setAttribute('data-team', player.team || '');
            option.textContent = `${displayText} (${player.team})`;
            datalist.appendChild(option);
        });
    }

    setupPlayerNameAutofill() {
        const nameInput = document.getElementById('player-name');
        const numberInput = document.getElementById('player-number');
        const teamInput = document.getElementById('player-team');
        
        // Remove old listener if exists
        if (this.playerNameChangeHandler) {
            nameInput.removeEventListener('input', this.playerNameChangeHandler);
        }
        
        // Create new listener
        this.playerNameChangeHandler = () => {
            const enteredName = nameInput.value.trim();
            
            // Find matching player
            const matchingPlayer = this.tracker.players.find(p => 
                p.name.toLowerCase() === enteredName.toLowerCase()
            );
            
            if (matchingPlayer) {
                // Auto-fill number and team
                numberInput.value = matchingPlayer.number || '';
                teamInput.value = matchingPlayer.team || '';
            }
        };
        
        nameInput.addEventListener('input', this.playerNameChangeHandler);
    }

    hideAddPlayerModal() {
        this.elements.playerModal.classList.remove('show');
        this.elements.addPlayerForm.reset();
    }

    async addNewPlayer() {
        const name = document.getElementById('player-name').value;
        const number = document.getElementById('player-number').value;
        const team = document.getElementById('player-team').value;

        const player = await this.tracker.addPlayer(name, number, team);
        
        // Add to current game's roster if applicable
        const currentGame = this.tracker.getCurrentGame();
        if (currentGame && currentGame.id !== this.tracker.SEASON_TOTAL_ID) {
            await this.tracker.addPlayerToRoster(currentGame.id, player.id);
        }
        
        this.tracker.currentPlayer = player.id; // Auto-select the new player
        this.hideAddPlayerModal();
        this.updateRosterList();
        this.updatePlayerSelect();
        this.updatePlayerViewList();
        this.updateAvailablePlayersList();
    }

    showManagePlayersModal() {
        this.updatePlayersList();
        this.elements.managePlayersModal.classList.add('show');
    }

    hideManagePlayersModal() {
        this.elements.managePlayersModal.classList.remove('show');
    }

    updatePlayersList() {
        const container = this.elements.playersList;
        
        if (this.tracker.players.length === 0) {
            container.innerHTML = '<p class="no-players-message">No players added yet.</p>';
            return;
        }

        // Group players by team
        const playersByTeam = {};
        this.tracker.players.forEach(player => {
            const team = player.team || 'No Team';
            if (!playersByTeam[team]) {
                playersByTeam[team] = [];
            }
            playersByTeam[team].push(player);
        });

        container.innerHTML = '';

        // Add players grouped by team
        Object.keys(playersByTeam).sort().forEach(team => {
            const teamHeader = document.createElement('h3');
            teamHeader.style.marginTop = '20px';
            teamHeader.style.marginBottom = '10px';
            teamHeader.style.color = 'var(--primary-color)';
            teamHeader.textContent = team;
            container.appendChild(teamHeader);

            playersByTeam[team].forEach(player => {
                const playerItem = this.createPlayerItem(player);
                container.appendChild(playerItem);
            });
        });
    }

    createPlayerItem(player) {
        const item = document.createElement('div');
        item.className = 'player-item';

        // Calculate player stats
        const playerPins = this.getAllPinsForPlayer(player.id);
        const wins = playerPins.filter(p => p.type === 'win').length;
        const losses = playerPins.filter(p => p.type === 'loss').length;
        const total = wins + losses;
        const percentage = total > 0 ? Math.round((wins / total) * 100) : 0;

        const displayName = player.number 
            ? `#${player.number} ${player.name}` 
            : player.name;

        item.innerHTML = `
            <div class="player-info">
                <div class="player-name">${displayName}</div>
                <div class="player-details">${player.team}</div>
            </div>
            <div class="player-stats">
                <div class="player-stat">
                    <div class="player-stat-value">${wins}</div>
                    <div class="player-stat-label">Wins</div>
                </div>
                <div class="player-stat">
                    <div class="player-stat-value">${losses}</div>
                    <div class="player-stat-label">Losses</div>
                </div>
                <div class="player-stat">
                    <div class="player-stat-value">${percentage}%</div>
                    <div class="player-stat-label">Win Rate</div>
                </div>
            </div>
            <button class="btn-delete-player" data-player-id="${player.id}">Delete</button>
        `;

        // Add delete button handler
        const deleteBtn = item.querySelector('.btn-delete-player');
        deleteBtn.addEventListener('click', () => {
            this.deletePlayer(player.id);
        });

        return item;
    }

    getAllPinsForPlayer(playerId) {
        // Get all pins for this player across all games
        const allPins = [];
        Object.values(this.tracker.games).forEach(game => {
            if (game.id !== this.tracker.SEASON_TOTAL_ID) {
                const playerPins = game.pins.filter(pin => pin.playerId === playerId);
                allPins.push(...playerPins);
            }
        });
        return allPins;
    }

    async deletePlayer(playerId) {
        const player = this.tracker.players.find(p => p.id === playerId);
        if (!player) return;

        const displayName = player.number 
            ? `#${player.number} ${player.name}` 
            : player.name;

        if (confirm(`Are you sure you want to delete ${displayName}?\n\nThis will NOT delete their face-off data, but you won't be able to assign new face-offs to this player.`)) {
            await this.tracker.deletePlayer(playerId);
            this.updatePlayersList();
            this.updateRosterList();
            this.updatePlayerSelect();
            this.updatePlayerViewList();
        }
    }

    updatePlayerSelect() {
        const select = this.elements.playerSelect;
        select.innerHTML = '<option value="">Select Player</option>';

        // Get current game roster
        const currentGame = this.tracker.getCurrentGame();
        if (!currentGame || currentGame.id === this.tracker.SEASON_TOTAL_ID) {
            return; // Don't show any players for Season Total or if no game
        }

        const rosterPlayers = this.tracker.getGameRoster(currentGame.id);

        if (rosterPlayers.length === 0) {
            return; // No players in roster yet
        }

        // Group players by team
        const playersByTeam = {};
        rosterPlayers.forEach(player => {
            const team = player.team || 'No Team';
            if (!playersByTeam[team]) {
                playersByTeam[team] = [];
            }
            playersByTeam[team].push(player);
        });

        // Add players grouped by team
        Object.keys(playersByTeam).sort().forEach(team => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = team;
            
            playersByTeam[team].forEach(player => {
                const option = document.createElement('option');
                option.value = player.id;
                const displayText = player.number 
                    ? `#${player.number} ${player.name}` 
                    : player.name;
                option.textContent = displayText;
                
                if (player.id === this.tracker.currentPlayer) {
                    option.selected = true;
                }
                
                optgroup.appendChild(option);
            });
            
            select.appendChild(optgroup);
        });
    }

    updateRosterList() {
        const container = this.elements.rosterList;
        const currentGame = this.tracker.getCurrentGame();

        if (!currentGame || currentGame.id === this.tracker.SEASON_TOTAL_ID) {
            container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 10px;">Select a game to manage roster</p>';
            return;
        }

        const rosterPlayers = this.tracker.getGameRoster(currentGame.id);

        if (rosterPlayers.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 10px;">No players in roster yet</p>';
            return;
        }

        container.innerHTML = '';
        rosterPlayers.forEach(player => {
            const item = document.createElement('div');
            item.className = 'roster-item';
            
            const displayName = player.number ? `#${player.number} ${player.name}` : player.name;
            
            item.innerHTML = `
                <div class="roster-item-name">${displayName}</div>
                <button class="roster-item-remove" data-player-id="${player.id}">Remove</button>
            `;
            
            const removeBtn = item.querySelector('.roster-item-remove');
            removeBtn.addEventListener('click', async () => {
                const pinCount = currentGame.pins.filter(p => p.playerId === player.id).length;
                const confirmMsg = pinCount > 0 
                    ? `Remove ${displayName} from this game's roster?\n\nThis will also delete ${pinCount} face-off data point(s) attributed to this player.`
                    : `Remove ${displayName} from this game's roster?`;
                
                if (confirm(confirmMsg)) {
                    await this.tracker.removePlayerFromRoster(currentGame.id, player.id);
                    
                    // Reset view to team if we're viewing the removed player
                    if (this.currentViewMode === player.id) {
                        this.setViewMode('team');
                    }
                    
                    // Reset current player if it was the removed player
                    if (this.tracker.currentPlayer === player.id) {
                        this.tracker.currentPlayer = null;
                    }
                    
                    this.updateRosterList();
                    this.updatePlayerSelect();
                    this.updatePlayerViewList();
                    this.updateAvailablePlayersList();
                    this.updateStats();
                    this.updateSeasonStats();
                    this.render();
                }
            });
            
            container.appendChild(item);
        });
    }

    updatePlayerViewList() {
        const container = this.elements.playerViewList;
        const currentGame = this.tracker.getCurrentGame();

        if (!currentGame) {
            container.innerHTML = '';
            return;
        }

        const rosterPlayers = this.tracker.getGameRoster(currentGame.id);

        if (rosterPlayers.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = '';
        rosterPlayers.forEach(player => {
            const btn = document.createElement('button');
            btn.className = 'player-view-btn';
            btn.dataset.playerId = player.id;
            
            const displayName = player.number ? `#${player.number} ${player.name}` : player.name;
            btn.textContent = displayName;
            
            if (this.currentViewMode === player.id) {
                btn.classList.add('active');
            }
            
            btn.addEventListener('click', () => {
                this.setViewMode(player.id);
            });
            
            container.appendChild(btn);
        });
    }

    updateGamesList() {
        const gamesList = this.elements.gamesList;
        gamesList.innerHTML = '';

        const gameIds = Object.keys(this.tracker.games);
        
        // Always show Season Total first
        if (this.tracker.games[this.tracker.SEASON_TOTAL_ID]) {
            const seasonTotalCard = this.createGameCard(
                this.tracker.games[this.tracker.SEASON_TOTAL_ID],
                this.tracker.currentGameId === this.tracker.SEASON_TOTAL_ID
            );
            gamesList.appendChild(seasonTotalCard);
        }
        
        // Check if there are any regular games (non-season total)
        const regularGameIds = gameIds.filter(id => id !== this.tracker.SEASON_TOTAL_ID);
        
        if (regularGameIds.length === 0) {
            // Show message below Season Total
            const noGamesMsg = document.createElement('div');
            noGamesMsg.className = 'no-games-message';
            noGamesMsg.style.marginTop = '20px';
            noGamesMsg.innerHTML = `
                <p>No games yet</p>
                <p class="hint">Create your first game to get started!</p>
            `;
            gamesList.appendChild(noGamesMsg);
            
            this.elements.deleteGameBtn.style.display = 'none';
            if (this.tracker.currentGameId !== this.tracker.SEASON_TOTAL_ID) {
                this.elements.currentOpponent.textContent = 'Select a game';
                this.elements.currentDate.textContent = '';
            }
            return;
        }

        // Add divider
        const divider = document.createElement('div');
        divider.className = 'games-list-divider';
        gamesList.appendChild(divider);

        // Show/hide delete button based on whether season total is selected
        this.elements.deleteGameBtn.style.display = 
            this.tracker.currentGameId === this.tracker.SEASON_TOTAL_ID ? 'none' : 'block';

        // Sort regular games by date (newest first)
        regularGameIds.sort((a, b) => {
            return new Date(this.tracker.games[b].date) - new Date(this.tracker.games[a].date);
        });

        regularGameIds.forEach(id => {
            const game = this.tracker.games[id];
            const gameCard = this.createGameCard(game, id === this.tracker.currentGameId);
            gamesList.appendChild(gameCard);
        });
    }

    createGameCard(game, isActive) {
        const card = document.createElement('div');
        card.className = 'game-card' + (isActive ? ' active' : '');
        card.dataset.gameId = game.id;

        const wins = game.pins.filter(p => p.type === 'win').length;
        const losses = game.pins.filter(p => p.type === 'loss').length;
        const total = wins + losses;
        const percentage = total > 0 ? Math.round((wins / total) * 100) : 0;

        const date = new Date(game.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        card.innerHTML = `
            <div class="game-card-header">
                <div class="game-card-title">${game.opponent}</div>
            </div>
            <div class="game-card-date">${date}</div>
            <div class="game-card-stats">
                <div class="game-card-stat">
                    <span class="stat-badge wins">${wins}W</span>
                </div>
                <div class="game-card-stat">
                    <span class="stat-badge losses">${losses}L</span>
                </div>
                <div class="game-card-stat">
                    <span class="stat-badge percentage">${percentage}%</span>
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            this.selectGame(game.id);
        });

        return card;
    }

    selectGame(gameId) {
        this.tracker.currentGameId = gameId;
        this.tracker.saveCurrentGameId();
        this.updateUI();
    }

    updateCurrentGameInfo() {
        const game = this.tracker.getCurrentGame();
        
        if (!game) {
            this.elements.currentOpponent.textContent = 'Select a game';
            this.elements.currentDate.textContent = '';
            return;
        }

        this.elements.currentOpponent.textContent = `vs ${game.opponent}`;
        
        const date = new Date(game.date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
        
        this.elements.currentDate.textContent = date;
    }

    updateStats() {
        const game = this.tracker.getCurrentGame();
        let stats;
        let viewText = 'Viewing: Team';
        
        if (!game) {
            stats = { wins: 0, losses: 0, total: 0, percentage: 0 };
        } else if (this.currentViewMode === 'team') {
            // Show all team stats
            stats = this.tracker.getStats();
            viewText = 'Viewing: Team';
        } else {
            // Show specific player stats
            const player = this.tracker.players.find(p => p.id === this.currentViewMode);
            if (player) {
                const displayName = player.number ? `#${player.number} ${player.name}` : player.name;
                viewText = `Viewing: ${displayName}`;
            }
            
            const playerPins = game.pins.filter(pin => pin.playerId === this.currentViewMode);
            const wins = playerPins.filter(p => p.type === 'win').length;
            const losses = playerPins.filter(p => p.type === 'loss').length;
            const total = wins + losses;
            const percentage = total > 0 ? Math.round((wins / total) * 100) : 0;
            stats = { wins, losses, total, percentage };
        }
        
        this.elements.statWins.textContent = stats.wins;
        this.elements.statLosses.textContent = stats.losses;
        this.elements.statPercentage.textContent = `${stats.percentage}%`;
        this.elements.statTotal.textContent = stats.total;
        this.elements.viewIndicator.textContent = viewText;
    }

    updateSeasonStats() {
        // Check if season stats elements exist (they may not be in the current UI)
        if (!this.elements.seasonGames) return;
        
        const gameIds = Object.keys(this.tracker.games);
        
        if (gameIds.length === 0) {
            this.elements.seasonGames.textContent = '0';
            this.elements.seasonWins.textContent = '0';
            this.elements.seasonLosses.textContent = '0';
            this.elements.seasonPercentage.textContent = '0%';
            return;
        }

        let totalWins = 0;
        let totalLosses = 0;

        gameIds.forEach(id => {
            const game = this.tracker.games[id];
            const wins = game.pins.filter(p => p.type === 'win').length;
            const losses = game.pins.filter(p => p.type === 'loss').length;
            totalWins += wins;
            totalLosses += losses;
        });

        const total = totalWins + totalLosses;
        const percentage = total > 0 ? Math.round((totalWins / total) * 100) : 0;

        this.elements.seasonGames.textContent = gameIds.length;
        this.elements.seasonWins.textContent = totalWins;
        this.elements.seasonLosses.textContent = totalLosses;
        this.elements.seasonPercentage.textContent = `${percentage}%`;
    }

    render() {
        const game = this.tracker.getCurrentGame();
        let pins = game ? game.pins : [];
        
        // Filter pins based on view mode
        if (this.currentViewMode !== 'team') {
            // Viewing a specific player
            pins = pins.filter(pin => pin.playerId === this.currentViewMode);
        }
        
        if (this.displayType === 'heatmap') {
            this.fieldRenderer.renderHeatmap(pins);
        } else {
            this.fieldRenderer.render(pins);
        }
    }

    updateUI() {
        this.updateGamesList();
        this.updateCurrentGameInfo();
        this.updateRosterList();
        this.updatePlayerSelect();
        this.updatePlayerViewList();
        this.updateStats();
        this.updateSeasonStats();
        this.render();
    }
}

// ===== Initialize App with Firebase Authentication =====
let appInstance = null;

async function initializeApp() {
    // Small delay to ensure layout is calculated
    await new Promise(resolve => setTimeout(resolve, 100));
    
    appInstance = new UIController();
    
    // Setup real-time sync callback
    appInstance.tracker.onDataChange((type) => {
        if (type === 'games' || type === 'players') {
            appInstance.updateUI();
        }
    });
    
    // Initialize Firebase data
    await appInstance.tracker.initialize();
    
    // Update UI after data load
    appInstance.updateUI();
    
    // Show welcome message if no games (excluding season total)
    const gameKeys = Object.keys(appInstance.tracker.games).filter(id => id !== appInstance.tracker.SEASON_TOTAL_ID);
    if (gameKeys.length === 0) {
        setTimeout(() => {
            alert('Welcome to Face-Off Tracker! 🥍\n\nClick "New Game" to start tracking face-offs.\n\nThen click on the field to place pins showing where face-offs were won (green) or lost (red).');
        }, 500);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authOverlay = document.getElementById('auth-overlay');
    const appContent = document.getElementById('app-content');
    const signInBtn = document.getElementById('sign-in-btn');
    const signOutBtn = document.getElementById('sign-out-btn');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const syncStatus = document.getElementById('sync-status');
    
    // Handle authentication state changes
    firebaseService.onAuthChange(async (user) => {
        if (user) {
            // User signed in
            authOverlay.style.display = 'none';
            appContent.style.display = 'flex';
            
            // Update user profile
            userAvatar.src = user.photoURL || '';
            userName.textContent = user.displayName || user.email;
            
            // Attempt migration from localStorage
            try {
                const migrated = await firebaseService.migrateFromLocalStorage();
                if (migrated) {
                    alert('Your local data has been migrated to the cloud! 🎉\n\nYour data is now synced across all devices.');
                }
            } catch (error) {
                console.error('Migration error:', error);
            }
            
            // Initialize app
            if (!appInstance) {
                await initializeApp();
            }
        } else {
            // User signed out
            authOverlay.style.display = 'flex';
            appContent.style.display = 'none';
            
            // Clear app instance
            if (appInstance) {
                appInstance = null;
            }
        }
    });
    
    // Sign in button
    signInBtn.addEventListener('click', async () => {
        try {
            await firebaseService.signIn();
        } catch (error) {
            console.error('Sign in error:', error);
            alert('Failed to sign in. Please try again.');
        }
    });
    
    // Sign out button
    signOutBtn.addEventListener('click', async () => {
        try {
            if (confirm('Are you sure you want to sign out? Your data will be saved in the cloud.')) {
                await firebaseService.signOutUser();
            }
        } catch (error) {
            console.error('Sign out error:', error);
            alert('Failed to sign out. Please try again.');
        }
    });
    
    // Setup sync status display
    firebaseService.onSyncStatusChange((status) => {
        syncStatus.className = 'sync-status';
        if (status === 'synced') {
            syncStatus.textContent = '● Synced';
            syncStatus.classList.add('synced');
        } else if (status === 'syncing') {
            syncStatus.textContent = '● Syncing...';
            syncStatus.classList.add('syncing');
        } else if (status === 'error') {
            syncStatus.textContent = '● Sync Error';
            syncStatus.classList.add('error');
        }
    });
});

// Export for debugging
if (typeof window !== 'undefined') {
    window.appInstance = appInstance;
    window.firebaseService = firebaseService;
}

