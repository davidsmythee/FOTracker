// ===== Main Application Initialization =====
import firebaseService from '../firebase-service.js';
import UIController from './UIController.js';

let appInstance = null;

async function initializeApp() {
    // Small delay to ensure layout is calculated
    await new Promise(resolve => setTimeout(resolve, 100));

    appInstance = new UIController();

    // Setup real-time sync callback
    appInstance.tracker.onDataChange((type) => {
        if (type === 'games' || type === 'players') {
            appInstance.updateUI();
        } else if (type === 'unsaved' || type === 'saved') {
            appInstance.updateUnsavedIndicator();
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
            Swal.fire({
                title: 'Welcome to Face-Off Tracker! 🥍',
                html: 'Click <strong>"New Game"</strong> to start tracking face-offs.<br><br>Then click on the field to place pins showing where face-offs were won (green) or lost (red).',
                icon: 'info',
                confirmButtonColor: '#FFFFFF',
                confirmButtonTextColor: '#000000',
                confirmButtonText: 'Got it!'
            });
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
                    Swal.fire({
                        title: 'Data Migrated! 🎉',
                        text: 'Your local data has been migrated to the cloud!\n\nYour data is now synced across all devices.',
                        icon: 'success',
                        confirmButtonColor: '#FFFFFF',
                        confirmButtonTextColor: '#000000'
                    });
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
            Swal.fire({
                title: 'Sign In Failed',
                text: 'Failed to sign in. Please try again.',
                icon: 'error',
                confirmButtonColor: '#dc2626'
            });
        }
    });

    // Sign out button
    signOutBtn.addEventListener('click', async () => {
        try {
            const result = await Swal.fire({
            title: 'Sign Out',
            text: 'Are you sure you want to sign out? Your data will be saved in the cloud.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, sign out',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
                await firebaseService.signOutUser();
            }
        } catch (error) {
            console.error('Sign out error:', error);
            Swal.fire({
                title: 'Sign Out Failed',
                text: 'Failed to sign out. Please try again.',
                icon: 'error',
                confirmButtonColor: '#dc2626'
            });
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
