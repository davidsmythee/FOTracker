// ===== Import Firebase Service =====
import firebaseService from '../firebase-service.js';

// ===== Data Model =====
export default class FaceOffTracker {
    constructor(useFirebase = true) {
        this.useFirebase = useFirebase;
        this.games = {};
        this.currentGameId = null;
        this.currentMode = 'win'; // 'win' or 'loss' for face-off result
        this.currentClamp = 'win'; // 'win' or 'loss' for clamp result
        this.players = [];
        this.SEASON_TOTAL_ID = 'season_total';
        this.folders = {}; // Folder storage {id: folder}
        this.FOLDER_ID_PREFIX = 'folder_'; // Folder ID prefix
        this.CUMULATIVE_ID_PREFIX = 'cumulative_'; // Cumulative game ID prefix
        this.isLoading = false;
        this.onDataChangeCallback = null;
        this.hasUnsavedChanges = false; // Track unsaved pins/roster changes

        // Track Firebase operations for debugging
        this.firebaseOpCount = { reads: 0, writes: 0 };
    }

    async initialize() {
        if (this.useFirebase && firebaseService.getUserId()) {
            await this.loadFromFirebase();
            this.setupFirebaseListeners();
        } else {
            this.loadFromLocalStorage();
        }

        // Migrate old data format to new format
        this.migrateOldGames();

        // REMOVED: Season Total feature - cumulative tracking now only available via folders
        // await this.ensureSeasonTotalExists();

        // Set current game to first available game if none selected or invalid
        const oldGameId = this.currentGameId;
        if (!this.currentGameId || !this.games[this.currentGameId]) {
            // Find first regular game or cumulative folder game
            const gameIds = Object.keys(this.games);
            this.currentGameId = gameIds.length > 0 ? gameIds[0] : null;
        }

        // Only save if we actually changed the game ID
        if (oldGameId !== this.currentGameId && this.useFirebase && firebaseService.getUserId()) {
            await this.saveCurrentGameId();
        }
    }

    async loadFromFirebase() {
        try {
            this.isLoading = true;
            console.log('📖 Loading data from Firebase (initial load)...');
            const [games, players, folders, currentGameId] = await Promise.all([
                firebaseService.getAllGames(),
                firebaseService.getAllPlayers(),
                firebaseService.getAllFolders(),
                firebaseService.getCurrentGameId()
            ]);

            this.firebaseOpCount.reads += 4; // 4 read operations
            console.log(`📊 Total Firebase operations - reads: ${this.firebaseOpCount.reads}, writes: ${this.firebaseOpCount.writes}`);

            this.games = games;
            this.players = players;
            this.folders = folders || {};
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
        this.folders = this.loadFolders();
    }

    setupFirebaseListeners() {
        // TEMPORARILY DISABLED: Real-time listeners were causing runaway reads/writes
        // TODO: Re-implement with proper debouncing and loop prevention
        console.warn('🚫 Firebase real-time listeners DISABLED to prevent quota exhaustion');

        // // Listen to real-time updates
        // firebaseService.listenToGames((games) => {
        //     this.games = games;
        //     // Just update local state, don't trigger any saves
        //     // Season Total is already correct in Firebase
        //     if (this.onDataChangeCallback) {
        //         this.onDataChangeCallback('games');
        //     }
        // });

        // firebaseService.listenToPlayers((players) => {
        //     this.players = players;
        //     if (this.onDataChangeCallback) {
        //         this.onDataChangeCallback('players');
        //     }
        // });
    }

    onDataChange(callback) {
        this.onDataChangeCallback = callback;
    }

    migrateOldGames() {
        console.log('🔄 Checking for games needing migration...');
        let migrated = false;

        Object.values(this.games).forEach(game => {
            // Migrate opponent field to teamA/teamB
            if (game.opponent && !game.teamA) {
                console.log(`🔄 Migrating game: ${game.opponent}`);
                game.teamA = "Home Team";
                game.teamB = game.opponent;
                delete game.opponent;
                migrated = true;
            }

            // Migrate roster from array of strings to array of objects
            if (game.roster && game.roster.length > 0 && typeof game.roster[0] === 'string') {
                console.log(`🔄 Migrating roster for game: ${game.teamA || game.opponent}`);
                game.roster = game.roster.map(playerId => ({
                    playerId: playerId,
                    team: 'A'  // Assume all old roster players are team A
                }));
                migrated = true;
            }
        });

        if (migrated) {
            console.log('✅ Migration complete');
        } else {
            console.log('✅ No migration needed');
        }

        return migrated;
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

    async addPlayer(name, number = '', team = '', position = '') {
        const player = {
            id: Date.now().toString(),
            name,
            number,
            team,
            position,
            createdAt: new Date().toISOString()
        };
        this.players.push(player);

        if (this.useFirebase && firebaseService.getUserId()) {
            this.firebaseOpCount.writes++;
            console.log(`💾 WRITE #${this.firebaseOpCount.writes}: Saving player "${player.name}"`);
            await firebaseService.savePlayer(player.id, player);
            console.log(`📊 Total Firebase operations - reads: ${this.firebaseOpCount.reads}, writes: ${this.firebaseOpCount.writes}`);
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
        // Remove all pins associated with this player from all games
        Object.values(this.games).forEach(game => {
            if (game.id !== this.SEASON_TOTAL_ID) {
                const originalPinCount = game.pins.length;
                game.pins = game.pins.filter(pin =>
                    pin.player1Id !== playerId && pin.player2Id !== playerId && pin.playerId !== playerId
                );

                // If pins were removed, save the game
                if (game.pins.length !== originalPinCount && this.useFirebase && firebaseService.getUserId()) {
                    firebaseService.saveGame(game.id, game);
                }
            }
        });

        // REMOVED: Season Total rebuild (cumulative tracking now only via folders)

        // Remove player from all game rosters
        Object.values(this.games).forEach(game => {
            if (game.id !== this.SEASON_TOTAL_ID && game.roster) {
                game.roster = game.roster.filter(id => id !== playerId);
            }
        });

        // Remove player from players list
        this.players = this.players.filter(p => p.id !== playerId);

        if (this.useFirebase && firebaseService.getUserId()) {
            await firebaseService.deletePlayer(playerId);
        } else {
            this.savePlayers();
            this.saveGames();
        }
    }

    getPlayerById(playerId) {
        return this.players.find(p => p.id === playerId);
    }

    addPlayerToRoster(gameId, playerId, team) {
        const game = this.games[gameId];
        if (!game || game.id === this.SEASON_TOTAL_ID) return;

        // Initialize roster if it doesn't exist (for older games)
        if (!game.roster) {
            game.roster = [];
        }

        // Check if player already in roster (handle both old and new format)
        const existingEntry = game.roster.find(r =>
            (typeof r === 'string' && r === playerId) ||
            (typeof r === 'object' && r.playerId === playerId)
        );

        if (!existingEntry) {
            game.roster.push({ playerId, team });
            this.markUnsavedChanges();
        }
    }

    removePlayerFromRoster(gameId, playerId) {
        const game = this.games[gameId];
        if (!game || game.id === this.SEASON_TOTAL_ID) return;

        if (game.roster) {
            // Remove player from roster (handle both old and new format)
            game.roster = game.roster.filter(r =>
                (typeof r === 'string' && r !== playerId) ||
                (typeof r === 'object' && r.playerId !== playerId)
            );

            // Remove all pins by this player from the game (both old and new format)
            game.pins = game.pins.filter(pin =>
                pin.player1Id !== playerId &&
                pin.player2Id !== playerId &&
                pin.playerId !== playerId &&
                pin.teamAPlayerId !== playerId &&
                pin.teamBPlayerId !== playerId
            );

            // REMOVED: Season Total rebuild (cumulative tracking now only via folders)

            this.markUnsavedChanges();
        }
    }

    getGameRoster(gameId) {
        const game = this.games[gameId];
        if (!game || game.id === this.SEASON_TOTAL_ID) return [];

        // Initialize roster if it doesn't exist
        if (!game.roster) {
            game.roster = [];
        }

        // Return player objects with team assignments
        return game.roster
            .map(r => {
                // Handle old format (string) or new format (object)
                const playerId = typeof r === 'string' ? r : r.playerId;
                const team = typeof r === 'object' ? r.team : 'A'; // Default to team A for old format
                const player = this.players.find(p => p.id === playerId);
                return player ? { ...player, gameTeam: team } : null;
            })
            .filter(p => p); // Filter out any undefined (deleted players)
    }

    // REMOVED: Season Total feature - cumulative tracking now only available via folders
    // async ensureSeasonTotalExists() {
    //     if (!this.games[this.SEASON_TOTAL_ID]) {
    //         console.log('📊 Creating Season Total for the first time');
    //         this.games[this.SEASON_TOTAL_ID] = {
    //             id: this.SEASON_TOTAL_ID,
    //             teamA: 'All',
    //             teamB: 'Teams',
    //             date: new Date().toISOString(),
    //             notes: 'All face-offs from every game',
    //             pins: [],
    //             isSeasonTotal: true,
    //             createdAt: new Date().toISOString()
    //         };
    //
    //         // Rebuild Season Total from all games
    //         this.rebuildSeasonTotal();
    //
    //         // Save the newly created Season Total
    //         console.log('💾 Saving Season Total to Firebase (first time)');
    //         await this.saveGame(this.SEASON_TOTAL_ID);
    //     } else {
    //         // Just rebuild Season Total in memory from existing games
    //         console.log('📊 Rebuilding Season Total in memory (no save)');
    //         this.rebuildSeasonTotal();
    //     }
    // }
    //
    // rebuildSeasonTotal() {
    //     // Collect all pins from all regular games
    //     const allPins = [];
    //     Object.keys(this.games).forEach(gameId => {
    //         if (gameId !== this.SEASON_TOTAL_ID) {
    //             const game = this.games[gameId];
    //             if (game && game.pins) {
    //                 allPins.push(...game.pins.map(pin => ({...pin})));
    //             }
    //         }
    //     });
    //
    //     // Update Season Total with all pins (in memory only)
    //     if (this.games[this.SEASON_TOTAL_ID]) {
    //         this.games[this.SEASON_TOTAL_ID].pins = allPins;
    //     }
    // }

    markUnsavedChanges() {
        this.hasUnsavedChanges = true;
        if (this.onDataChangeCallback) {
            this.onDataChangeCallback('unsaved');
        }
    }

    async manualSaveGame() {
        const game = this.getCurrentGame();
        if (!game) return;

        try {
            console.log(`💾 Manual save initiated for "${game.opponent}"`);
            // Save current game to Firebase
            if (this.useFirebase && firebaseService.getUserId()) {
                await this.saveGame(game.id);

                // REMOVED: Season Total rebuild/save (cumulative tracking now only via folders)
            } else {
                this.saveGames();
            }

            this.hasUnsavedChanges = false;
            if (this.onDataChangeCallback) {
                this.onDataChangeCallback('saved');
            }
            console.log('✅ Manual save complete');
        } catch (error) {
            console.error('❌ Error saving game:', error);
            if (this.onDataChangeCallback) {
                this.onDataChangeCallback('save-error');
            }
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
            this.firebaseOpCount.writes++;
            console.log(`💾 WRITE #${this.firebaseOpCount.writes}: Saving game ${gameId.substring(0, 10)}...`);
            await firebaseService.saveGame(gameId, game);
            console.log(`📊 Total Firebase operations - reads: ${this.firebaseOpCount.reads}, writes: ${this.firebaseOpCount.writes}`);
        } else {
            this.saveGames();
        }
    }

    loadCurrentGameId() {
        return localStorage.getItem('faceoff_current_game');
    }

    async saveCurrentGameId() {
        if (this.useFirebase && firebaseService.getUserId()) {
            this.firebaseOpCount.writes++;
            console.log(`💾 WRITE #${this.firebaseOpCount.writes}: Saving current game ID`);
            await firebaseService.saveCurrentGameId(this.currentGameId);
            console.log(`📊 Total Firebase operations - reads: ${this.firebaseOpCount.reads}, writes: ${this.firebaseOpCount.writes}`);
        } else {
            localStorage.setItem('faceoff_current_game', this.currentGameId);
        }
    }

    loadFolders() {
        const stored = localStorage.getItem('faceoff_folders');
        return stored ? JSON.parse(stored) : {};
    }

    async saveFolders() {
        if (this.useFirebase && firebaseService.getUserId()) {
            // Firebase saves folders individually via saveFolder()
            // No need to save all folders at once
        } else {
            localStorage.setItem('faceoff_folders', JSON.stringify(this.folders));
        }
    }

    async createGame(teamA, teamB, date, notes = '', folderId = null) {
        const id = Date.now().toString();
        this.games[id] = {
            id,
            teamA,
            teamB,
            date,
            notes,
            pins: [],
            roster: [], // Array of {playerId, team} objects
            folderId: folderId, // Folder ID (null if unfiled)
            createdAt: new Date().toISOString()
        };
        this.currentGameId = id;

        if (this.useFirebase && firebaseService.getUserId()) {
            console.log(`🎮 Creating new game: "${teamA} vs ${teamB}"`);
            await this.saveGame(id); // saveGame will count the write
            await this.saveCurrentGameId();
        } else {
            this.saveGames();
            this.saveCurrentGameId();
        }

        // Rebuild cumulative folder if game is in folder
        if (folderId && this.folders[folderId]?.hasCumulativeTracker) {
            this.rebuildCumulativeFolder(folderId);
            await this.saveGame(`${this.CUMULATIVE_ID_PREFIX}${folderId}`);
        }

        return id;
    }

    async deleteGame(id) {
        // Don't allow deleting season total or cumulative folders
        if (id === this.SEASON_TOTAL_ID) return;

        const game = this.games[id];
        if (!game || game.isCumulativeFolder) return;

        // Store folder ID before deleting
        const folderId = game.folderId;

        // Delete the game
        delete this.games[id];

        if (this.currentGameId === id) {
            const gameIds = Object.keys(this.games);
            this.currentGameId = gameIds.length > 0 ? gameIds[0] : null;
        }

        if (this.useFirebase && firebaseService.getUserId()) {
            await firebaseService.deleteGame(id);
            await this.saveCurrentGameId();

            // REMOVED: Season Total rebuild/save (cumulative tracking now only via folders)

            // Rebuild cumulative folder if game was in a folder
            if (folderId && this.folders[folderId]?.hasCumulativeTracker) {
                this.rebuildCumulativeFolder(folderId);
                await this.saveGame(`${this.CUMULATIVE_ID_PREFIX}${folderId}`);
            }
        } else {
            this.saveGames();
            this.saveCurrentGameId();

            // Rebuild cumulative folder if game was in a folder
            if (folderId && this.folders[folderId]?.hasCumulativeTracker) {
                this.rebuildCumulativeFolder(folderId);
            }
        }
    }

    async createFolder(name, hasCumulativeTracker = false) {
        const id = `${this.FOLDER_ID_PREFIX}${Date.now()}`;
        this.folders[id] = {
            id,
            name,
            hasCumulativeTracker,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isFolder: true
        };

        // If cumulative tracker enabled, create virtual game
        if (hasCumulativeTracker) {
            await this.createCumulativeGame(id);
        }

        // Save folder
        if (this.useFirebase && firebaseService.getUserId()) {
            this.firebaseOpCount.writes++;
            console.log(`📁 WRITE #${this.firebaseOpCount.writes}: Creating folder "${name}"`);
            await firebaseService.saveFolder(id, this.folders[id]);
        } else {
            this.saveFolders();
        }

        return id;
    }

    async createCumulativeGame(folderId) {
        const folder = this.folders[folderId];
        const cumulativeId = `${this.CUMULATIVE_ID_PREFIX}${folderId}`;

        this.games[cumulativeId] = {
            id: cumulativeId,
            teamA: 'Total',
            teamB: 'Tracker',
            date: new Date().toISOString(),
            notes: `Aggregated pins from: ${folder.name}`,
            pins: [],
            isCumulativeFolder: true,
            folderId: folderId,
            createdAt: new Date().toISOString()
        };

        // Build cumulative pins
        this.rebuildCumulativeFolder(folderId);

        // Save cumulative game
        if (this.useFirebase && firebaseService.getUserId()) {
            await this.saveGame(cumulativeId);
        }
    }

    rebuildCumulativeFolder(folderId) {
        const cumulativeId = `${this.CUMULATIVE_ID_PREFIX}${folderId}`;
        const cumulativeGame = this.games[cumulativeId];

        if (!cumulativeGame) return;

        // Collect all pins from games in this folder
        const folderPins = [];
        Object.values(this.games).forEach(game => {
            if (game.folderId === folderId && !game.isCumulativeFolder) {
                if (game.pins) {
                    folderPins.push(...game.pins.map(pin => ({...pin})));
                }
            }
        });

        // Update cumulative game pins (in memory only)
        cumulativeGame.pins = folderPins;
    }

    async moveGameToFolder(gameId, folderId) {
        const game = this.games[gameId];
        if (!game || game.isSeasonTotal || game.isCumulativeFolder) return;

        const oldFolderId = game.folderId;
        game.folderId = folderId;

        // Rebuild old and new cumulative folders
        if (oldFolderId && this.folders[oldFolderId]?.hasCumulativeTracker) {
            this.rebuildCumulativeFolder(oldFolderId);
            await this.saveGame(`${this.CUMULATIVE_ID_PREFIX}${oldFolderId}`);
        }
        if (folderId && this.folders[folderId]?.hasCumulativeTracker) {
            this.rebuildCumulativeFolder(folderId);
            await this.saveGame(`${this.CUMULATIVE_ID_PREFIX}${folderId}`);
        }

        // Save game
        await this.saveGame(gameId);
    }

    async renameFolder(folderId, newName) {
        const folder = this.folders[folderId];
        if (!folder) return;

        folder.name = newName;
        folder.updatedAt = new Date().toISOString();

        // Update cumulative game notes if it exists
        const cumulativeId = `${this.CUMULATIVE_ID_PREFIX}${folderId}`;
        if (this.games[cumulativeId]) {
            this.games[cumulativeId].notes = `Aggregated pins from: ${newName}`;
            if (this.useFirebase && firebaseService.getUserId()) {
                await this.saveGame(cumulativeId);
            }
        }

        // Save folder
        if (this.useFirebase && firebaseService.getUserId()) {
            await firebaseService.saveFolder(folderId, folder);
        } else {
            this.saveFolders();
        }
    }

    async deleteFolder(folderId) {
        const folder = this.folders[folderId];
        if (!folder) return;

        // Remove folder reference from all games
        Object.values(this.games).forEach(game => {
            if (game.folderId === folderId) {
                game.folderId = null;
            }
        });

        // Delete cumulative game if exists
        const cumulativeId = `${this.CUMULATIVE_ID_PREFIX}${folderId}`;
        if (this.games[cumulativeId]) {
            delete this.games[cumulativeId];
            if (this.useFirebase && firebaseService.getUserId()) {
                await firebaseService.deleteGame(cumulativeId);
            }
        }

        // Delete folder
        delete this.folders[folderId];
        if (this.useFirebase && firebaseService.getUserId()) {
            this.firebaseOpCount.writes++;
            console.log(`🗑️ WRITE #${this.firebaseOpCount.writes}: Deleting folder "${folder.name}"`);
            await firebaseService.deleteFolder(folderId);
        } else {
            this.saveFolders();
        }

        // REMOVED: Season Total rebuild (cumulative tracking now only via folders)
    }

    getCurrentGame() {
        return this.currentGameId ? this.games[this.currentGameId] : null;
    }

    addPin(x, y, teamAPlayerId, teamBPlayerId, faceoffWinnerId, clampWinnerId, isWhistleViolation = false, isPostWhistleViolation = false) {
        const game = this.getCurrentGame();
        if (game && !game.isCumulativeFolder) { // Prevent adding to cumulative folders
            const newPin = {
                x,
                y,
                teamAPlayerId,      // Player from Team A
                teamBPlayerId,      // Player from Team B (or "unknown")
                faceoffWinnerId,    // Who won face-off (player ID)
                clampWinnerId,      // Who won clamp (player ID) - null if whistle violation
                isWhistleViolation, // Flag indicating whistle violation (no actual faceoff)
                isPostWhistleViolation, // Flag indicating post-whistle violation (faceoff occurred)
                timestamp: Date.now()
            };
            game.pins.push(newPin);

            // Rebuild cumulative folder if game is in folder
            if (game.folderId && this.folders[game.folderId]?.hasCumulativeTracker) {
                this.rebuildCumulativeFolder(game.folderId);
            }

            // REMOVED: Season Total rebuild (cumulative tracking now only via folders)

            // Mark as having unsaved changes
            this.markUnsavedChanges();
        }
    }

    removeLastPin() {
        const game = this.getCurrentGame();
        if (game && game.pins.length > 0 && !game.isCumulativeFolder) {
            game.pins.pop();

            // Rebuild cumulative folder if game is in folder
            if (game.folderId && this.folders[game.folderId]?.hasCumulativeTracker) {
                this.rebuildCumulativeFolder(game.folderId);
            }

            // REMOVED: Season Total rebuild (cumulative tracking now only via folders)

            // Mark as having unsaved changes
            this.markUnsavedChanges();

            return true;
        }
        return false;
    }

    clearAllPins() {
        const game = this.getCurrentGame();
        if (game && !game.isCumulativeFolder) {
            // Clear this game's pins
            game.pins = [];

            // Rebuild cumulative folder if game is in folder
            if (game.folderId && this.folders[game.folderId]?.hasCumulativeTracker) {
                this.rebuildCumulativeFolder(game.folderId);
            }

            // REMOVED: Season Total rebuild and special handling (cumulative tracking now only via folders)

            // Mark as having unsaved changes
            this.markUnsavedChanges();
        }
    }

    getStats() {
        const game = this.getCurrentGame();
        if (!game) {
            return { wins: 0, losses: 0, total: 0, percentage: 0 };
        }

        // Get team A player IDs for this game
        const teamAPlayerIds = game.roster
            ? game.roster
                .filter(r => {
                    if (typeof r === 'object') return r.team === 'A';
                    return true; // Old format - assume team A
                })
                .map(r => typeof r === 'string' ? r : r.playerId)
            : [];

        // Handle both old and new pin data structures
        const wins = game.pins.filter(p => {
            // New format - check if face-off winner is a team A player
            if (p.faceoffWinnerId) {
                return teamAPlayerIds.includes(p.faceoffWinnerId);
            }
            // Old format - check faceoffResult
            const faceoffResult = p.faceoffResult || p.type || 'win';
            return faceoffResult === 'win';
        }).length;

        const losses = game.pins.filter(p => {
            // New format - check if face-off winner is NOT a team A player
            if (p.faceoffWinnerId) {
                return !teamAPlayerIds.includes(p.faceoffWinnerId) && p.faceoffWinnerId !== 'unknown';
            }
            // Old format - check faceoffResult
            const faceoffResult = p.faceoffResult || p.type || 'win';
            return faceoffResult === 'loss';
        }).length;

        const total = wins + losses;
        const percentage = total > 0 ? Math.round((wins / total) * 100) : 0;

        return { wins, losses, total, percentage };
    }
}
