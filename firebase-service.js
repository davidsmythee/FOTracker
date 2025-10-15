// Firebase Data Service
// Handles all data operations with Firestore

import {
    auth,
    db,
    googleProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where
} from './firebase-config.js';

class FirebaseDataService {
    constructor() {
        this.user = null;
        this.unsubscribes = [];
        this.syncCallbacks = {
            onGamesUpdate: null,
            onPlayersUpdate: null,
            onSyncStatus: null
        };
    }

    // Authentication
    async signIn() {
        try {
            this.setSyncStatus('syncing');
            const result = await signInWithPopup(auth, googleProvider);
            this.user = result.user;
            this.setSyncStatus('synced');
            return result.user;
        } catch (error) {
            console.error('Sign in error:', error);
            this.setSyncStatus('error');
            throw error;
        }
    }

    async signOutUser() {
        try {
            // Unsubscribe from all listeners
            this.unsubscribeAll();
            await signOut(auth);
            this.user = null;
        } catch (error) {
            console.error('Sign out error:', error);
            throw error;
        }
    }

    onAuthChange(callback) {
        return onAuthStateChanged(auth, (user) => {
            this.user = user; // Set user in service when auth state changes
            callback(user);
        });
    }

    getUserId() {
        return this.user?.uid || null;
    }

    // Games Operations
    async saveGame(gameId, gameData) {
        if (!this.user) throw new Error('Not authenticated');
        
        try {
            this.setSyncStatus('syncing');
            const gameRef = doc(db, `users/${this.user.uid}/games`, gameId);
            await setDoc(gameRef, {
                ...gameData,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            this.setSyncStatus('synced');
        } catch (error) {
            console.error('Error saving game:', error);
            this.setSyncStatus('error');
            throw error;
        }
    }

    async getGame(gameId) {
        if (!this.user) throw new Error('Not authenticated');
        
        try {
            const gameRef = doc(db, `users/${this.user.uid}/games`, gameId);
            const gameSnap = await getDoc(gameRef);
            return gameSnap.exists() ? { id: gameSnap.id, ...gameSnap.data() } : null;
        } catch (error) {
            console.error('Error getting game:', error);
            throw error;
        }
    }

    async getAllGames() {
        if (!this.user) throw new Error('Not authenticated');
        
        try {
            const gamesRef = collection(db, `users/${this.user.uid}/games`);
            const gamesSnap = await getDocs(gamesRef);
            const games = {};
            gamesSnap.forEach(doc => {
                games[doc.id] = { id: doc.id, ...doc.data() };
            });
            return games;
        } catch (error) {
            console.error('Error getting games:', error);
            throw error;
        }
    }

    async deleteGame(gameId) {
        if (!this.user) throw new Error('Not authenticated');
        
        try {
            this.setSyncStatus('syncing');
            const gameRef = doc(db, `users/${this.user.uid}/games`, gameId);
            await deleteDoc(gameRef);
            this.setSyncStatus('synced');
        } catch (error) {
            console.error('Error deleting game:', error);
            this.setSyncStatus('error');
            throw error;
        }
    }

    // Players Operations
    async savePlayer(playerId, playerData) {
        if (!this.user) throw new Error('Not authenticated');
        
        try {
            this.setSyncStatus('syncing');
            const playerRef = doc(db, `users/${this.user.uid}/players`, playerId);
            await setDoc(playerRef, {
                ...playerData,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            this.setSyncStatus('synced');
        } catch (error) {
            console.error('Error saving player:', error);
            this.setSyncStatus('error');
            throw error;
        }
    }

    async getAllPlayers() {
        if (!this.user) throw new Error('Not authenticated');
        
        try {
            const playersRef = collection(db, `users/${this.user.uid}/players`);
            const playersSnap = await getDocs(playersRef);
            const players = [];
            playersSnap.forEach(doc => {
                players.push({ id: doc.id, ...doc.data() });
            });
            return players;
        } catch (error) {
            console.error('Error getting players:', error);
            throw error;
        }
    }

    async deletePlayer(playerId) {
        if (!this.user) throw new Error('Not authenticated');
        
        try {
            this.setSyncStatus('syncing');
            const playerRef = doc(db, `users/${this.user.uid}/players`, playerId);
            await deleteDoc(playerRef);
            this.setSyncStatus('synced');
        } catch (error) {
            console.error('Error deleting player:', error);
            this.setSyncStatus('error');
            throw error;
        }
    }

    // Real-time Listeners
    listenToGames(callback) {
        if (!this.user) return;
        
        const gamesRef = collection(db, `users/${this.user.uid}/games`);
        const unsubscribe = onSnapshot(gamesRef, (snapshot) => {
            const games = {};
            snapshot.forEach(doc => {
                games[doc.id] = { id: doc.id, ...doc.data() };
            });
            callback(games);
        }, (error) => {
            console.error('Error listening to games:', error);
            this.setSyncStatus('error');
        });
        
        this.unsubscribes.push(unsubscribe);
        return unsubscribe;
    }

    listenToPlayers(callback) {
        if (!this.user) return;
        
        const playersRef = collection(db, `users/${this.user.uid}/players`);
        const unsubscribe = onSnapshot(playersRef, (snapshot) => {
            const players = [];
            snapshot.forEach(doc => {
                players.push({ id: doc.id, ...doc.data() });
            });
            callback(players);
        }, (error) => {
            console.error('Error listening to players:', error);
            this.setSyncStatus('error');
        });
        
        this.unsubscribes.push(unsubscribe);
        return unsubscribe;
    }

    unsubscribeAll() {
        this.unsubscribes.forEach(unsubscribe => unsubscribe());
        this.unsubscribes = [];
    }

    // User Settings
    async saveCurrentGameId(gameId) {
        if (!this.user) return;
        
        try {
            const settingsRef = doc(db, `users/${this.user.uid}/settings`, 'app');
            await setDoc(settingsRef, {
                currentGameId: gameId,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.error('Error saving current game ID:', error);
        }
    }

    async getCurrentGameId() {
        if (!this.user) return null;
        
        try {
            const settingsRef = doc(db, `users/${this.user.uid}/settings`, 'app');
            const settingsSnap = await getDoc(settingsRef);
            return settingsSnap.exists() ? settingsSnap.data().currentGameId : null;
        } catch (error) {
            console.error('Error getting current game ID:', error);
            return null;
        }
    }

    // Migration from localStorage
    async migrateFromLocalStorage() {
        if (!this.user) return;
        
        try {
            // Check if already migrated
            const settingsRef = doc(db, `users/${this.user.uid}/settings`, 'app');
            const settingsSnap = await getDoc(settingsRef);
            
            if (settingsSnap.exists() && settingsSnap.data().migrated) {
                console.log('Data already migrated');
                return false;
            }
            
            // Get localStorage data
            const localGames = localStorage.getItem('faceoff_games');
            const localPlayers = localStorage.getItem('faceoff_players');
            
            if (!localGames && !localPlayers) {
                console.log('No local data to migrate');
                return false;
            }
            
            this.setSyncStatus('syncing');
            
            // Migrate games
            if (localGames) {
                const games = JSON.parse(localGames);
                for (const [gameId, gameData] of Object.entries(games)) {
                    await this.saveGame(gameId, gameData);
                }
            }
            
            // Migrate players
            if (localPlayers) {
                const players = JSON.parse(localPlayers);
                for (const player of players) {
                    await this.savePlayer(player.id, player);
                }
            }
            
            // Mark as migrated
            await setDoc(settingsRef, {
                migrated: true,
                migratedAt: new Date().toISOString()
            }, { merge: true });
            
            this.setSyncStatus('synced');
            console.log('Migration completed successfully');
            return true;
        } catch (error) {
            console.error('Migration error:', error);
            this.setSyncStatus('error');
            throw error;
        }
    }

    // Sync status management
    setSyncStatus(status) {
        if (this.syncCallbacks.onSyncStatus) {
            this.syncCallbacks.onSyncStatus(status);
        }
    }

    onSyncStatusChange(callback) {
        this.syncCallbacks.onSyncStatus = callback;
    }
}

// Export singleton instance
const firebaseService = new FirebaseDataService();
export default firebaseService;

