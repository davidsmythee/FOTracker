// ===== Import Dependencies =====
import FaceOffTracker from './FaceOffTracker.js';
import FieldRenderer from './FieldRenderer.js';
import { searchSchools, getTeamColor, d1LacrosseSchools, areColorsSimilar } from './d1-schools.js';
import { getTeamColor as getTeamColorFromMap } from './TeamColors.js';

// ===== UI Controller =====
class UIController {
    constructor() {
        this.tracker = new FaceOffTracker();
        this.fieldRenderer = new FieldRenderer(document.getElementById('lacrosse-field'));
        this.displayType = 'pins'; // 'pins' or 'heatmap'
        this.currentViewMode = 'team'; // 'team' or player ID
        this.selectedStatsTeam = 'A'; // 'A' or 'B' - which team's stats to display
        this.showClampRings = true; // Whether to show clamp result rings on pins
        this.selectedGames = new Set(); // Set of selected game IDs for filtering
        this.selectedTeamAPlayers = new Set(); // Set of selected Team A player IDs for filtering
        this.selectedTeamBPlayers = new Set(); // Set of selected Team B player IDs for filtering
        this.lastTeamAPlayer = null; // Last selected Team A player ID
        this.lastTeamBPlayer = null; // Last selected Team B player ID
        this.selectedFolderId = null; // Currently selected folder for auto-filing new games
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
            managePlayersBtn: document.getElementById('manage-players-btn'),
            deleteGameBtn: document.getElementById('delete-game-btn'),
            printFieldBtn: document.getElementById('print-field-btn'),
            currentOpponent: document.getElementById('current-opponent'),
            currentDate: document.getElementById('current-date'),
            viewPins: document.getElementById('view-pins'),
            viewHeatmap: document.getElementById('view-heatmap'),
            addToRosterBtn: document.getElementById('add-to-roster-btn'),
            rosterList: document.getElementById('roster-list'),
            teamAFilterLabel: document.getElementById('team-a-filter-label'),
            teamBFilterLabel: document.getElementById('team-b-filter-label'),
            selectAllTeamA: document.getElementById('select-all-team-a'),
            deselectAllTeamA: document.getElementById('deselect-all-team-a'),
            selectAllTeamB: document.getElementById('select-all-team-b'),
            deselectAllTeamB: document.getElementById('deselect-all-team-b'),
            teamAPlayerFilters: document.getElementById('team-a-player-filters'),
            teamBPlayerFilters: document.getElementById('team-b-player-filters'),
            saveGameBtn: document.getElementById('save-game-btn'),
            undoBtn: document.getElementById('undo-btn'),
            clearBtn: document.getElementById('clear-btn'),
            unsavedIndicator: document.getElementById('unsaved-indicator'),
            canvas: document.getElementById('lacrosse-field'),
            modal: document.getElementById('new-game-modal'),
            newGameForm: document.getElementById('new-game-form'),
            cancelModal: document.getElementById('cancel-modal'),
            rosterModal: document.getElementById('add-to-roster-modal'),
            playerSearch: document.getElementById('player-search'),
            availablePlayersList: document.getElementById('available-players-list'),
            createNewPlayerBtn: document.getElementById('create-new-player-btn'),
            cancelRosterModal: document.getElementById('cancel-roster-modal'),
            playerModal: document.getElementById('add-player-modal'),
            addPlayerForm: document.getElementById('add-player-form'),
            cancelPlayerModal: document.getElementById('cancel-player-modal'),
            managePlayersModal: document.getElementById('manage-players-modal'),
            closeManagePlayers: document.getElementById('close-manage-players'),
            playersList: document.getElementById('players-list'),
            pinDetailsModal: document.getElementById('pin-details-modal'),
            pinDetailsForm: document.getElementById('pin-details-form'),
            cancelPinDetails: document.getElementById('cancel-pin-details'),
            teamAPlayerSelect: document.getElementById('team-a-player-select'),
            teamBPlayerSelect: document.getElementById('team-b-player-select'),
            gameFilterSection: document.getElementById('game-filter-section'),
            selectAllGames: document.getElementById('select-all-games'),
            deselectAllGames: document.getElementById('deselect-all-games'),
            gameFilterList: document.getElementById('game-filter-list'),
            seasonGames: document.getElementById('season-games'),
            seasonWins: document.getElementById('season-wins'),
            seasonLosses: document.getElementById('season-losses'),
            seasonPercentage: document.getElementById('season-percentage'),
            newFolderBtn: document.getElementById('new-folder-btn'),
            newFolderModal: document.getElementById('new-folder-modal'),
            newFolderForm: document.getElementById('new-folder-form'),
            cancelFolderModal: document.getElementById('cancel-folder-modal'),
            viewStatsBtn: document.getElementById('view-stats-btn'),
            statsModal: document.getElementById('stats-modal'),
            closeStatsModal: document.getElementById('close-stats-modal'),
            statsTableContainer: document.getElementById('stats-table-container')
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

        this.elements.managePlayersBtn.addEventListener('click', () => {
            this.showManagePlayersModal();
        });

        // New folder button
        this.elements.newFolderBtn.addEventListener('click', () => {
            this.showNewFolderModal();
        });

        // Cancel folder modal
        this.elements.cancelFolderModal.addEventListener('click', () => {
            this.hideNewFolderModal();
        });

        // New folder form submission
        this.elements.newFolderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createNewFolder();
        });

        // View stats button
        this.elements.viewStatsBtn.addEventListener('click', () => {
            this.showStatsModal();
        });

        // Close stats modal
        this.elements.closeStatsModal.addEventListener('click', () => {
            this.hideStatsModal();
        });

        // Delete game button
        this.elements.deleteGameBtn.addEventListener('click', async () => {
            if (this.tracker.currentGameId) {
                const result = await Swal.fire({
                    title: 'Delete Game',
                    text: 'Are you sure you want to delete this game?',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#dc2626',
                    cancelButtonColor: '#6b7280',
                    confirmButtonText: 'Yes, delete it!',
                    cancelButtonText: 'Cancel'
                });
                
                if (result.isConfirmed) {
                    await this.tracker.deleteGame(this.tracker.currentGameId);
                    this.updateUI();
                }
            }
        });

        // Print field button
        this.elements.printFieldBtn.addEventListener('click', () => {
            this.printField();
        });


        // Display type buttons (pins vs heatmap)
        this.elements.viewPins.addEventListener('click', () => {
            this.setDisplayType('pins');
        });

        this.elements.viewHeatmap.addEventListener('click', () => {
            this.setDisplayType('heatmap');
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

        // Player search
        this.elements.playerSearch.addEventListener('input', (e) => {
            this.updateAvailablePlayersList(e.target.value);
        });

        // Player filter select all/none buttons
        if (this.elements.selectAllTeamA) {
            this.elements.selectAllTeamA.addEventListener('click', () => {
                this.selectAllTeamPlayers('A', true);
            });
        }
        if (this.elements.deselectAllTeamA) {
            this.elements.deselectAllTeamA.addEventListener('click', () => {
                this.selectAllTeamPlayers('A', false);
            });
        }
        if (this.elements.selectAllTeamB) {
            this.elements.selectAllTeamB.addEventListener('click', () => {
                this.selectAllTeamPlayers('B', true);
            });
        }
        if (this.elements.deselectAllTeamB) {
            this.elements.deselectAllTeamB.addEventListener('click', () => {
                this.selectAllTeamPlayers('B', false);
            });
        }

        // Show clamp rings checkbox
        const showClampRingsCheckbox = document.getElementById('show-clamp-rings');
        if (showClampRingsCheckbox) {
            // Initialize from checkbox state
            this.showClampRings = showClampRingsCheckbox.checked;

            showClampRingsCheckbox.addEventListener('change', (e) => {
                this.showClampRings = e.target.checked;
                this.render();
            });
        }

        // Team toggle buttons for stats
        const toggleTeamA = document.getElementById('toggle-team-a');
        const toggleTeamB = document.getElementById('toggle-team-b');
        if (toggleTeamA && toggleTeamB) {
            toggleTeamA.addEventListener('click', () => {
                this.setStatsTeam('A');
            });
            toggleTeamB.addEventListener('click', () => {
                this.setStatsTeam('B');
            });
        }

        // Roster and player modals
        this.elements.cancelRosterModal.addEventListener('click', () => {
            this.hideAddToRosterModal();
        });

        // Save game button
        this.elements.saveGameBtn.addEventListener('click', async () => {
            await this.tracker.manualSaveGame();
            this.updateUnsavedIndicator();
        });

        // Undo button
        this.elements.undoBtn.addEventListener('click', () => {
            if (this.tracker.removeLastPin()) {
                this.render();
                this.updateStats();
                this.updateUnsavedIndicator();
            }
        });

        // Clear button
        this.elements.clearBtn.addEventListener('click', async () => {
            const result = await Swal.fire({
                title: 'Clear All Pins',
                text: 'Are you sure you want to clear all pins?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#dc2626',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Yes, clear all!',
                cancelButtonText: 'Cancel'
            });
            
            if (result.isConfirmed) {
                this.tracker.clearAllPins();
                this.render();
                this.updateStats();
                this.updateUnsavedIndicator();
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

        // Pin details modal
        this.elements.cancelPinDetails.addEventListener('click', () => {
            this.hidePinDetailsModal();
        });

        this.elements.pinDetailsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addPinFromModal();
        });

        // Pin details modal outside click
        this.elements.pinDetailsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.pinDetailsModal) {
                this.hidePinDetailsModal();
            }
        });

        // Game filtering controls
        this.elements.selectAllGames.addEventListener('click', () => {
            this.selectAllGames();
        });

        this.elements.deselectAllGames.addEventListener('click', () => {
            this.deselectAllGames();
        });
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
        // View mode feature has been removed - always use 'team' mode
        // Player filtering is now handled by the Player Filter checkboxes
        this.currentViewMode = 'team';

        // Update stats and re-render
        this.updateStats();
        this.render();
    }

    selectAllTeamPlayers(team, selected) {
        const game = this.tracker.getCurrentGame();
        if (!game) return;

        const playerSet = team === 'A' ? this.selectedTeamAPlayers : this.selectedTeamBPlayers;

        // Get all players who have been involved in face-offs for this team
        const pins = game.pins || [];
        const teamPlayerIds = new Set();

        pins.forEach(pin => {
            if (team === 'A') {
                const teamAPlayerId = pin.teamAPlayerId || pin.player1Id;
                if (teamAPlayerId) teamPlayerIds.add(teamAPlayerId);
            } else {
                const teamBPlayerId = pin.teamBPlayerId || pin.player2Id;
                if (teamBPlayerId && teamBPlayerId !== 'unknown') teamPlayerIds.add(teamBPlayerId);
            }
        });

        if (selected) {
            // Add all players to the set
            teamPlayerIds.forEach(id => playerSet.add(id));
        } else {
            // Remove all players from the set
            teamPlayerIds.forEach(id => playerSet.delete(id));
        }

        // Update checkboxes
        const container = team === 'A' ? this.elements.teamAPlayerFilters : this.elements.teamBPlayerFilters;
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = selected);

        // Update stats and re-render
        this.updateStats();
        this.render();
    }

    togglePlayerFilter(playerId, team) {
        const playerSet = team === 'A' ? this.selectedTeamAPlayers : this.selectedTeamBPlayers;

        if (playerSet.has(playerId)) {
            playerSet.delete(playerId);
        } else {
            playerSet.add(playerId);
        }

        // Update stats and re-render
        this.updateStats();
        this.render();
    }

    populatePlayerFilters() {
        const game = this.tracker.getCurrentGame();

        if (!game) {
            this.elements.teamAPlayerFilters.innerHTML = '<p style="font-size: 0.7rem; color: var(--text-secondary); padding: 8px;">No face-offs yet</p>';
            this.elements.teamBPlayerFilters.innerHTML = '<p style="font-size: 0.7rem; color: var(--text-secondary); padding: 8px;">No face-offs yet</p>';
            return;
        }

        // Update team labels
        this.elements.teamAFilterLabel.textContent = `${game.teamA || 'Team A'} Players`;
        this.elements.teamBFilterLabel.textContent = `${game.teamB || 'Team B'} Players`;

        // Get all pins and extract unique players who have been involved in face-offs
        const pins = game.pins || [];

        const teamAPlayerIds = new Set();
        const teamBPlayerIds = new Set();

        pins.forEach(pin => {
            const teamAPlayerId = pin.teamAPlayerId || pin.player1Id;
            const teamBPlayerId = pin.teamBPlayerId || pin.player2Id;

            if (teamAPlayerId) teamAPlayerIds.add(teamAPlayerId);
            if (teamBPlayerId && teamBPlayerId !== 'unknown') teamBPlayerIds.add(teamBPlayerId);
        });

        // Convert sets to arrays and get player objects
        const teamAPlayers = Array.from(teamAPlayerIds)
            .map(id => this.tracker.getPlayerById(id))
            .filter(p => p !== undefined)
            .sort((a, b) => {
                const numA = parseInt(a.number) || 999;
                const numB = parseInt(b.number) || 999;
                return numA - numB;
            });

        const teamBPlayers = Array.from(teamBPlayerIds)
            .map(id => this.tracker.getPlayerById(id))
            .filter(p => p !== undefined)
            .sort((a, b) => {
                const numA = parseInt(a.number) || 999;
                const numB = parseInt(b.number) || 999;
                return numA - numB;
            });

        // Initialize selected players - default all to checked
        teamAPlayers.forEach(p => {
            if (!this.selectedTeamAPlayers.has(p.id)) {
                this.selectedTeamAPlayers.add(p.id);
            }
        });
        teamBPlayers.forEach(p => {
            if (!this.selectedTeamBPlayers.has(p.id)) {
                this.selectedTeamBPlayers.add(p.id);
            }
        });

        // Populate Team A filters
        this.elements.teamAPlayerFilters.innerHTML = '';
        if (teamAPlayers.length === 0) {
            this.elements.teamAPlayerFilters.innerHTML = '<p style="font-size: 0.7rem; color: var(--text-secondary); padding: 8px;">No face-offs yet</p>';
        } else {
            teamAPlayers.forEach(player => {
                const item = document.createElement('div');
                item.className = 'player-filter-item';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `filter-player-a-${player.id}`;
                checkbox.checked = this.selectedTeamAPlayers.has(player.id);
                checkbox.addEventListener('change', () => {
                    this.togglePlayerFilter(player.id, 'A');
                });

                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = `${player.name} (#${player.number})`;

                item.appendChild(checkbox);
                item.appendChild(label);
                this.elements.teamAPlayerFilters.appendChild(item);
            });
        }

        // Populate Team B filters
        this.elements.teamBPlayerFilters.innerHTML = '';
        if (teamBPlayers.length === 0) {
            this.elements.teamBPlayerFilters.innerHTML = '<p style="font-size: 0.7rem; color: var(--text-secondary); padding: 8px;">No face-offs yet</p>';
        } else {
            teamBPlayers.forEach(player => {
                const item = document.createElement('div');
                item.className = 'player-filter-item';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `filter-player-b-${player.id}`;
                checkbox.checked = this.selectedTeamBPlayers.has(player.id);
                checkbox.addEventListener('change', () => {
                    this.togglePlayerFilter(player.id, 'B');
                });

                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = `${player.name} (#${player.number})`;

                item.appendChild(checkbox);
                item.appendChild(label);
                this.elements.teamBPlayerFilters.appendChild(item);
            });
        }
    }

    setStatsTeam(team) {
        this.selectedStatsTeam = team;

        // Update button states
        const toggleTeamA = document.getElementById('toggle-team-a');
        const toggleTeamB = document.getElementById('toggle-team-b');
        if (toggleTeamA && toggleTeamB) {
            toggleTeamA.classList.toggle('active', team === 'A');
            toggleTeamB.classList.toggle('active', team === 'B');
        }

        // Update stats display
        this.updateStats();
    }

    handleCanvasClick(event) {
        if (!this.tracker.currentGameId) {
            Swal.fire({
                title: 'No Game Selected',
                text: 'Please create a game first!',
                icon: 'info',
                confirmButtonColor: '#FFFFFF', confirmButtonTextColor: '#000000'
            });
            return;
        }

        // Don't allow pins on Cumulative Folders
        const currentGame = this.tracker.getCurrentGame();
        if (currentGame && currentGame.isCumulativeFolder) {
            Swal.fire({
                title: 'Cannot Add Pins',
                text: 'This is a read-only cumulative view. Select a regular game to add pins.',
                icon: 'info',
                confirmButtonColor: '#FFFFFF'
            });
            return;
        }

        // Store click coordinates for later use
        this.pendingPinCoords = this.fieldRenderer.getClickCoordinates(event);
        
        // Show pin details modal
        this.showPinDetailsModal();
    }

    showNewGameModal() {
        // Set default date to today
        document.getElementById('game-date').valueAsDate = new Date();

        // Setup autocomplete for team inputs
        this.setupTeamAutocomplete('team-a-name');
        this.setupTeamAutocomplete('team-b-name');

        this.elements.modal.classList.add('show');
    }

    setupTeamAutocomplete(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;

        // Check if already initialized
        if (input.dataset.autocompleteInitialized === 'true') {
            return;
        }
        input.dataset.autocompleteInitialized = 'true';

        // Create autocomplete container if it doesn't exist
        let autocompleteContainer = document.getElementById(`${inputId}-autocomplete`);
        if (!autocompleteContainer) {
            autocompleteContainer = document.createElement('div');
            autocompleteContainer.id = `${inputId}-autocomplete`;
            autocompleteContainer.className = 'autocomplete-dropdown';
            input.parentNode.style.position = 'relative';
            input.parentNode.appendChild(autocompleteContainer);
        }

        // Handle input changes
        const handleInput = () => {
            const query = input.value.trim();

            if (query.length === 0) {
                autocompleteContainer.innerHTML = '';
                autocompleteContainer.style.display = 'none';
                return;
            }

            const results = searchSchools(query);

            if (results.length === 0) {
                autocompleteContainer.innerHTML = '<div class="autocomplete-item no-results">No matches found</div>';
                autocompleteContainer.style.display = 'block';
                return;
            }

            // Limit to top 8 results
            const limitedResults = results.slice(0, 8);

            autocompleteContainer.innerHTML = limitedResults.map(school => `
                <div class="autocomplete-item" data-school-name="${school.name}">
                    <div class="autocomplete-school-name">${school.name}</div>
                    <div class="autocomplete-school-details">${school.city} • ${school.conference}</div>
                </div>
            `).join('');

            autocompleteContainer.style.display = 'block';

            // Add click handlers for each item
            autocompleteContainer.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    const schoolName = item.dataset.schoolName;
                    if (schoolName) {
                        input.value = schoolName;
                        autocompleteContainer.innerHTML = '';
                        autocompleteContainer.style.display = 'none';
                    }
                });
            });
        };

        input.addEventListener('input', handleInput);

        // Close dropdown when clicking outside
        const closeDropdown = (e) => {
            if (!input.contains(e.target) && !autocompleteContainer.contains(e.target)) {
                autocompleteContainer.innerHTML = '';
                autocompleteContainer.style.display = 'none';
            }
        };

        document.addEventListener('click', closeDropdown);
    }

    hideNewGameModal() {
        this.elements.modal.classList.remove('show');
        this.elements.newGameForm.reset();
    }

    async createNewGame() {
        const teamA = document.getElementById('team-a-name').value;
        const teamB = document.getElementById('team-b-name').value;
        const date = document.getElementById('game-date').value;
        const notes = document.getElementById('game-notes').value;

        // Pass selectedFolderId to auto-file the game in the selected folder
        await this.tracker.createGame(teamA, teamB, date, notes, this.selectedFolderId);

        // Auto-add FOGO players from both teams
        const currentGame = this.tracker.getCurrentGame();
        if (currentGame) {
            // Load Team A roster and add FOGOs (accept both "FOGO" and "FO")
            const teamARoster = await this.loadTeamRoster(teamA);
            const teamAFogos = teamARoster.filter(p => p.position === 'FOGO' || p.position === 'FO');
            for (const fogo of teamAFogos) {
                await this.addRosterPlayerToGame(fogo, 'A');
            }

            // Load Team B roster and add FOGOs (accept both "FOGO" and "FO")
            const teamBRoster = await this.loadTeamRoster(teamB);
            const teamBFogos = teamBRoster.filter(p => p.position === 'FOGO' || p.position === 'FO');
            for (const fogo of teamBFogos) {
                await this.addRosterPlayerToGame(fogo, 'B');
            }
        }

        this.hideNewGameModal();
        this.updateUI();
    }

    showNewFolderModal() {
        this.elements.newFolderModal.style.display = 'flex';
        document.getElementById('folder-name').focus();
    }

    hideNewFolderModal() {
        this.elements.newFolderModal.style.display = 'none';
        this.elements.newFolderForm.reset();
    }

    async createNewFolder() {
        const name = document.getElementById('folder-name').value.trim();
        const hasCumulativeTracker = document.getElementById('folder-cumulative-tracker').checked;

        if (!name) {
            Swal.fire({
                title: 'Missing Folder Name',
                text: 'Please enter a folder name',
                icon: 'warning',
                confirmButtonColor: '#FFFFFF'
            });
            return;
        }

        try {
            await this.tracker.createFolder(name, hasCumulativeTracker);
            this.hideNewFolderModal();
            this.updateUI();

            Swal.fire({
                title: 'Folder Created!',
                text: `"${name}" has been created`,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Error creating folder:', error);
            Swal.fire({
                title: 'Error',
                text: 'Failed to create folder',
                icon: 'error',
                confirmButtonColor: '#FFFFFF'
            });
        }
    }

    showStatsModal() {
        const currentGame = this.tracker.getCurrentGame();
        if (!currentGame) {
            Swal.fire({
                title: 'No Game Selected',
                text: 'Please select a game to view statistics.',
                icon: 'info',
                confirmButtonColor: '#FFFFFF'
            });
            return;
        }

        // Calculate and render statistics
        this.renderStatsTable(currentGame);
        this.elements.statsModal.style.display = 'flex';
    }

    hideStatsModal() {
        this.elements.statsModal.style.display = 'none';
    }

    renderStatsTable(game) {
        const container = this.elements.statsTableContainer;

        // Check if game has pins
        if (!game.pins || game.pins.length === 0) {
            container.innerHTML = `
                <div class="no-stats-message">
                    <p>No statistics available</p>
                    <p class="hint">Add face-off pins to see statistics</p>
                </div>
            `;
            document.getElementById('stats-total-count').textContent = '';
            return;
        }

        // Calculate statistics for each player
        const stats = this.calculatePlayerStats(game);

        // Update total count
        const totalFaceoffs = game.pins.length;
        document.getElementById('stats-total-count').textContent = `Total Face-Offs: ${totalFaceoffs}`;

        // Build table HTML
        let tableHTML = `
            <table class="stats-table">
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>#</th>
                        <th>FO Wins</th>
                        <th>FO Losses</th>
                        <th>FO %</th>
                        <th>Adj FO %</th>
                        <th>Clamp Wins</th>
                        <th>Clamp Losses</th>
                        <th>Clamp %</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Group players by team
        const teamAStats = stats.filter(s => s.team === 'A');
        const teamBStats = stats.filter(s => s.team === 'B');

        // Render Team A
        if (teamAStats.length > 0) {
            teamAStats.forEach(playerStat => {
                tableHTML += this.renderPlayerRow(playerStat);
            });
            tableHTML += this.renderTeamSubtotal(game.teamA, teamAStats);
        }

        // Render Team B
        if (teamBStats.length > 0) {
            teamBStats.forEach(playerStat => {
                tableHTML += this.renderPlayerRow(playerStat);
            });
            tableHTML += this.renderTeamSubtotal(game.teamB, teamBStats);
        }

        tableHTML += `
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;
    }

    calculatePlayerStats(game) {
        const playerStatsMap = new Map();

        // Initialize stats for all players in the roster
        if (game.roster) {
            game.roster.forEach(rosterEntry => {
                const player = this.tracker.players.find(p => p.id === rosterEntry.playerId);
                if (player) {
                    playerStatsMap.set(player.id, {
                        player: player,
                        team: rosterEntry.team,
                        foWins: 0,
                        foLosses: 0,
                        clampWins: 0,
                        clampLosses: 0,
                        convertedLosses: 0,
                        convertedWins: 0
                    });
                }
            });
        }

        // Count stats from pins
        game.pins.forEach(pin => {
            const teamAPlayerId = pin.teamAPlayerId;
            const teamBPlayerId = pin.teamBPlayerId;
            const winnerId = pin.faceoffWinnerId;
            const clampWinnerId = pin.clampWinnerId;

            // Face-off wins/losses (count both violation types)
            if (winnerId === teamAPlayerId) {
                if (playerStatsMap.has(teamAPlayerId)) {
                    playerStatsMap.get(teamAPlayerId).foWins++;
                }
                if (playerStatsMap.has(teamBPlayerId)) {
                    playerStatsMap.get(teamBPlayerId).foLosses++;
                }
            } else if (winnerId === teamBPlayerId) {
                if (playerStatsMap.has(teamBPlayerId)) {
                    playerStatsMap.get(teamBPlayerId).foWins++;
                }
                if (playerStatsMap.has(teamAPlayerId)) {
                    playerStatsMap.get(teamAPlayerId).foLosses++;
                }
            }

            // Converted losses (winner quickly turned ball over)
            if (pin.isConvertedLoss && winnerId) {
                // Winner loses an adjusted win
                if (playerStatsMap.has(winnerId)) {
                    playerStatsMap.get(winnerId).convertedLosses++;
                }
                // Loser gains an adjusted win
                const loserId = winnerId === teamAPlayerId ? teamBPlayerId : teamAPlayerId;
                if (playerStatsMap.has(loserId)) {
                    playerStatsMap.get(loserId).convertedWins++;
                }
            }

            // Clamp wins/losses (only if not a whistle violation)
            if (!pin.isWhistleViolation && clampWinnerId) {
                if (clampWinnerId === teamAPlayerId) {
                    if (playerStatsMap.has(teamAPlayerId)) {
                        playerStatsMap.get(teamAPlayerId).clampWins++;
                    }
                    if (playerStatsMap.has(teamBPlayerId)) {
                        playerStatsMap.get(teamBPlayerId).clampLosses++;
                    }
                } else if (clampWinnerId === teamBPlayerId) {
                    if (playerStatsMap.has(teamBPlayerId)) {
                        playerStatsMap.get(teamBPlayerId).clampWins++;
                    }
                    if (playerStatsMap.has(teamAPlayerId)) {
                        playerStatsMap.get(teamAPlayerId).clampLosses++;
                    }
                }
            }
        });

        // Convert to array and calculate percentages
        const statsArray = Array.from(playerStatsMap.values()).map(stat => {
            const foTotal = stat.foWins + stat.foLosses;
            const clampTotal = stat.clampWins + stat.clampLosses;
            const adjWins = stat.foWins - stat.convertedLosses + stat.convertedWins;

            return {
                ...stat,
                foPercentage: foTotal > 0 ? ((stat.foWins / foTotal) * 100).toFixed(1) : '0.0',
                adjFoPercentage: foTotal > 0 ? ((adjWins / foTotal) * 100).toFixed(1) : '0.0',
                clampPercentage: clampTotal > 0 ? ((stat.clampWins / clampTotal) * 100).toFixed(1) : '0.0'
            };
        });

        // Sort by team, then by number
        return statsArray.sort((a, b) => {
            if (a.team !== b.team) return a.team.localeCompare(b.team);
            const numA = parseInt(a.player.number) || 999;
            const numB = parseInt(b.player.number) || 999;
            return numA - numB;
        });
    }

    renderPlayerRow(playerStat) {
        const { player, foWins, foLosses, foPercentage, adjFoPercentage, clampWins, clampLosses, clampPercentage } = playerStat;

        return `
            <tr>
                <td>${player.name}</td>
                <td>${player.number || '-'}</td>
                <td>${foWins}</td>
                <td>${foLosses}</td>
                <td>${foPercentage}%</td>
                <td>${adjFoPercentage}%</td>
                <td>${clampWins}</td>
                <td>${clampLosses}</td>
                <td>${clampPercentage}%</td>
            </tr>
        `;
    }

    renderTeamSubtotal(teamName, teamStats) {
        // Sum up team totals
        const totals = teamStats.reduce((acc, stat) => {
            acc.foWins += stat.foWins;
            acc.foLosses += stat.foLosses;
            acc.clampWins += stat.clampWins;
            acc.clampLosses += stat.clampLosses;
            acc.convertedLosses += stat.convertedLosses;
            acc.convertedWins += stat.convertedWins;
            return acc;
        }, { foWins: 0, foLosses: 0, clampWins: 0, clampLosses: 0, convertedLosses: 0, convertedWins: 0 });

        const foTotal = totals.foWins + totals.foLosses;
        const clampTotal = totals.clampWins + totals.clampLosses;
        const foPercentage = foTotal > 0 ? ((totals.foWins / foTotal) * 100).toFixed(1) : '0.0';
        const adjWins = totals.foWins - totals.convertedLosses + totals.convertedWins;
        const adjFoPercentage = foTotal > 0 ? ((adjWins / foTotal) * 100).toFixed(1) : '0.0';
        const clampPercentage = clampTotal > 0 ? ((totals.clampWins / clampTotal) * 100).toFixed(1) : '0.0';

        // Get team color
        const teamColor = getTeamColor(teamName);
        const styleAttr = teamColor ? ` style="background-color: ${this.hexToRGBA(teamColor, 0.15)};"` : '';

        return `
            <tr class="team-subtotal"${styleAttr}>
                <td>${teamName} Total</td>
                <td>-</td>
                <td>${totals.foWins}</td>
                <td>${totals.foLosses}</td>
                <td>${foPercentage}%</td>
                <td>${adjFoPercentage}%</td>
                <td>${totals.clampWins}</td>
                <td>${totals.clampLosses}</td>
                <td>${clampPercentage}%</td>
            </tr>
        `;
    }

    hexToRGBA(hex, alpha) {
        // Remove # if present
        hex = hex.replace('#', '');

        // Parse hex values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    showAddToRosterModal() {
        const currentGame = this.tracker.getCurrentGame();
        if (!currentGame || currentGame.id === this.tracker.SEASON_TOTAL_ID) {
            Swal.fire({
                title: 'No Game Selected',
                text: 'Please select a specific game first.',
                icon: 'info',
                confirmButtonColor: '#FFFFFF', confirmButtonTextColor: '#000000'
            });
            return;
        }

        // Initialize team selection
        this.selectedTeam = 'A';

        // Update team button labels with actual team names
        const teamABtn = document.getElementById('select-team-a');
        const teamBBtn = document.getElementById('select-team-b');
        teamABtn.textContent = currentGame.teamA || 'Team A';
        teamBBtn.textContent = currentGame.teamB || 'Team B';

        // Get team colors (with conflict resolution)
        const teamAColor = getTeamColor(currentGame.teamA, 'A', currentGame.teamB);
        const teamBColor = getTeamColor(currentGame.teamB, 'B', currentGame.teamA);

        // Store colors for later use
        teamABtn.dataset.teamColor = teamAColor || '';
        teamBBtn.dataset.teamColor = teamBColor || '';

        // Set initial active state with team colors
        teamABtn.classList.add('active');
        teamBBtn.classList.remove('active');
        if (teamAColor) {
            teamABtn.style.backgroundColor = teamAColor;
            teamABtn.style.borderColor = teamAColor;
        }

        // Add event listeners for team buttons
        teamABtn.onclick = () => {
            this.selectedTeam = 'A';
            teamABtn.classList.add('active');
            teamBBtn.classList.remove('active');

            // Apply team colors
            if (teamAColor) {
                teamABtn.style.backgroundColor = teamAColor;
                teamABtn.style.borderColor = teamAColor;
            }
            teamBBtn.style.backgroundColor = '';
            teamBBtn.style.borderColor = '';

            this.updateAvailablePlayersList(this.elements.playerSearch.value);
        };

        teamBBtn.onclick = () => {
            this.selectedTeam = 'B';
            teamBBtn.classList.add('active');
            teamABtn.classList.remove('active');

            // Apply team colors
            if (teamBColor) {
                teamBBtn.style.backgroundColor = teamBColor;
                teamBBtn.style.borderColor = teamBColor;
            }
            teamABtn.style.backgroundColor = '';
            teamABtn.style.borderColor = '';

            this.updateAvailablePlayersList(this.elements.playerSearch.value);
        };

        this.elements.playerSearch.value = '';
        this.updateAvailablePlayersList();
        this.elements.rosterModal.classList.add('show');
    }

    hideAddToRosterModal() {
        this.elements.rosterModal.classList.remove('show');
        this.elements.playerSearch.value = '';
    }

    async updateAvailablePlayersList(searchTerm = '') {
        const container = this.elements.availablePlayersList;
        const currentGame = this.tracker.getCurrentGame();

        if (!currentGame) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No game selected</p>';
            return;
        }

        // Show loading state
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Loading roster...</p>';

        // Get the team name for the selected team
        const teamName = this.selectedTeam === 'A' ? currentGame.teamA : currentGame.teamB;

        // Load roster data from JSON file
        const rosterPlayers = await this.loadTeamRoster(teamName);

        if (!rosterPlayers || rosterPlayers.length === 0) {
            container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No roster found for ${teamName}.<br>Please add players manually.</p>`;
            return;
        }

        const roster = currentGame.roster || [];

        // Get the player IDs that are already in the roster for this team
        const rosterPlayerIds = roster
            .filter(r => {
                if (typeof r === 'string') return false; // Old format
                return r.team === this.selectedTeam;
            })
            .map(r => r.playerId);

        // Get the actual player objects from the tracker for comparison
        const rosterPlayers_inGame = rosterPlayerIds
            .map(id => this.tracker.players.find(p => p.id === id))
            .filter(p => p); // Remove any nulls

        // Filter out players already in roster for the selected team
        // Match by name, number, and team (not by ID, since roster JSON IDs differ from tracker IDs)
        let availablePlayers = rosterPlayers.filter(p => {
            const alreadyInRoster = rosterPlayers_inGame.some(rp =>
                rp.name === p.name &&
                rp.number === p.number &&
                rp.team === p.team
            );
            return !alreadyInRoster;
        });

        // Filter by search term
        if (searchTerm.trim()) {
            const search = searchTerm.toLowerCase();
            availablePlayers = availablePlayers.filter(player =>
                player.name.toLowerCase().includes(search) ||
                (player.number && player.number.toString().includes(search)) ||
                (player.position && player.position.toLowerCase().includes(search))
            );
        }

        // Sort players: FOGOs first, then by jersey number
        availablePlayers.sort((a, b) => {
            // First priority: FOGO position (accept both "FOGO" and "FO")
            const aIsFOGO = a.position === 'FOGO' || a.position === 'FO';
            const bIsFOGO = b.position === 'FOGO' || b.position === 'FO';

            if (aIsFOGO && !bIsFOGO) return -1;
            if (!aIsFOGO && bIsFOGO) return 1;

            // Second priority: Jersey number
            const aNum = parseInt(a.number) || 999;
            const bNum = parseInt(b.number) || 999;
            return aNum - bNum;
        });

        if (availablePlayers.length === 0) {
            if (searchTerm.trim()) {
                container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No players found matching your search.</p>';
            } else {
                container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 20px;">All ${teamName} players are already in the game roster.</p>`;
            }
            return;
        }

        container.innerHTML = '';
        availablePlayers.forEach(player => {
            const item = document.createElement('div');
            item.className = 'available-player-item';

            const displayName = player.number ? `#${player.number} ${player.name}` : player.name;
            const positionBadge = player.position ?
                `<span class="position-badge ${(player.position === 'FOGO' || player.position === 'FO') ? 'fogo-badge' : ''}">${player.position}</span>` : '';

            item.innerHTML = `
                <div class="available-player-info">
                    <div class="available-player-name">${displayName} ${positionBadge}</div>
                    <div class="available-player-team">${player.team}</div>
                </div>
                <button class="btn-add-to-roster" data-player-json='${JSON.stringify(player)}'>Add to Game</button>
            `;

            const addBtn = item.querySelector('.btn-add-to-roster');
            addBtn.addEventListener('click', async () => {
                const playerData = JSON.parse(addBtn.getAttribute('data-player-json'));
                await this.addRosterPlayerToGame(playerData, this.selectedTeam);
                this.updateRosterList();
                this.updatePlayerViewList();
                this.updateAvailablePlayersList();
                this.updateUnsavedIndicator();
            });

            container.appendChild(item);
        });
    }

    async loadTeamRoster(teamName) {
        if (!teamName) return [];

        // Convert team name to filename format (e.g., "Princeton University" -> "Princeton.json")
        const fileName = this.teamNameToFileName(teamName);
        const rosterPath = `Rosters/${fileName}`;

        try {
            const response = await fetch(rosterPath);
            if (!response.ok) {
                console.warn(`Roster file not found: ${rosterPath}`);
                return [];
            }

            const rosterData = await response.json();

            // Ensure each player has an ID (use name+number as unique ID if not present)
            return (rosterData.players || []).map(p => ({
                ...p,
                id: p.id || `${teamName}-${p.number}-${p.name.replace(/\s+/g, '-')}`
            }));
        } catch (error) {
            console.error(`Error loading roster for ${teamName}:`, error);
            return [];
        }
    }

    teamNameToFileName(teamName) {
        // Mapping of full team names to their roster file names
        const teamFileMap = {
            'Bellarmine University': 'Bellarmine.json',
            'Boston University': 'Boston.json',
            'Brown University': 'Brown.json',
            'Bryant University': 'Bryant.json',
            'Bucknell University': 'Bucknell.json',
            'Canisius College': 'Canisius.json',
            'Cleveland State University': 'ClevelandState.json',
            'Colgate University': 'Colgate.json',
            'College of the Holy Cross': 'HolyCross.json',
            'Cornell University': 'Cornell.json',
            'Dartmouth College': 'Dartmouth.json',
            'Drexel University': 'Drexel.json',
            'Duke University': 'Duke.json',
            'Fairfield University': 'Fairfield.json',
            'Georgetown University': 'Georgetown.json',
            'Hampton University': 'Hampton.json',
            'Harvard University': 'Harvard.json',
            'High Point University': 'HighPoint.json',
            'Hobart & William Smith College': 'Hobart.json',
            'Hofstra University': 'Hofstra.json',
            'Iona University': 'Iona.json',
            'Jacksonville University': 'Jacksonville.json',
            'Johns Hopkins University': 'JohnsHopkins.json',
            'Lafayette College': 'Lafayette.json',
            'Lehigh University': 'Lehigh.json',
            'Lindenwood University': 'Lindenwood.json',
            'Long Island University': 'LongIsland.json',
            'Loyola University Maryland': 'Loyola.json',
            'Manhattan College': 'Manhattan.json',
            'Marist College': 'Marist.json',
            'Marquette University': 'Marquette.json',
            'Mercer University': 'Mercer.json',
            'Merrimack College': 'Merrimack.json',
            'Monmouth University': 'Monmouth.json',
            "Mount St. Mary's University": 'MountStMarys.json',
            'New Jersey Institute of Technology': 'NJIT.json',
            'Ohio State University': 'OhioState.json',
            'Penn State': 'PennState.json',
            'Penn State University': 'PennState.json',
            'Princeton University': 'Princeton.json',
            'Providence College': 'Providence.json',
            'Queens University of Charlotte': 'Queens.json',
            'Quinnipiac University': 'Quinnipiac.json',
            'Robert Morris University': 'RobertMorris.json',
            'Rutgers University': 'Rutgers.json',
            'Sacred Heart University': 'SacredHeart.json',
            "Saint Joseph's University": 'SaintJosephs.json',
            'Siena College': 'Siena.json',
            'St. Bonaventure University': 'StBonaventure.json',
            "St. John's University": 'StJohns.json',
            'SUNY Binghamton University': 'Binghamton.json',
            'SUNY Stony Brook University': 'StonyBrook.json',
            'SUNY University at Albany': 'Albany.json',
            'Syracuse University': 'Syracuse.json',
            'Towson University': 'Towson.json',
            'United States Air Force Academy': 'AirForce.json',
            'United States Military Academy': 'Army.json',
            'United States Naval Academy': 'Navy.json',
            'University of Delaware': 'Delaware.json',
            'University of Denver': 'Denver.json',
            'University of Detroit Mercy': 'DetroitMercy.json',
            'University of Maryland': 'Maryland.json',
            'University of Maryland – Baltimore County': 'UMBC.json',
            'University of Massachusetts – Amherst': 'UMassAmherst.json',
            'University of Massachusetts – Lowell': 'UMassLowell.json',
            'University of Michigan': 'Michigan.json',
            'University of North Carolina at Chapel Hill': 'NorthCarolina.json',
            'University of Notre Dame': 'NotreDame.json',
            'University of Pennsylvania': 'Penn.json',
            'University of Richmond': 'Richmond.json',
            'University of Utah': 'Utah.json',
            'University of Vermont': 'Vermont.json',
            'University of Virginia': 'Virginia.json',
            'Villanova University': 'Villanova.json',
            'Virginia Military Institute': 'VMI.json',
            'Wagner College': 'Wagner.json',
            'Yale University': 'Yale.json'
        };

        return teamFileMap[teamName] || `${teamName.replace(/[^a-zA-Z0-9]/g, '')}.json`;
    }

    async addRosterPlayerToGame(playerData, team) {
        // Check if player exists in global database
        let existingPlayer = this.tracker.players.find(p =>
            p.name === playerData.name &&
            p.number === playerData.number &&
            p.team === playerData.team
        );

        // If player doesn't exist, add them to the database
        if (!existingPlayer) {
            existingPlayer = await this.tracker.addPlayer(
                playerData.name,
                playerData.number,
                playerData.team,
                playerData.position || ''
            );
        }

        // Add player to game roster
        const currentGame = this.tracker.getCurrentGame();
        if (currentGame && existingPlayer) {
            this.tracker.addPlayerToRoster(currentGame.id, existingPlayer.id, team);
        }
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
            this.tracker.addPlayerToRoster(currentGame.id, player.id);
        }
        
        this.hideAddPlayerModal();
        this.updateRosterList();
        this.updateUnsavedIndicator();
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

    showPinDetailsModal() {
        const currentGame = this.tracker.getCurrentGame();
        if (!currentGame) return;

        // Reset form
        this.elements.pinDetailsForm.reset();

        // Explicitly reset violation checkboxes (should NOT remember violations from previous pin)
        const whistleViolationCheckbox = document.getElementById('pin-whistle-violation-checkbox');
        const postWhistleViolationCheckbox = document.getElementById('pin-post-whistle-violation-checkbox');
        const convertedLossCheckbox = document.getElementById('pin-converted-loss-checkbox');
        whistleViolationCheckbox.checked = false;
        postWhistleViolationCheckbox.checked = false;
        convertedLossCheckbox.checked = false;
        convertedLossCheckbox.disabled = false;

        // Ensure clamp winner section is always visible on open (default state)
        const clampWinnerSection = document.getElementById('clamp-winner-section');
        clampWinnerSection.style.display = 'block';
        document.querySelector('input[name="clamp-winner"][value="teamA"]').setAttribute('required', '');

        // Set modal title and subtitle
        document.getElementById('pin-modal-title').textContent = `${currentGame.teamA} vs ${currentGame.teamB}`;
        document.getElementById('pin-modal-subtitle').textContent = 'Record face-off details';

        // Update team labels
        document.getElementById('team-a-player-label').textContent = `${currentGame.teamA} Player:`;
        document.getElementById('team-b-player-label').textContent = `${currentGame.teamB} Player:`;

        // Set default winner labels
        document.getElementById('faceoff-team-a-label').textContent = `${currentGame.teamA} Player`;
        document.getElementById('faceoff-team-b-label').textContent = `${currentGame.teamB} Player`;
        document.getElementById('clamp-team-a-label').textContent = `${currentGame.teamA} Player`;
        document.getElementById('clamp-team-b-label').textContent = `${currentGame.teamB} Player`;

        // Update player selects
        this.updatePinDetailsPlayerSelects();

        // Set up event listeners to update winner labels when players are selected
        const teamASelect = document.getElementById('team-a-player-select');
        const teamBSelect = document.getElementById('team-b-player-select');

        teamASelect.onchange = () => {
            const player = this.tracker.players.find(p => p.id === teamASelect.value);
            if (player) {
                const displayName = player.number ? `${player.name} (#${player.number})` : player.name;
                document.getElementById('faceoff-team-a-label').textContent = displayName;
                document.getElementById('clamp-team-a-label').textContent = displayName;
            } else {
                document.getElementById('faceoff-team-a-label').textContent = `${currentGame.teamA} Player`;
                document.getElementById('clamp-team-a-label').textContent = `${currentGame.teamA} Player`;
            }
        };

        teamBSelect.onchange = () => {
            const player = this.tracker.players.find(p => p.id === teamBSelect.value);
            if (player) {
                const displayName = player.number ? `${player.name} (#${player.number})` : player.name;
                document.getElementById('faceoff-team-b-label').textContent = displayName;
                document.getElementById('clamp-team-b-label').textContent = displayName;
            } else if (teamBSelect.value === 'unknown') {
                document.getElementById('faceoff-team-b-label').textContent = 'Unknown Player';
                document.getElementById('clamp-team-b-label').textContent = 'Unknown Player';
            } else {
                document.getElementById('faceoff-team-b-label').textContent = `${currentGame.teamB} Player`;
                document.getElementById('clamp-team-b-label').textContent = `${currentGame.teamB} Player`;
            }
        };

        // Handle violation checkboxes to show/hide clamp winner section
        // (Variables already defined above after form reset)

        // Whistle violation hides clamp (no faceoff occurred)
        whistleViolationCheckbox.onchange = () => {
            if (whistleViolationCheckbox.checked) {
                // Uncheck post-whistle if whistle is checked (mutually exclusive)
                postWhistleViolationCheckbox.checked = false;

                // Disable converted loss (no faceoff = no converted loss possible)
                convertedLossCheckbox.checked = false;
                convertedLossCheckbox.disabled = true;

                clampWinnerSection.style.display = 'none';
                // Remove required attribute from clamp winner radios when hidden
                document.querySelectorAll('input[name="clamp-winner"]').forEach(radio => {
                    radio.removeAttribute('required');
                });
            } else {
                convertedLossCheckbox.disabled = false;

                clampWinnerSection.style.display = 'block';
                // Re-add required attribute when visible
                document.querySelector('input[name="clamp-winner"][value="teamA"]').setAttribute('required', '');
            }
        };

        // Post-whistle violation keeps clamp visible (faceoff occurred)
        postWhistleViolationCheckbox.onchange = () => {
            if (postWhistleViolationCheckbox.checked) {
                // Uncheck whistle if post-whistle is checked (mutually exclusive)
                whistleViolationCheckbox.checked = false;

                // Ensure clamp section is visible
                clampWinnerSection.style.display = 'block';
                document.querySelector('input[name="clamp-winner"][value="teamA"]').setAttribute('required', '');
            }
        };

        // Show modal
        this.elements.pinDetailsModal.classList.add('show');
    }

    hidePinDetailsModal() {
        this.elements.pinDetailsModal.classList.remove('show');
        this.pendingPinCoords = null;
    }

    setFaceoffResult(result) {
        this.selectedFaceoffResult = result;
        
        // Update button states
        this.elements.faceoffWinBtn.classList.toggle('active', result === 'win');
        this.elements.faceoffLossBtn.classList.toggle('active', result === 'loss');
    }

    setClampResult(result) {
        this.selectedClampResult = result;
        
        // Update button states
        this.elements.clampWinBtn.classList.toggle('active', result === 'win');
        this.elements.clampLossBtn.classList.toggle('active', result === 'loss');
    }

    updatePinDetailsPlayerSelects() {
        const currentGame = this.tracker.getCurrentGame();
        const teamASelect = document.getElementById('team-a-player-select');
        const teamBSelect = document.getElementById('team-b-player-select');

        if (!currentGame || currentGame.id === this.tracker.SEASON_TOTAL_ID) {
            teamASelect.innerHTML = '<option value="">No game selected</option>';
            teamBSelect.innerHTML = '<option value="">No game selected</option>';
            return;
        }

        const rosterPlayers = this.tracker.getGameRoster(currentGame.id);

        if (rosterPlayers.length === 0) {
            teamASelect.innerHTML = '<option value="">No players in roster</option>';
            teamBSelect.innerHTML = '<option value="">No players in roster</option>';
            return;
        }

        // Separate players by team
        const teamAPlayers = rosterPlayers.filter(p => p.gameTeam === 'A');
        const teamBPlayers = rosterPlayers.filter(p => p.gameTeam === 'B');

        // Build Team A dropdown
        teamASelect.innerHTML = '<option value="">Select Player</option>';
        teamAPlayers.forEach(player => {
            const option = document.createElement('option');
            option.value = player.id;
            const displayText = player.number
                ? `#${player.number} ${player.name}`
                : player.name;
            option.textContent = displayText;
            teamASelect.appendChild(option);
        });

        // Build Team B dropdown with "Unknown" option
        teamBSelect.innerHTML = '<option value="">Select Player</option>';
        teamBSelect.innerHTML += '<option value="unknown">Unknown</option>';
        teamBPlayers.forEach(player => {
            const option = document.createElement('option');
            option.value = player.id;
            const displayText = player.number
                ? `#${player.number} ${player.name}`
                : player.name;
            option.textContent = displayText;
            teamBSelect.appendChild(option);
        });

        // Auto-fill with last selected players
        if (this.lastTeamAPlayer && teamAPlayers.some(p => p.id === this.lastTeamAPlayer)) {
            teamASelect.value = this.lastTeamAPlayer;
            // Trigger change event to update labels
            if (teamASelect.onchange) teamASelect.onchange();
        }
        if (this.lastTeamBPlayer) {
            const isInTeamB = teamBPlayers.some(p => p.id === this.lastTeamBPlayer) || this.lastTeamBPlayer === 'unknown';
            if (isInTeamB) {
                teamBSelect.value = this.lastTeamBPlayer;
                // Trigger change event to update labels
                if (teamBSelect.onchange) teamBSelect.onchange();
            }
        }
    }

    addPinFromModal() {
        const teamAPlayerId = document.getElementById('team-a-player-select').value;
        const teamBPlayerId = document.getElementById('team-b-player-select').value;

        if (!teamAPlayerId || !teamBPlayerId) {
            Swal.fire({
                title: 'Missing Players',
                text: 'Please select players from both teams.',
                icon: 'warning',
                confirmButtonColor: '#FFFFFF', confirmButtonTextColor: '#000000'
            });
            return;
        }

        // Check violation types and converted loss
        const whistleViolationCheckbox = document.getElementById('pin-whistle-violation-checkbox');
        const postWhistleViolationCheckbox = document.getElementById('pin-post-whistle-violation-checkbox');
        const convertedLossCheckbox = document.getElementById('pin-converted-loss-checkbox');
        const isWhistleViolation = whistleViolationCheckbox.checked;
        const isPostWhistleViolation = postWhistleViolationCheckbox.checked;
        const isConvertedLoss = convertedLossCheckbox.checked;

        // Get winner selections
        const faceoffWinnerRadio = document.querySelector('input[name="faceoff-winner"]:checked');

        if (!faceoffWinnerRadio) {
            Swal.fire({
                title: 'Missing Winner Selection',
                text: 'Please select who won the face-off.',
                icon: 'warning',
                confirmButtonColor: '#FFFFFF', confirmButtonTextColor: '#000000'
            });
            return;
        }

        const faceoffWinner = faceoffWinnerRadio.value;
        const faceoffWinnerId = faceoffWinner === 'teamA' ? teamAPlayerId : teamBPlayerId;

        let clampWinnerId = null;

        // Only require clamp winner if not a whistle violation (no faceoff occurred)
        if (!isWhistleViolation) {
            const clampWinnerRadio = document.querySelector('input[name="clamp-winner"]:checked');

            if (!clampWinnerRadio) {
                Swal.fire({
                    title: 'Missing Clamp Winner',
                    text: 'Please select who won the clamp.',
                    icon: 'warning',
                    confirmButtonColor: '#FFFFFF', confirmButtonTextColor: '#000000'
                });
                return;
            }

            const clampWinner = clampWinnerRadio.value;
            clampWinnerId = clampWinner === 'teamA' ? teamAPlayerId : teamBPlayerId;
        }

        // Add the pin with the new structure
        this.tracker.addPin(
            this.pendingPinCoords.x,
            this.pendingPinCoords.y,
            teamAPlayerId,
            teamBPlayerId,
            faceoffWinnerId,
            clampWinnerId,
            isWhistleViolation,
            isPostWhistleViolation,
            isConvertedLoss
        );

        // Save the selected players for auto-fill next time
        this.lastTeamAPlayer = teamAPlayerId;
        this.lastTeamBPlayer = teamBPlayerId;

        // Update UI
        this.render();
        this.updateStats();
        this.populatePlayerFilters();
        this.updateUnsavedIndicator();

        // Hide modal
        this.hidePinDetailsModal();
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
        const wins = playerPins.filter(p => {
            const faceoffResult = p.faceoffResult || p.type || 'win';
            return faceoffResult === 'win';
        }).length;
        const losses = playerPins.filter(p => {
            const faceoffResult = p.faceoffResult || p.type || 'win';
            return faceoffResult === 'loss';
        }).length;
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
                const playerPins = game.pins.filter(pin => 
                    pin.player1Id === playerId || pin.player2Id === playerId || pin.playerId === playerId
                );
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

        // Count total pins for this player
        const allPins = this.getAllPinsForPlayer(playerId);
        const pinCount = allPins.length;
        
        const confirmMsg = pinCount > 0
            ? `Are you sure you want to delete <strong>${displayName}</strong>?<br><br>This will permanently remove this player and delete all <strong>${pinCount}</strong> face-off data point(s) associated with them across all games.`
            : `Are you sure you want to delete <strong>${displayName}</strong>?<br><br>This will permanently remove this player.`;

        const result = await Swal.fire({
            title: 'Delete Player',
            html: confirmMsg,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, delete player!',
            cancelButtonText: 'Cancel'
        });
        
        if (result.isConfirmed) {
            await this.tracker.deletePlayer(playerId);
            
            // Reset view to team if we're viewing the removed player
            if (this.currentViewMode === playerId) {
                this.setViewMode('team');
            }
            
            // Reset current player if it was the removed player
            if (this.tracker.currentPlayer === playerId) {
                this.tracker.currentPlayer = null;
            }
            
            this.updatePlayersList();
            this.updateRosterList();
            this.updatePlayerViewList();
            this.updateAvailablePlayersList();
            this.updateStats();
            this.updateSeasonStats();
            this.render();
        }
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

        // Group players by team
        const teamAPlayers = rosterPlayers.filter(p => p.gameTeam === 'A');
        const teamBPlayers = rosterPlayers.filter(p => p.gameTeam === 'B');

        container.innerHTML = '';

        // Team A Section
        if (teamAPlayers.length > 0) {
            const teamASection = document.createElement('div');
            teamASection.className = 'roster-team-group';
            teamASection.innerHTML = `<h4>${currentGame.teamA || 'Team A'}</h4>`;

            teamAPlayers.forEach(player => {
                const item = this.createRosterItem(player, currentGame);
                teamASection.appendChild(item);
            });

            container.appendChild(teamASection);
        }

        // Team B Section
        if (teamBPlayers.length > 0) {
            const teamBSection = document.createElement('div');
            teamBSection.className = 'roster-team-group';
            teamBSection.innerHTML = `<h4>${currentGame.teamB || 'Team B'}</h4>`;

            teamBPlayers.forEach(player => {
                const item = this.createRosterItem(player, currentGame);
                teamBSection.appendChild(item);
            });

            container.appendChild(teamBSection);
        }
    }

    createRosterItem(player, currentGame) {
        const item = document.createElement('div');
        item.className = 'roster-item';

        const displayName = player.number ? `#${player.number} ${player.name}` : player.name;

        item.innerHTML = `
            <div class="roster-item-name">${displayName}</div>
            <button class="roster-item-remove" data-player-id="${player.id}">Remove</button>
        `;

        const removeBtn = item.querySelector('.roster-item-remove');
        removeBtn.addEventListener('click', async () => {
            const pinCount = currentGame.pins.filter(p =>
                p.player1Id === player.id || p.player2Id === player.id || p.playerId === player.id ||
                p.teamAPlayerId === player.id || p.teamBPlayerId === player.id
            ).length;
            const confirmMsg = pinCount > 0
                ? `Remove <strong>${displayName}</strong> from this game's roster?<br><br>This will also delete <strong>${pinCount}</strong> face-off data point(s) attributed to this player.`
                : `Remove <strong>${displayName}</strong> from this game's roster?`;

            const result = await Swal.fire({
                title: 'Remove Player from Roster',
                html: confirmMsg,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#dc2626',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Yes, remove!',
                cancelButtonText: 'Cancel'
            });

            if (result.isConfirmed) {
                this.tracker.removePlayerFromRoster(currentGame.id, player.id);

                // Reset view to team if we're viewing the removed player
                if (this.currentViewMode === player.id) {
                    this.setViewMode('team');
                }

                this.updateRosterList();
                this.updatePlayerViewList();
                this.updateAvailablePlayersList();
                this.updateStats();
                this.updateUnsavedIndicator();
                this.updateSeasonStats();
                this.render();
            }
        });

        return item;
    }

    updatePlayerViewList() {
        // View mode feature has been removed - player filtering is now handled by the Player Filter checkboxes
        return;
    }

    updateGamesList() {
        const gamesList = this.elements.gamesList;
        gamesList.innerHTML = '';

        // Get all regular games (not cumulative folders)
        const allGameIds = Object.keys(this.tracker.games).filter(id =>
            !this.tracker.games[id].isCumulativeFolder
        );

        // REMOVED: Season Total rendering (cumulative tracking now only via folders)

        // Get all folders sorted by creation date
        const folderIds = Object.keys(this.tracker.folders).sort((a, b) => {
            return new Date(this.tracker.folders[a].createdAt) -
                   new Date(this.tracker.folders[b].createdAt);
        });

        // Render each folder
        folderIds.forEach(folderId => {
            const folder = this.tracker.folders[folderId];
            const folderSection = this.createFolderSection(folder);
            gamesList.appendChild(folderSection);
        });

        // Render unfiled games section
        const unfiledGames = allGameIds.filter(id => !this.tracker.games[id].folderId);
        if (unfiledGames.length > 0) {
            const unfiledSection = this.createUnfiledGamesSection(unfiledGames);
            gamesList.appendChild(unfiledSection);
        }

        // Show "no games" message if no games exist
        if (allGameIds.length === 0) {
            const noGamesMsg = document.createElement('div');
            noGamesMsg.className = 'no-games-message';
            noGamesMsg.style.marginTop = '20px';
            noGamesMsg.innerHTML = `
                <p>No games yet</p>
                <p class="hint">Create your first game to get started!</p>
            `;
            gamesList.appendChild(noGamesMsg);
        }
    }

    createFolderSection(folder) {
        const section = document.createElement('div');
        section.className = 'folder-section';
        section.dataset.folderId = folder.id;

        // Folder header (collapsible)
        const header = document.createElement('div');
        header.className = 'folder-header';

        const toggle = document.createElement('span');
        toggle.className = 'folder-toggle';
        toggle.textContent = '▼'; // Expanded by default

        // Toggle arrow handles collapse/expand
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            section.classList.toggle('collapsed');
            toggle.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
        });

        const nameSpan = document.createElement('span');
        nameSpan.className = 'folder-name';
        nameSpan.textContent = `📁 ${folder.name}`;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'folder-actions';

        // Rename folder button
        const renameBtn = document.createElement('button');
        renameBtn.className = 'folder-action-btn';
        renameBtn.innerHTML = '✏️';
        renameBtn.title = 'Rename Folder';
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.renameFolder(folder.id);
        });

        // Delete folder button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'folder-action-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete Folder';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.confirmDeleteFolder(folder.id);
        });

        actionsDiv.appendChild(renameBtn);
        actionsDiv.appendChild(deleteBtn);
        header.appendChild(toggle);
        header.appendChild(nameSpan);
        header.appendChild(actionsDiv);

        // Mark as selected if this is the selected folder
        if (this.selectedFolderId === folder.id) {
            header.classList.add('folder-selected');
        }

        // Folder content (games)
        const content = document.createElement('div');
        content.className = 'folder-content';

        // Add cumulative game if folder has it
        if (folder.hasCumulativeTracker) {
            const cumulativeId = `${this.tracker.CUMULATIVE_ID_PREFIX}${folder.id}`;
            const cumulativeGame = this.tracker.games[cumulativeId];
            if (cumulativeGame) {
                const cumulativeCard = this.createGameCard(
                    cumulativeGame,
                    this.tracker.currentGameId === cumulativeId,
                    true  // isCumulative flag
                );
                content.appendChild(cumulativeCard);
            }
        }

        // Get games in this folder
        const folderGames = Object.values(this.tracker.games)
            .filter(g => g.folderId === folder.id && !g.isCumulativeFolder)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        // Render games
        folderGames.forEach(game => {
            const gameCard = this.createGameCard(
                game,
                game.id === this.tracker.currentGameId
            );

            // Add move to folder option on right-click
            gameCard.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showGameContextMenu(e, game.id);
            });

            content.appendChild(gameCard);
        });

        // Clicking the header (but not toggle or actions) selects the folder
        header.addEventListener('click', (e) => {
            // Don't select if clicking actions
            if (e.target.closest('.folder-actions') || e.target.closest('.folder-toggle')) {
                return;
            }
            this.selectFolder(folder.id);
        });

        section.appendChild(header);
        section.appendChild(content);

        return section;
    }

    createUnfiledGamesSection(gameIds) {
        const section = document.createElement('div');
        section.className = 'folder-section';

        const header = document.createElement('div');
        header.className = 'folder-header';

        const toggle = document.createElement('span');
        toggle.className = 'folder-toggle';
        toggle.textContent = '▼';

        // Toggle arrow handles collapse/expand
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            section.classList.toggle('collapsed');
            toggle.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
        });

        const nameSpan = document.createElement('span');
        nameSpan.className = 'folder-name';
        nameSpan.textContent = '📂 Unfiled Games';

        header.appendChild(toggle);
        header.appendChild(nameSpan);

        // Mark as selected if no folder is selected (unfiled)
        if (this.selectedFolderId === null) {
            header.classList.add('folder-selected');
        }

        const content = document.createElement('div');
        content.className = 'folder-content';

        // Sort by date
        gameIds.sort((a, b) => {
            return new Date(this.tracker.games[b].date) -
                   new Date(this.tracker.games[a].date);
        });

        gameIds.forEach(id => {
            const game = this.tracker.games[id];
            const gameCard = this.createGameCard(
                game,
                id === this.tracker.currentGameId
            );

            gameCard.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showGameContextMenu(e, game.id);
            });

            content.appendChild(gameCard);
        });

        // Clicking the header (but not toggle) clears folder selection
        header.addEventListener('click', (e) => {
            // Don't select if clicking toggle
            if (e.target.closest('.folder-toggle')) {
                return;
            }
            this.selectFolder(null); // Clear selection (unfiled)
        });

        section.appendChild(header);
        section.appendChild(content);

        return section;
    }

    createGameCard(game, isActive, isCumulative = false) {
        const card = document.createElement('div');
        card.className = 'game-card' + (isActive ? ' active' : '');
        if (isCumulative || game.isCumulativeFolder) {
            card.classList.add('cumulative-game');
        }
        card.dataset.gameId = game.id;

        const total = game.pins ? game.pins.length : 0;

        const date = new Date(game.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const gameTitle = game.opponent || `${game.teamA} vs ${game.teamB}`;
        const cumulativeBadge = (isCumulative || game.isCumulativeFolder) ? '<div class="cumulative-badge">📊 Cumulative</div>' : '';

        card.innerHTML = `
            <div class="game-card-header">
                <div class="game-card-title">${gameTitle}</div>
                ${cumulativeBadge}
            </div>
            <div class="game-card-date">${date}</div>
            <div class="game-card-stats">
                <div class="game-card-stat">
                    <span class="stat-badge">${total} Face-Off${total !== 1 ? 's' : ''}</span>
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
        
        // If switching to Season Total, rebuild it to ensure it has latest pins
        if (gameId === this.tracker.SEASON_TOTAL_ID) {
            this.tracker.rebuildSeasonTotal();
        }
        
        this.tracker.saveCurrentGameId();
        this.updateUI();
    }

    showGameContextMenu(event, gameId) {
        // Remove existing context menu
        const existing = document.querySelector('.game-context-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.className = 'game-context-menu';
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;

        // Move to folder options
        const folders = Object.values(this.tracker.folders);

        if (folders.length > 0) {
            const moveToHeader = document.createElement('div');
            moveToHeader.className = 'context-menu-header';
            moveToHeader.textContent = 'Move to Folder';
            menu.appendChild(moveToHeader);

            folders.forEach(folder => {
                const option = document.createElement('div');
                option.className = 'context-menu-item';
                option.textContent = `📁 ${folder.name}`;
                option.addEventListener('click', () => {
                    this.moveGameToFolder(gameId, folder.id);
                    menu.remove();
                });
                menu.appendChild(option);
            });
        }

        // Remove from folder option
        const game = this.tracker.games[gameId];
        if (game.folderId) {
            const removeOption = document.createElement('div');
            removeOption.className = 'context-menu-item';
            removeOption.textContent = '📂 Move to Unfiled';
            removeOption.addEventListener('click', () => {
                this.moveGameToFolder(gameId, null);
                menu.remove();
            });
            menu.appendChild(removeOption);
        }

        // Add divider if there were folder options
        if (folders.length > 0 || game.folderId) {
            const divider = document.createElement('div');
            divider.className = 'context-menu-divider';
            menu.appendChild(divider);
        }

        // Delete game option (don't allow deleting cumulative folders)
        if (!game.isCumulativeFolder) {
            const deleteOption = document.createElement('div');
            deleteOption.className = 'context-menu-item context-menu-item-danger';
            deleteOption.textContent = '🗑️ Delete Game';
            deleteOption.addEventListener('click', () => {
                this.confirmDeleteGame(gameId);
                menu.remove();
            });
            menu.appendChild(deleteOption);
        }

        document.body.appendChild(menu);

        // Remove on click outside
        const removeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', removeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', removeMenu), 0);
    }

    async moveGameToFolder(gameId, folderId) {
        await this.tracker.moveGameToFolder(gameId, folderId);
        this.updateUI();

        const folderName = folderId ? this.tracker.folders[folderId].name : 'Unfiled Games';
        Swal.fire({
            title: 'Game Moved!',
            text: `Game moved to ${folderName}`,
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
        });
    }

    async renameFolder(folderId) {
        const folder = this.tracker.folders[folderId];
        if (!folder) return;

        const result = await Swal.fire({
            title: 'Rename Folder',
            input: 'text',
            inputValue: folder.name,
            inputPlaceholder: 'Enter folder name',
            showCancelButton: true,
            confirmButtonText: 'Rename',
            cancelButtonText: 'Cancel',
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return 'Folder name cannot be empty';
                }
                if (value.length > 50) {
                    return 'Folder name is too long (max 50 characters)';
                }
            }
        });

        if (result.isConfirmed && result.value) {
            const newName = result.value.trim();
            await this.tracker.renameFolder(folderId, newName);
            this.updateUI();

            Swal.fire({
                title: 'Folder Renamed!',
                text: `Folder renamed to "${newName}"`,
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
        }
    }

    async confirmDeleteFolder(folderId) {
        const folder = this.tracker.folders[folderId];
        const gamesInFolder = Object.values(this.tracker.games)
            .filter(g => g.folderId === folderId && !g.isCumulativeFolder);

        const result = await Swal.fire({
            title: 'Delete Folder?',
            html: `
                <p>Are you sure you want to delete "${folder.name}"?</p>
                <p class="text-secondary">${gamesInFolder.length} game(s) will be moved to Unfiled Games</p>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Delete Folder',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            await this.tracker.deleteFolder(folderId);
            this.updateUI();

            Swal.fire({
                title: 'Folder Deleted',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
        }
    }

    selectFolder(folderId) {
        this.selectedFolderId = folderId;
        this.updateGamesList(); // Refresh to show selection
    }

    async confirmDeleteGame(gameId) {
        const game = this.tracker.games[gameId];
        if (!game) return;

        const gameTitle = game.opponent || `${game.teamA} vs ${game.teamB}`;
        const pinCount = game.pins ? game.pins.length : 0;

        const result = await Swal.fire({
            title: 'Delete Game?',
            html: `
                <p>Are you sure you want to delete this game?</p>
                <p class="text-secondary"><strong>${gameTitle}</strong></p>
                <p class="text-secondary">${pinCount} pin(s) will be permanently deleted</p>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Delete Game',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            await this.tracker.deleteGame(gameId);
            this.updateUI();

            Swal.fire({
                title: 'Game Deleted',
                text: `${gameTitle} has been deleted`,
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
        }
    }

    updateCurrentGameInfo() {
        const game = this.tracker.getCurrentGame();

        if (!game) {
            this.elements.currentOpponent.textContent = 'Select a game';
            this.elements.currentDate.textContent = '';
            return;
        }

        // Display game title
        if (game.id === this.tracker.SEASON_TOTAL_ID) {
            this.elements.currentOpponent.textContent = game.opponent || `${game.teamA} ${game.teamB}`;
        } else {
            // Show team matchup
            const gameTitle = game.opponent ? `vs ${game.opponent}` : `${game.teamA} vs ${game.teamB}`;
            this.elements.currentOpponent.textContent = gameTitle;
        }

        const date = new Date(game.date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        this.elements.currentDate.textContent = date;
    }

    updateLegend() {
        const game = this.tracker.getCurrentGame();

        const legendTeamALabel = document.getElementById('legend-team-a-label');
        const legendTeamBLabel = document.getElementById('legend-team-b-label');
        const legendTeamAMarker = document.getElementById('legend-team-a-marker');
        const legendTeamBMarker = document.getElementById('legend-team-b-marker');

        if (!game) {
            legendTeamALabel.textContent = 'Team A Win';
            legendTeamBLabel.textContent = 'Team B Win';
            legendTeamAMarker.style.backgroundColor = '#10b981';
            legendTeamBMarker.style.backgroundColor = '#ef4444';
            return;
        }

        // Get team names
        const teamAName = game.teamA || 'Team A';
        const teamBName = game.teamB || game.opponent || 'Team B';

        // Update legend labels
        legendTeamALabel.textContent = `${teamAName} Win`;
        legendTeamBLabel.textContent = `${teamBName} Win`;

        // Get team colors (with conflict resolution)
        const teamAColor = getTeamColor(teamAName, 'A', teamBName);
        const teamBColor = getTeamColor(teamBName, 'B', teamAName);

        // Update marker colors
        legendTeamAMarker.style.backgroundColor = teamAColor;
        legendTeamBMarker.style.backgroundColor = teamBColor;
    }

    updateStats() {
        const game = this.tracker.getCurrentGame();
        let stats;
        let viewText = 'Viewing: Team';
        
        if (!game) {
            stats = { wins: 0, losses: 0, total: 0, percentage: 0 };
        } else {
            // Get pins for current view mode
            let pins = game.pins;

            // REMOVED: Season Total game filtering (cumulative tracking now only via folders)

            // Apply player filters
            pins = pins.filter(pin => {
                const teamAPlayerId = pin.teamAPlayerId || pin.player1Id;
                const teamBPlayerId = pin.teamBPlayerId || pin.player2Id;
                const teamAMatch = this.selectedTeamAPlayers.size === 0 || this.selectedTeamAPlayers.has(teamAPlayerId);
                const teamBMatch = this.selectedTeamBPlayers.size === 0 || this.selectedTeamBPlayers.has(teamBPlayerId);
                return teamAMatch && teamBMatch;
            });
            
            // Calculate stats from filtered pins
            let wins = pins.filter(p => {
                const faceoffResult = p.faceoffResult || p.type || 'win';
                return faceoffResult === 'win';
            }).length;
            let losses = pins.filter(p => {
                const faceoffResult = p.faceoffResult || p.type || 'win';
                return faceoffResult === 'loss';
            }).length;
            const total = wins + losses;

            // If viewing Team B stats, swap wins and losses (complementary stats)
            if (this.selectedStatsTeam === 'B') {
                [wins, losses] = [losses, wins]; // Swap: Team B's wins are Team A's losses
            }

            const percentage = total > 0 ? Math.round((wins / total) * 100) : 0;
            stats = { wins, losses, total, percentage };
        }
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
            const wins = game.pins.filter(p => {
                const faceoffResult = p.faceoffResult || p.type || 'win';
                return faceoffResult === 'win';
            }).length;
            const losses = game.pins.filter(p => {
                const faceoffResult = p.faceoffResult || p.type || 'win';
                return faceoffResult === 'loss';
            }).length;
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

        // Get team A player IDs for this game (for filtering)
        const teamAPlayerIds = game && game.roster
            ? game.roster
                .filter(r => {
                    if (typeof r === 'object') return r.team === 'A';
                    return true; // Old format - assume team A
                })
                .map(r => typeof r === 'string' ? r : r.playerId)
            : [];

        // REMOVED: Season Total game filtering (cumulative tracking now only via folders)

        // Filter pins based on selected players
        // Only show pins where both players are in the selected sets
        pins = pins.filter(pin => {
            const teamAPlayerId = pin.teamAPlayerId || pin.player1Id;
            const teamBPlayerId = pin.teamBPlayerId || pin.player2Id;

            // Check if the pin's players are in the selected sets
            // If the set is empty (no filters yet), show all
            const teamAMatch = this.selectedTeamAPlayers.size === 0 || this.selectedTeamAPlayers.has(teamAPlayerId);
            const teamBMatch = this.selectedTeamBPlayers.size === 0 || this.selectedTeamBPlayers.has(teamBPlayerId);

            // Only show pin if both players are selected
            return teamAMatch && teamBMatch;
        });

        // Get team colors
        let teamAColor = '#10b981'; // Default green
        let teamBColor = '#ef4444'; // Default red
        const FALLBACK_GRAY = '#808080';

        if (game) {
            if (game.teamA) {
                teamAColor = getTeamColorFromMap(game.teamA);
            }
            if (game.teamB) {
                teamBColor = getTeamColorFromMap(game.teamB);
            } else if (game.opponent) {
                // Legacy format - use opponent name for team B color
                teamBColor = getTeamColorFromMap(game.opponent);
            }

            // Resolve color conflicts when both teams have similar colors
            if (areColorsSimilar(teamAColor, teamBColor)) {
                // Try Team B's secondary color first
                const teamBName = game.teamB || game.opponent;
                const schoolB = teamBName ? d1LacrosseSchools.find(s =>
                    s.name.toLowerCase() === teamBName.toLowerCase()
                ) : null;
                const secondaryB = schoolB?.secondaryColor;

                if (secondaryB && !areColorsSimilar(secondaryB, teamAColor) && !areColorsSimilar(secondaryB, '#FFFFFF')) {
                    teamBColor = secondaryB;
                } else {
                    // Try Team A's secondary color for Team A instead
                    const schoolA = game.teamA ? d1LacrosseSchools.find(s =>
                        s.name.toLowerCase() === game.teamA.toLowerCase()
                    ) : null;
                    const secondaryA = schoolA?.secondaryColor;

                    if (secondaryA && !areColorsSimilar(secondaryA, teamBColor) && !areColorsSimilar(secondaryA, '#FFFFFF')) {
                        teamAColor = secondaryA;
                    } else {
                        // Fall back to gray for Team B
                        teamBColor = FALLBACK_GRAY;
                    }
                }
            }
        }

        // Convert new pin format with team colors for FieldRenderer
        const renderPins = pins.map(pin => {
            if (pin.faceoffWinnerId || pin.clampWinnerId) {
                // New format - add team colors based on winner
                const faceoffWonByTeamA = teamAPlayerIds.includes(pin.faceoffWinnerId);
                const clampWonByTeamA = teamAPlayerIds.includes(pin.clampWinnerId);

                return {
                    x: pin.x,
                    y: pin.y,
                    faceoffColor: faceoffWonByTeamA ? teamAColor : teamBColor,
                    clampColor: clampWonByTeamA ? teamAColor : teamBColor,
                    faceoffResult: faceoffWonByTeamA ? 'win' : 'loss', // Keep for backward compatibility
                    clampResult: clampWonByTeamA ? 'win' : 'loss', // Keep for backward compatibility
                    isWhistleViolation: pin.isWhistleViolation || false, // Whistle violation (no faceoff)
                    isPostWhistleViolation: pin.isPostWhistleViolation || false, // Post-whistle violation
                    timestamp: pin.timestamp
                };
            }
            // Old format - add default team colors
            return {
                ...pin,
                faceoffColor: pin.faceoffResult === 'win' ? teamAColor : teamBColor,
                clampColor: pin.clampResult === 'win' ? teamAColor : teamBColor
            };
        });

        if (this.displayType === 'heatmap') {
            const teamAName = game?.teamA || 'Team A';
            const teamBName = game?.teamB || game?.opponent || 'Team B';
            this.fieldRenderer.renderHeatmap(renderPins, teamAColor, teamBColor, teamAName, teamBName);
        } else {
            const teamAName = game?.teamA || 'Team A';
            this.fieldRenderer.render(renderPins, this.showClampRings, teamAName, teamAColor);
        }
    }

    updateUnsavedIndicator() {
        if (this.tracker.hasUnsavedChanges) {
            this.elements.unsavedIndicator.style.display = 'flex';
            this.elements.saveGameBtn.classList.add('btn-pulse');
        } else {
            this.elements.unsavedIndicator.style.display = 'none';
            this.elements.saveGameBtn.classList.remove('btn-pulse');
        }
    }

    updateGameControls() {
        // REMOVED: Season Total check (cumulative tracking now only via folders)
        const game = this.tracker.getCurrentGame();
        const isCumulative = game?.isCumulativeFolder;
        const isReadOnly = isCumulative; // Only cumulative folders are read-only now

        const gameOnlyControls = document.querySelectorAll('.game-only-control');

        gameOnlyControls.forEach(control => {
            if (isReadOnly) {
                control.classList.add('hidden');
            } else {
                control.classList.remove('hidden');
            }
        });

        // REMOVED: Game filtering section (was only for Season Total)
    }

    updateGameFilterList() {
        const container = this.elements.gameFilterList;
        container.innerHTML = '';
        
        // Get all games except Season Total
        const gameIds = Object.keys(this.tracker.games).filter(id => id !== this.tracker.SEASON_TOTAL_ID);
        
        if (gameIds.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 10px;">No games to filter</div>';
            return;
        }
        
        // Initialize selectedGames with all games if empty
        if (this.selectedGames.size === 0) {
            gameIds.forEach(id => this.selectedGames.add(id));
        }
        
        gameIds.forEach(gameId => {
            const game = this.tracker.games[gameId];
            const wins = game.pins.filter(p => {
                const faceoffResult = p.faceoffResult || p.type || 'win';
                return faceoffResult === 'win';
            }).length;
            const losses = game.pins.filter(p => {
                const faceoffResult = p.faceoffResult || p.type || 'win';
                return faceoffResult === 'loss';
            }).length;
            const total = wins + losses;
            
            const item = document.createElement('div');
            item.className = 'game-filter-item';
            item.innerHTML = `
                <input type="checkbox" id="game-filter-${gameId}" ${this.selectedGames.has(gameId) ? 'checked' : ''}>
                <label for="game-filter-${gameId}">${game.opponent}</label>
                <span class="game-stats">${wins}W-${losses}L</span>
            `;
            
            const checkbox = item.querySelector('input');
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.selectedGames.add(gameId);
                } else {
                    this.selectedGames.delete(gameId);
                }
                this.render();
                this.updateStats();
            });
            
            container.appendChild(item);
        });
    }

    selectAllGames() {
        const checkboxes = this.elements.gameFilterList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            this.selectedGames.add(checkbox.id.replace('game-filter-', ''));
        });
        this.render();
        this.updateStats();
    }

    deselectAllGames() {
        const checkboxes = this.elements.gameFilterList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            this.selectedGames.delete(checkbox.id.replace('game-filter-', ''));
        });
        this.render();
        this.updateStats();
    }

    updateUI() {
        this.updateGamesList();
        this.updateCurrentGameInfo();
        this.updateLegend(); // Update legend with team names and colors
        this.updateGameControls(); // Show/hide controls based on Season Total
        this.updateRosterList();
        this.updatePlayerViewList();
        this.populatePlayerFilters(); // Populate player filter checkboxes
        this.updateStats();
        this.updateSeasonStats();
        this.updateUnsavedIndicator();
        this.render();
    }

    printField() {
        const game = this.tracker.getCurrentGame();
        if (!game) {
            Swal.fire({
                title: 'No Game Selected',
                text: 'Please select a game first!',
                icon: 'info',
                confirmButtonColor: '#FFFFFF', confirmButtonTextColor: '#000000'
            });
            return;
        }

        // Create a new window for printing
        const printWindow = window.open('', '_blank');

        // Get game info
        const teamA = game.teamA || 'Team A';
        const teamB = game.teamB || 'Team B';
        const date = game.date ? new Date(game.date).toLocaleDateString() : '';

        // Get the canvas as an image
        const canvas = this.elements.canvas;
        const imageData = canvas.toDataURL('image/png');

        // Calculate player statistics using the same method as stats modal
        const stats = this.calculatePlayerStats(game);

        // Group players by team
        const teamAStats = stats.filter(s => s.team === 'A');
        const teamBStats = stats.filter(s => s.team === 'B');

        // Build stats table rows
        let statsTableRows = '';

        // Render Team A
        if (teamAStats.length > 0) {
            teamAStats.forEach(playerStat => {
                statsTableRows += this.renderPlayerRowForPrint(playerStat);
            });
            statsTableRows += this.renderTeamSubtotalForPrint(teamA, teamAStats);
        }

        // Render Team B
        if (teamBStats.length > 0) {
            teamBStats.forEach(playerStat => {
                statsTableRows += this.renderPlayerRowForPrint(playerStat);
            });
            statsTableRows += this.renderTeamSubtotalForPrint(teamB, teamBStats);
        }
        
        // Build the print HTML with two pages
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Face-Off Report - ${teamA} vs ${teamB}</title>
                <style>
                    @page {
                        size: letter;
                        margin: 0.5in;
                    }
                    * {
                        box-sizing: border-box;
                    }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        margin: 0;
                        padding: 0;
                        color: #1e293b;
                    }

                    /* Page 1: Field */
                    .page-field {
                        page-break-after: always;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        min-height: 100vh;
                    }

                    /* Page 2: Stats */
                    .page-stats {
                        page-break-before: always;
                        min-height: 100vh;
                    }

                    .header {
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    .header h1 {
                        margin: 0 0 10px 0;
                        font-size: 24px;
                        color: #f97316;
                    }
                    .header h2 {
                        margin: 10px 0;
                        font-size: 20px;
                        color: #334155;
                    }
                    .header p {
                        margin: 5px 0;
                        color: #64748b;
                        font-size: 14px;
                    }

                    /* Field Image */
                    .field-container {
                        width: 100%;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        flex: 1;
                    }
                    .field-image {
                        max-width: 100%;
                        max-height: 85vh;
                        border: 2px solid #e2e8f0;
                        border-radius: 8px;
                    }

                    /* Stats Table */
                    .stats-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                        border: 2px solid black;
                    }
                    .stats-table th {
                        background: #d3d3d3;
                        color: black;
                        padding: 12px 8px;
                        text-align: left;
                        font-weight: 700;
                        border: 1px solid black;
                        font-size: 14px;
                    }
                    .stats-table th:nth-child(1) {
                        width: 30%;
                    }
                    .stats-table th:nth-child(2) {
                        width: 8%;
                        text-align: center;
                    }
                    .stats-table th:nth-child(n+3) {
                        text-align: center;
                        width: 10.33%;
                    }
                    .stats-table td {
                        padding: 8px;
                        border: 1px solid black;
                        font-size: 13px;
                    }
                    .stats-table td:nth-child(2) {
                        text-align: center;
                        color: #64748b;
                    }
                    .stats-table td:nth-child(n+3) {
                        text-align: center;
                    }
                    .stats-table tr:nth-child(even) {
                        background: #f8fafc;
                    }
                    .stats-table tr.team-subtotal {
                        font-weight: 600;
                        border-top: 2px solid black;
                        border-bottom: 2px solid black;
                    }

                    @media print {
                        .page-field {
                            page-break-after: always;
                        }
                        .page-stats {
                            page-break-before: always;
                        }
                    }
                </style>
            </head>
            <body>
                <!-- Page 1: Field -->
                <div class="page-field">
                    <div class="header">
                        <h1>Face-Off Tracker Report</h1>
                        <h2>${teamA} vs ${teamB}</h2>
                        <p>${date}</p>
                    </div>
                    <div class="field-container">
                        <img src="${imageData}" alt="Lacrosse Field Face-Off Map" class="field-image" />
                    </div>
                </div>

                <!-- Page 2: Stats -->
                <div class="page-stats">
                    <div class="header">
                        <h1>Player Statistics</h1>
                        <h2>${teamA} vs ${teamB}</h2>
                        <p>Total Face-Offs: ${game.pins ? game.pins.length : 0}</p>
                    </div>
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>#</th>
                                <th>FO Wins</th>
                                <th>FO Losses</th>
                                <th>FO %</th>
                                <th>Adj FO %</th>
                                <th>Clamp Wins</th>
                                <th>Clamp Losses</th>
                                <th>Clamp %</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${statsTableRows}
                        </tbody>
                    </table>
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
    }

    renderPlayerRowForPrint(playerStat) {
        const { player, foWins, foLosses, foPercentage, adjFoPercentage, clampWins, clampLosses, clampPercentage } = playerStat;

        return `
            <tr>
                <td>${player.name}</td>
                <td>${player.number || '-'}</td>
                <td>${foWins}</td>
                <td>${foLosses}</td>
                <td>${foPercentage}%</td>
                <td>${adjFoPercentage}%</td>
                <td>${clampWins}</td>
                <td>${clampLosses}</td>
                <td>${clampPercentage}%</td>
            </tr>
        `;
    }

    renderTeamSubtotalForPrint(teamName, teamStats) {
        // Sum up team totals
        const totals = teamStats.reduce((acc, stat) => {
            acc.foWins += stat.foWins;
            acc.foLosses += stat.foLosses;
            acc.clampWins += stat.clampWins;
            acc.clampLosses += stat.clampLosses;
            acc.convertedLosses += stat.convertedLosses;
            acc.convertedWins += stat.convertedWins;
            return acc;
        }, { foWins: 0, foLosses: 0, clampWins: 0, clampLosses: 0, convertedLosses: 0, convertedWins: 0 });

        const foTotal = totals.foWins + totals.foLosses;
        const clampTotal = totals.clampWins + totals.clampLosses;
        const foPercentage = foTotal > 0 ? ((totals.foWins / foTotal) * 100).toFixed(1) : '0.0';
        const adjWins = totals.foWins - totals.convertedLosses + totals.convertedWins;
        const adjFoPercentage = foTotal > 0 ? ((adjWins / foTotal) * 100).toFixed(1) : '0.0';
        const clampPercentage = clampTotal > 0 ? ((totals.clampWins / clampTotal) * 100).toFixed(1) : '0.0';

        // Get team color
        const teamColor = getTeamColor(teamName);
        const bgColor = teamColor ? this.hexToRGBA(teamColor, 0.15) : '#fed7aa';
        const textColor = teamColor || '#f97316';

        return `
            <tr class="team-subtotal" style="background-color: ${bgColor} !important;">
                <td style="color: ${textColor};">${teamName} Total</td>
                <td>-</td>
                <td>${totals.foWins}</td>
                <td>${totals.foLosses}</td>
                <td>${foPercentage}%</td>
                <td>${adjFoPercentage}%</td>
                <td>${totals.clampWins}</td>
                <td>${totals.clampLosses}</td>
                <td>${clampPercentage}%</td>
            </tr>
        `;
    }
}


// Export UIController class
export default UIController;
