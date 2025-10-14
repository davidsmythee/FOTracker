// ===== Data Model =====
class FaceOffTracker {
    constructor() {
        this.games = this.loadGames();
        this.currentGameId = this.loadCurrentGameId();
        this.currentMode = 'win'; // 'win' or 'loss'
        this.currentPlayer = null; // Currently selected player
        this.players = this.loadPlayers();
        this.SEASON_TOTAL_ID = 'season_total';
        this.ensureSeasonTotalExists();
    }

    loadPlayers() {
        const saved = localStorage.getItem('faceoff_players');
        return saved ? JSON.parse(saved) : [];
    }

    savePlayers() {
        localStorage.setItem('faceoff_players', JSON.stringify(this.players));
    }

    addPlayer(name, number = '', team = '') {
        const player = {
            id: Date.now().toString(),
            name,
            number,
            team,
            createdAt: new Date().toISOString()
        };
        this.players.push(player);
        this.savePlayers();
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

    deletePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
        if (this.currentPlayer === playerId) {
            this.currentPlayer = null;
        }
        this.savePlayers();
    }

    ensureSeasonTotalExists() {
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
            this.saveGames();
        }
    }

    loadGames() {
        const saved = localStorage.getItem('faceoff_games');
        return saved ? JSON.parse(saved) : {};
    }

    saveGames() {
        localStorage.setItem('faceoff_games', JSON.stringify(this.games));
    }

    loadCurrentGameId() {
        return localStorage.getItem('faceoff_current_game');
    }

    saveCurrentGameId() {
        localStorage.setItem('faceoff_current_game', this.currentGameId);
    }

    createGame(opponent, date, notes = '') {
        const id = Date.now().toString();
        this.games[id] = {
            id,
            opponent,
            date,
            notes,
            pins: [],
            createdAt: new Date().toISOString()
        };
        this.currentGameId = id;
        this.saveGames();
        this.saveCurrentGameId();
        return id;
    }

    deleteGame(id) {
        // Don't allow deleting season total
        if (id === this.SEASON_TOTAL_ID) return;

        const game = this.games[id];
        if (game) {
            // Remove this game's pins from season total
            const seasonTotal = this.games[this.SEASON_TOTAL_ID];
            game.pins.forEach(pin => {
                const index = seasonTotal.pins.findIndex(p => 
                    p.x === pin.x && 
                    p.y === pin.y && 
                    p.type === pin.type && 
                    p.timestamp === pin.timestamp
                );
                if (index !== -1) {
                    seasonTotal.pins.splice(index, 1);
                }
            });

            // Delete the game
            delete this.games[id];
            
            if (this.currentGameId === id) {
                const gameIds = Object.keys(this.games).filter(id => id !== this.SEASON_TOTAL_ID);
                this.currentGameId = gameIds.length > 0 ? gameIds[0] : this.SEASON_TOTAL_ID;
            }
            
            this.saveGames();
            this.saveCurrentGameId();
        }
    }

    getCurrentGame() {
        return this.currentGameId ? this.games[this.currentGameId] : null;
    }

    addPin(x, y, type) {
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

            // Add to season total if this isn't already the season total game
            if (game.id !== this.SEASON_TOTAL_ID) {
                this.games[this.SEASON_TOTAL_ID].pins.push({...newPin});
            }
            
            this.saveGames();
        }
    }

    removeLastPin() {
        const game = this.getCurrentGame();
        if (game && game.pins.length > 0) {
            const removedPin = game.pins.pop();
            
            // If this isn't the season total, remove the corresponding pin from season total
            if (game.id !== this.SEASON_TOTAL_ID) {
                const seasonTotal = this.games[this.SEASON_TOTAL_ID];
                const index = seasonTotal.pins.findIndex(p => 
                    p.x === removedPin.x && 
                    p.y === removedPin.y && 
                    p.type === removedPin.type && 
                    p.timestamp === removedPin.timestamp
                );
                if (index !== -1) {
                    seasonTotal.pins.splice(index, 1);
                }
            }
            
            this.saveGames();
            return true;
        }
        return false;
    }

    clearAllPins() {
        const game = this.getCurrentGame();
        if (game) {
            if (game.id === this.SEASON_TOTAL_ID) {
                // If clearing season total, clear all games
                Object.values(this.games).forEach(g => g.pins = []);
            } else {
                // Remove this game's pins from both the game and season total
                const removedPins = game.pins;
                game.pins = [];
                
                const seasonTotal = this.games[this.SEASON_TOTAL_ID];
                removedPins.forEach(pin => {
                    const index = seasonTotal.pins.findIndex(p => 
                        p.x === pin.x && 
                        p.y === pin.y && 
                        p.type === pin.type && 
                        p.timestamp === pin.timestamp
                    );
                    if (index !== -1) {
                        seasonTotal.pins.splice(index, 1);
                    }
                });
            }
            this.saveGames();
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
        this.viewMode = 'pins'; // 'pins' or 'heatmap'
        this.filterPlayerId = null; // For filtering pins by player
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
            addPlayerBtn: document.getElementById('add-player-btn'),
            managePlayersBtn: document.getElementById('manage-players-btn'),
            filterPlayer: document.getElementById('filter-player'),
            undoBtn: document.getElementById('undo-btn'),
            clearBtn: document.getElementById('clear-btn'),
            canvas: document.getElementById('lacrosse-field'),
            modal: document.getElementById('new-game-modal'),
            newGameForm: document.getElementById('new-game-form'),
            cancelModal: document.getElementById('cancel-modal'),
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
        this.elements.deleteGameBtn.addEventListener('click', () => {
            if (this.tracker.currentGameId && confirm('Are you sure you want to delete this game?')) {
                this.tracker.deleteGame(this.tracker.currentGameId);
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

        // View mode buttons
        this.elements.viewPins.addEventListener('click', () => {
            this.setViewMode('pins');
        });

        this.elements.viewHeatmap.addEventListener('click', () => {
            this.setViewMode('heatmap');
        });

        // Player selection
        this.elements.playerSelect.addEventListener('change', (e) => {
            this.tracker.currentPlayer = e.target.value || null;
        });

        // Add player button
        this.elements.addPlayerBtn.addEventListener('click', () => {
            this.showAddPlayerModal();
        });

        // Manage players button
        this.elements.managePlayersBtn.addEventListener('click', () => {
            this.showManagePlayersModal();
        });

        // Filter by player
        this.elements.filterPlayer.addEventListener('change', (e) => {
            this.filterPlayerId = e.target.value || null;
            this.render();
        });

        // Undo button
        this.elements.undoBtn.addEventListener('click', () => {
            if (this.tracker.removeLastPin()) {
                this.render();
                this.updateStats();
            }
        });

        // Clear button
        this.elements.clearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all pins?')) {
                this.tracker.clearAllPins();
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

    setViewMode(mode) {
        this.viewMode = mode;
        
        // Update button states
        this.elements.viewPins.classList.toggle('active', mode === 'pins');
        this.elements.viewHeatmap.classList.toggle('active', mode === 'heatmap');
        
        // Re-render with new view mode
        this.render();
    }

    handleCanvasClick(event) {
        if (!this.tracker.currentGameId) {
            alert('Please create a game first!');
            return;
        }

        const coords = this.fieldRenderer.getClickCoordinates(event);
        this.tracker.addPin(coords.x, coords.y, this.tracker.currentMode);
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

    createNewGame() {
        const opponent = document.getElementById('opponent-name').value;
        const date = document.getElementById('game-date').value;
        const notes = document.getElementById('game-notes').value;

        this.tracker.createGame(opponent, date, notes);
        this.hideNewGameModal();
        this.updateUI();
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

    addNewPlayer() {
        const name = document.getElementById('player-name').value;
        const number = document.getElementById('player-number').value;
        const team = document.getElementById('player-team').value;

        const player = this.tracker.addPlayer(name, number, team);
        this.tracker.currentPlayer = player.id; // Auto-select the new player
        this.hideAddPlayerModal();
        this.updatePlayerSelect();
        this.updateFilterPlayerSelect();
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

    deletePlayer(playerId) {
        const player = this.tracker.players.find(p => p.id === playerId);
        if (!player) return;

        const displayName = player.number 
            ? `#${player.number} ${player.name}` 
            : player.name;

        if (confirm(`Are you sure you want to delete ${displayName}?\n\nThis will NOT delete their face-off data, but you won't be able to assign new face-offs to this player.`)) {
            this.tracker.deletePlayer(playerId);
            this.updatePlayersList();
            this.updatePlayerSelect();
            this.updateFilterPlayerSelect();
        }
    }

    updatePlayerSelect() {
        const select = this.elements.playerSelect;
        select.innerHTML = '<option value="">Select Player</option>';

        // Get current game and players who have taken face-offs in THIS game
        const currentGame = this.tracker.getCurrentGame();
        if (!currentGame || currentGame.id === this.tracker.SEASON_TOTAL_ID) {
            return; // Don't show any players for Season Total or if no game
        }

        // Get unique player IDs from pins in current game
        const playerIdsInGame = new Set(
            currentGame.pins
                .map(pin => pin.playerId)
                .filter(id => id) // Filter out any undefined/null
        );

        // Filter players to only those in this game
        const playersInGame = this.tracker.players.filter(player => 
            playerIdsInGame.has(player.id)
        );

        if (playersInGame.length === 0) {
            return; // No players in this game yet
        }

        // Group players by team
        const playersByTeam = {};
        playersInGame.forEach(player => {
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

    updateFilterPlayerSelect() {
        const select = this.elements.filterPlayer;
        select.innerHTML = '<option value="">Show All Players</option>';

        // Group players by team
        const playersByTeam = {};
        this.tracker.players.forEach(player => {
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
                
                if (player.id === this.filterPlayerId) {
                    option.selected = true;
                }
                
                optgroup.appendChild(option);
            });
            
            select.appendChild(optgroup);
        });
    }

    updateGamesList() {
        const gamesList = this.elements.gamesList;
        gamesList.innerHTML = '';

        const gameIds = Object.keys(this.tracker.games);
        
        if (gameIds.length <= 1) { // Only season total exists
            gamesList.innerHTML = `
                <div class="no-games-message">
                    <p>No games yet</p>
                    <p class="hint">Create your first game to get started!</p>
                </div>
            `;
            this.elements.deleteGameBtn.style.display = 'none';
            this.elements.currentOpponent.textContent = 'Select a game';
            this.elements.currentDate.textContent = '';
            return;
        }

        // Create season total card first
        const seasonTotalCard = this.createGameCard(
            this.tracker.games[this.tracker.SEASON_TOTAL_ID],
            this.tracker.currentGameId === this.tracker.SEASON_TOTAL_ID
        );
        gamesList.appendChild(seasonTotalCard);

        // Add divider
        const divider = document.createElement('div');
        divider.className = 'games-list-divider';
        gamesList.appendChild(divider);

        // Show/hide delete button based on whether season total is selected
        this.elements.deleteGameBtn.style.display = 
            this.tracker.currentGameId === this.tracker.SEASON_TOTAL_ID ? 'none' : 'block';

        // Sort regular games by date (newest first)
        const regularGameIds = gameIds.filter(id => id !== this.tracker.SEASON_TOTAL_ID);
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
        const stats = this.tracker.getStats();
        
        this.elements.statWins.textContent = stats.wins;
        this.elements.statLosses.textContent = stats.losses;
        this.elements.statPercentage.textContent = `${stats.percentage}%`;
        this.elements.statTotal.textContent = stats.total;
    }

    updateSeasonStats() {
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
        
        // Filter pins by player if a filter is active
        if (this.filterPlayerId) {
            pins = pins.filter(pin => pin.playerId === this.filterPlayerId);
        }
        
        if (this.viewMode === 'heatmap') {
            this.fieldRenderer.renderHeatmap(pins);
        } else {
            this.fieldRenderer.render(pins);
        }
    }

    updateUI() {
        this.updateGamesList();
        this.updateCurrentGameInfo();
        this.updateStats();
        this.updateSeasonStats();
        this.updatePlayerSelect();
        this.updateFilterPlayerSelect();
        this.render();
    }
}

// ===== Initialize App =====
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure layout is calculated
    setTimeout(() => {
        const app = new UIController();
        
        // Show welcome message if no games
        if (Object.keys(app.tracker.games).length === 0) {
            setTimeout(() => {
                alert('Welcome to Face-Off Tracker! 🥍\n\nClick "New Game" to start tracking face-offs.\n\nThen click on the field to place pins showing where face-offs were won (green) or lost (red).');
            }, 500);
        }
    }, 100);
});

