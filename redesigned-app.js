/**
 * Story Vault - Digital Time Capsule App
 * Redesigned Main Application JavaScript
 */

// Application State
let AppState = {
    currentUser: {
        name: 'Story Vault User',
        email: 'user@storyvault.com',
        avatar: '👤'
    },
    storageType: 'local', // 'local' or 'cloud'
    memories: [],
    timeCapsules: [],
    connectedPlatforms: [],
    notifications: [],
    dailyStats: {
        postsSavedToday: 0,
        autoSyncedToday: 0,
        lastSyncTime: null
    },
    currentScreen: 1,
    isOnboarding: true,
    settings: {
        theme: 'sepia',
        notifications: true,
        autoSync: true
    }
};

// API Configuration
const API_CONFIG = {
    baseURL: window.location.hostname === 'localhost' ? 'http://localhost:3000' : '',
    endpoints: {
        auth: '/api/auth',
        memories: '/api/memories',
        capsules: '/api/capsules',
        platforms: '/api/platforms',
        storage: '/api/storage',
        upgrade: '/api/upgrade'
    }
};

// Platform configurations
const PLATFORMS = {
    instagram: {
        name: 'Instagram',
        icon: '<i class="fab fa-instagram"></i>',
        color: '#E4405F',
        premium: false
    },
    twitter: {
        name: 'Twitter',
        icon: '<i class="fab fa-twitter"></i>',
        color: '#1DA1F2',
        premium: false
    },
    facebook: {
        name: 'Facebook',
        icon: '<i class="fab fa-facebook-f"></i>',
        color: '#1877F2',
        premium: true
    },
    spotify: {
        name: 'Spotify',
        icon: '<i class="fab fa-spotify"></i>',
        color: '#1DB954',
        premium: true
    },
    youtube: {
        name: 'YouTube',
        icon: '<i class="fab fa-youtube"></i>',
        color: '#FF0000',
        premium: true
    },
    tiktok: {
        name: 'TikTok',
        icon: '<i class="fab fa-tiktok"></i>',
        color: '#000000',
        premium: true
    }
};

// Utility Functions
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(new Date(date));
};

const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Storage Management
class StorageManager {
    constructor() {
        this.storageKey = 'storyvault-data';
    }

    // Local Storage Methods
    saveLocal(data) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Failed to save to local storage:', error);
            return false;
        }
    }

    loadLocal() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to load from local storage:', error);
            return null;
        }
    }

    clearLocal() {
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (error) {
            console.error('Failed to clear local storage:', error);
            return false;
        }
    }

    // Cloud Storage Methods
    async saveCloud(data) {
        try {
            const response = await fetch(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.storage}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify(data)
            });

            return response.ok;
        } catch (error) {
            console.error('Failed to save to cloud storage:', error);
            return false;
        }
    }

    async loadCloud() {
        try {
            const response = await fetch(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.storage}`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                }
            });

            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error('Failed to load from cloud storage:', error);
            return null;
        }
    }

    getAuthToken() {
        return localStorage.getItem('storyvault-auth-token');
    }

    // Unified Storage Interface
    async save(data) {
        const success = AppState.storageType === 'cloud' ? 
            await this.saveCloud(data) : 
            this.saveLocal(data);
        
        if (success) {
            AppState = { ...AppState, ...data };
            this.updateUI();
        }
        
        return success;
    }

    async load() {
        const data = AppState.storageType === 'cloud' ? 
            await this.loadCloud() : 
            this.loadLocal();
        
        if (data) {
            AppState = { ...AppState, ...data };
            this.updateUI();
        }
        
        return data;
    }

    updateUI() {
        updateStorageIndicator();
        updateCounts();
        updateConnectedPlatforms();
        updateDailyStats();
        updateNotificationBadge();
        updateProfileInfo();
    }
}

const storageManager = new StorageManager();

// Onboarding Functions
function nextScreen(currentScreen) {
    const current = $(`#screen-${currentScreen}`);
    const next = $(`#screen-${currentScreen + 1}`);
    
    if (!next) return;

    // Add animation classes
    current.classList.remove('active');
    current.classList.add('prev');
    
    setTimeout(() => {
        next.classList.add('active');
        AppState.currentScreen = currentScreen + 1;
        
        // Add floating animation to new screen
        const floatingElements = next.querySelector('.floating-elements');
        if (floatingElements) {
            floatingElements.classList.add('fade-in');
        }
    }, 300);

    // Track onboarding progress
    trackEvent('onboarding_step', {
        step: currentScreen + 1,
        direction: 'forward'
    });
}

function prevScreen(currentScreen) {
    const current = $(`#screen-${currentScreen}`);
    const prev = $(`#screen-${currentScreen - 1}`);
    
    if (!prev) return;

    current.classList.remove('active');
    prev.classList.remove('prev');
    prev.classList.add('active');
    
    AppState.currentScreen = currentScreen - 1;

    trackEvent('onboarding_step', {
        step: currentScreen - 1,
        direction: 'backward'
    });
}

function selectStorage(storageType) {
    // Remove previous selection
    $$('.storage-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    // Add selection to clicked option
    const selectedOption = $(`.storage-option[data-storage="${storageType}"]`);
    selectedOption.classList.add('selected');
    
    // Update app state
    AppState.storageType = storageType;
    
    // Update summary display
    const storageDisplay = storageType === 'local' ? 'Local Storage' : 'Cloud Storage';
    const summaryElement = $('#selected-storage');
    if (summaryElement) {
        summaryElement.textContent = storageDisplay;
    }
    
    // Update available platforms based on storage type
    updatePlatformAvailability();
    
    // Auto-advance after selection
    setTimeout(() => {
        nextScreen(2);
    }, 1500);

    trackEvent('storage_selected', {
        type: storageType
    });
}

function updatePlatformAvailability() {
    const isLocal = AppState.storageType === 'local';
    const availableCount = isLocal ? 2 : Object.keys(PLATFORMS).length;
    
    // Update platform cards in selection screen
    $$('.platform-card').forEach(card => {
        const platform = card.dataset.platform;
        const isAvailable = !PLATFORMS[platform]?.premium || !isLocal;
        
        if (isAvailable) {
            card.classList.remove('premium-locked');
        } else {
            card.classList.add('premium-locked');
        }
    });
    
    // Update available platforms count
    const platformCount = $('#available-platforms');
    if (platformCount) {
        platformCount.textContent = availableCount;
    }
}

function showMainApp() {
    const onboarding = $('#onboarding-flow');
    const mainApp = $('#main-app');
    
    // Fade out onboarding
    onboarding.style.opacity = '0';
    onboarding.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
        onboarding.style.display = 'none';
        mainApp.style.display = 'flex';
        
        // Fade in main app
        setTimeout(() => {
            mainApp.classList.add('fade-in');
            AppState.isOnboarding = false;
            
            // Initialize main app
            initializeMainApp();
            
            // Save onboarding completion
            storageManager.save({
                onboardingCompleted: true,
                storageType: AppState.storageType
            });
            
        }, 50);
    }, 500);

    trackEvent('onboarding_completed', {
        storageType: AppState.storageType
    });
}

// Debug function to skip onboarding
function skipOnboarding() {
    // Set default values
    AppState.storageType = 'local';
    AppState.isOnboarding = false;
    
    // Hide onboarding and show main app immediately
    const onboarding = $('#onboarding-flow');
    const mainApp = $('#main-app');
    
    if (onboarding) onboarding.style.display = 'none';
    if (mainApp) mainApp.style.display = 'flex';
    
    // Save completion state
    storageManager.save({
        onboardingCompleted: true,
        storageType: AppState.storageType
    });
    
    // Initialize main app
    initializeMainApp();
}

// Reset app for testing
function resetApp() {
    if (confirm('Reset app and go back to onboarding?')) {
        localStorage.clear();
        sessionStorage.clear();
        location.reload();
    }
}

// Main App Functions
async function initializeMainApp() {
    try {
        showLoading('Initializing your time capsule...');
        
        // Load existing data
        await storageManager.load();
        
        // Add some demo data for first-time users
        if (AppState.memories.length === 0 && AppState.timeCapsules.length === 0) {
            initializeDemoData();
        }
        
        // Update UI elements
        updateStorageIndicator();
        updateCounts();
        updateConnectedPlatforms();
        updateDailyStats();
        updateActivityFeed();
        updateNotificationBadge();
        updateProfileInfo();
        
        // Check for memories and load them
        if (AppState.memories.length > 0) {
            hideEmptyState();
            loadMemories();
        }
        
        hideLoading();
        
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showNotification('Failed to load your data. Please refresh the page.', 'error');
        hideLoading();
    }
}

function initializeDemoData() {
    // Set some demo daily stats
    AppState.dailyStats = {
        postsSavedToday: 5,
        autoSyncedToday: 3,
        lastSyncTime: new Date(Date.now() - 2 * 3600000).toISOString() // 2 hours ago
    };
    
    // Add some sample memories
    const sampleMemories = [
        {
            id: generateId(),
            platform: 'instagram',
            type: 'photo',
            content: 'Beautiful sunset from today 🌅 #grateful',
            media: 'https://picsum.photos/400/400?random=1',
            createdAt: new Date(Date.now() - 6 * 3600000).toISOString(), // 6 hours ago
            syncedAt: new Date().toISOString(),
            tags: ['sunset', 'nature'],
            likes: 23,
            comments: 5
        },
        {
            id: generateId(),
            platform: 'twitter',
            type: 'tweet',
            content: 'Just discovered this amazing new app for preserving memories! 🎉',
            media: null,
            createdAt: new Date(Date.now() - 12 * 3600000).toISOString(), // 12 hours ago
            syncedAt: new Date().toISOString(),
            tags: [],
            likes: 12,
            comments: 3
        }
    ];
    
    AppState.memories = sampleMemories;
    
    // Save the demo data
    storageManager.save({
        memories: AppState.memories,
        dailyStats: AppState.dailyStats
    });
}

// Storage and UI Updates
function updateStorageIndicator() {
    const indicator = $('#storage-indicator');
    const storageIcon = indicator.querySelector('.storage-icon');
    const storageText = indicator.querySelector('.storage-text');
    const upgradeBtn = $('#upgrade-nav-btn');
    
    if (AppState.storageType === 'cloud') {
        storageIcon.textContent = '☁️';
        storageText.textContent = 'Cloud';
        indicator.style.background = 'var(--gradient-primary)';
        upgradeBtn.style.display = 'none';
    } else {
        storageIcon.textContent = '💾';
        storageText.textContent = 'Local';
        indicator.style.background = 'var(--bg-secondary)';
        upgradeBtn.style.display = 'flex';
    }
}

function updateCounts() {
    const memoryCount = $('#memory-count');
    const capsuleCount = $('#capsule-count');
    
    if (memoryCount) memoryCount.textContent = AppState.memories.length;
    if (capsuleCount) capsuleCount.textContent = AppState.timeCapsules.length;
}

function updateDailyStats() {
    const postsToday = $('#posts-today');
    const syncedToday = $('#synced-today');
    
    if (postsToday) postsToday.textContent = AppState.dailyStats.postsSavedToday;
    if (syncedToday) syncedToday.textContent = AppState.dailyStats.autoSyncedToday;
}

function updateNotificationBadge() {
    const badge = $('#notification-badge');
    const unreadCount = AppState.notifications.filter(n => !n.read).length;
    
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

function updateProfileInfo() {
    const profileName = $('#profile-name');
    const profileEmail = $('#profile-email');
    
    if (profileName && AppState.currentUser) {
        profileName.textContent = AppState.currentUser.name;
    }
    if (profileEmail && AppState.currentUser) {
        profileEmail.textContent = AppState.currentUser.email;
    }
}

function updateConnectedPlatforms() {
    const container = $('#connected-platforms');
    
    if (AppState.connectedPlatforms.length === 0) {
        container.innerHTML = `
            <div class="empty-platforms">
                <p>No platforms connected</p>
                <button class="connect-first-btn" onclick="showConnectModal()">
                    Connect Platform
                </button>
            </div>
        `;
    } else {
        const platformsList = AppState.connectedPlatforms.map(platform => {
            const config = PLATFORMS[platform.type];
            return `
                <div class="connected-platform">
                    <div class="platform-icon">${config.icon}</div>
                    <div class="platform-info">
                        <span class="platform-name">${config.name}</span>
                        <span class="platform-status">Connected</span>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = platformsList;
    }
}

function updateActivityFeed() {
    const feed = $('#activity-feed');
    
    // Generate activity items based on recent actions
    const activities = [
        {
            icon: '🎉',
            title: 'Welcome to Story Vault!',
            time: 'Just now',
            type: 'welcome'
        }
    ];

    // Add daily stats to activity if any exist
    if (AppState.dailyStats.postsSavedToday > 0) {
        activities.unshift({
            icon: '📊',
            title: `${AppState.dailyStats.postsSavedToday} posts saved today`,
            time: 'Today',
            type: 'stats'
        });
    }
    
    if (AppState.dailyStats.autoSyncedToday > 0) {
        activities.unshift({
            icon: '🔄',
            title: `Auto-synced ${AppState.dailyStats.autoSyncedToday} items`,
            time: AppState.dailyStats.lastSyncTime ? formatTimeAgo(AppState.dailyStats.lastSyncTime) : 'Today',
            type: 'sync'
        });
    }

    // Add recent memories and capsules to activity
    AppState.memories.slice(-3).forEach(memory => {
        activities.unshift({
            icon: '📸',
            title: 'New memory added',
            time: formatTimeAgo(memory.createdAt),
            type: 'memory'
        });
    });

    AppState.timeCapsules.slice(-2).forEach(capsule => {
        activities.unshift({
            icon: '⏰',
            title: 'Time capsule created',
            time: formatTimeAgo(capsule.createdAt),
            type: 'capsule'
        });
    });

    feed.innerHTML = activities.slice(0, 5).map(activity => `
        <div class="activity-item">
            <div class="activity-icon">${activity.icon}</div>
            <div class="activity-text">
                <span class="activity-title">${activity.title}</span>
                <span class="activity-time">${activity.time}</span>
            </div>
        </div>
    `).join('');
}

function formatTimeAgo(date) {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(date);
}

// Platform Connection
function showConnectModal() {
    const modal = $('#connect-modal');
    modal.classList.add('active');
    
    // Update platform availability in modal
    updateConnectModalPlatforms();
}

function updateConnectModalPlatforms() {
    const grid = $('.platform-connect-grid');
    const isLocal = AppState.storageType === 'local';
    
    const platformCards = Object.entries(PLATFORMS).map(([key, platform]) => {
        const isConnected = AppState.connectedPlatforms.some(p => p.type === key);
        const isAvailable = !platform.premium || !isLocal;
        const isPremium = platform.premium && isLocal;
        
        return `
            <div class="connect-card ${isPremium ? 'premium' : 'available'}" data-platform="${key}">
                <div class="connect-header">
                    <div class="platform-logo">${platform.icon}</div>
                    <div class="platform-info">
                        <h4>${platform.name}</h4>
                        <p>${getPlatformDescription(key)}</p>
                    </div>
                    <div class="connect-status ${isPremium ? 'premium' : 'available'}">
                        ${isConnected ? 'Connected' : (isPremium ? 'Premium' : 'Available')}
                    </div>
                </div>
                <button class="connect-button ${isPremium ? 'premium' : ''}" 
                        onclick="${isPremium ? 'showUpgradeModal()' : `connectPlatform('${key}')`}"
                        ${isConnected ? 'disabled' : ''}>
                    ${isConnected ? 'Connected ✓' : (isPremium ? 'Upgrade to Connect' : `Connect ${platform.name}`)}
                </button>
            </div>
        `;
    }).join('');
    
    grid.innerHTML = platformCards;
}

function getPlatformDescription(platform) {
    const descriptions = {
        instagram: 'Photos, stories, reels',
        twitter: 'Tweets, likes, media',
        facebook: 'Posts, photos, memories',
        spotify: 'Playlists, listening history',
        youtube: 'Videos, likes, playlists',
        tiktok: 'Videos, likes, favorites'
    };
    return descriptions[platform] || 'Content and media';
}

async function connectPlatform(platform) {
    try {
        showLoading(`Connecting to ${PLATFORMS[platform].name}...`);
        
        // Simulate OAuth flow
        if (AppState.storageType === 'cloud') {
            // Real OAuth for cloud users
            const authWindow = window.open(
                `${API_CONFIG.baseURL}${API_CONFIG.endpoints.auth}/${platform}`,
                'oauth-popup',
                'width=500,height=600,scrollbars=yes,resizable=yes'
            );
            
            // Listen for OAuth completion
            const checkAuth = setInterval(() => {
                try {
                    if (authWindow.closed) {
                        clearInterval(checkAuth);
                        handleOAuthResult(platform);
                    }
                } catch (error) {
                    // Cross-origin restrictions - window closed
                    clearInterval(checkAuth);
                    handleOAuthResult(platform);
                }
            }, 1000);
            
        } else {
            // Mock connection for local users
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const newConnection = {
                type: platform,
                connected: true,
                connectedAt: new Date().toISOString(),
                userId: generateId(),
                accessToken: 'mock-token-' + platform
            };
            
            AppState.connectedPlatforms.push(newConnection);
            await storageManager.save({ connectedPlatforms: AppState.connectedPlatforms });
            
            showNotification(`Successfully connected to ${PLATFORMS[platform].name}!`, 'success');
            updateConnectedPlatforms();
            updateCounts();
            closeModal('connect-modal');
            
            // Start syncing memories
            setTimeout(() => syncPlatform(platform), 1000);
        }
        
        hideLoading();
        
    } catch (error) {
        console.error('Failed to connect platform:', error);
        showNotification('Failed to connect. Please try again.', 'error');
        hideLoading();
    }

    trackEvent('platform_connect_attempt', {
        platform: platform,
        storageType: AppState.storageType
    });
}

async function handleOAuthResult(platform) {
    try {
        // Check if OAuth was successful
        const response = await fetch(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.platforms}/${platform}/status`, {
            headers: {
                'Authorization': `Bearer ${storageManager.getAuthToken()}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.connected) {
                AppState.connectedPlatforms.push({
                    type: platform,
                    connected: true,
                    connectedAt: new Date().toISOString(),
                    userId: data.userId,
                    accessToken: data.accessToken
                });
                
                await storageManager.save({ connectedPlatforms: AppState.connectedPlatforms });
                showNotification(`Successfully connected to ${PLATFORMS[platform].name}!`, 'success');
                updateConnectedPlatforms();
                updateCounts();
                closeModal('connect-modal');
                
                // Start syncing
                setTimeout(() => syncPlatform(platform), 1000);
            }
        }
        
    } catch (error) {
        console.error('OAuth result handling failed:', error);
        showNotification('Connection may have failed. Please try again.', 'error');
    }
}

// Sync Functions
async function syncPlatforms() {
    if (AppState.connectedPlatforms.length === 0) {
        showNotification('No platforms connected to sync', 'info');
        return;
    }

    const syncButton = $('#sync-button');
    const syncIcon = syncButton.querySelector('.sync-icon');
    
    syncButton.disabled = true;
    syncIcon.style.animation = 'spin 1s linear infinite';
    
    try {
        for (const platform of AppState.connectedPlatforms) {
            await syncPlatform(platform.type);
        }
        
        showNotification('Sync completed successfully!', 'success');
        
    } catch (error) {
        console.error('Sync failed:', error);
        showNotification('Sync failed for some platforms', 'error');
    } finally {
        syncButton.disabled = false;
        syncIcon.style.animation = '';
    }

    trackEvent('sync_platforms', {
        platformCount: AppState.connectedPlatforms.length,
        storageType: AppState.storageType
    });
}

async function syncPlatform(platformType) {
    try {
        if (AppState.storageType === 'cloud') {
            // Real API sync for cloud users
            const response = await fetch(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.platforms}/${platformType}/sync`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${storageManager.getAuthToken()}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                // Add new memories from sync
                const newMemories = data.memories.map(memory => ({
                    ...memory,
                    id: generateId(),
                    platform: platformType,
                    syncedAt: new Date().toISOString()
                }));
                
                AppState.memories = [...AppState.memories, ...newMemories];
                await storageManager.save({ memories: AppState.memories });
            }
            
        } else {
            // Generate mock memories for local users
            const mockMemories = generateMockMemories(platformType, 3);
            AppState.memories = [...AppState.memories, ...mockMemories];
            
            // Update daily stats
            AppState.dailyStats.autoSyncedToday += mockMemories.length;
            AppState.dailyStats.postsSavedToday += mockMemories.length;
            AppState.dailyStats.lastSyncTime = new Date().toISOString();
            
            await storageManager.save({ 
                memories: AppState.memories,
                dailyStats: AppState.dailyStats
            });
            
            // Add notification for successful sync
            addNotification('🔄', `Synced ${platformType}`, `Added ${mockMemories.length} new memories from ${PLATFORMS[platformType].name}`, 'sync');
        }
        
        updateCounts();
        updateDailyStats();
        updateActivityFeed();
        hideEmptyState();
        loadMemories();
        
    } catch (error) {
        console.error(`Failed to sync ${platformType}:`, error);
        throw error;
    }
}

function generateMockMemories(platform, count = 3) {
    const templates = {
        instagram: [
            { type: 'photo', content: 'Beautiful sunset from today 🌅', media: 'https://picsum.photos/400/400?random=1' },
            { type: 'story', content: 'Coffee break ☕', media: 'https://picsum.photos/400/600?random=2' },
            { type: 'reel', content: 'Quick workout session 💪', media: 'https://picsum.photos/400/400?random=3' }
        ],
        twitter: [
            { type: 'tweet', content: 'Just discovered this amazing new app! 🎉', media: null },
            { type: 'tweet', content: 'Working from home has its perks... ☀️', media: 'https://picsum.photos/400/300?random=4' },
            { type: 'retweet', content: 'This is so true! 👏', media: null }
        ]
    };

    const platformTemplates = templates[platform] || templates.instagram;
    const memories = [];
    
    for (let i = 0; i < count; i++) {
        const template = platformTemplates[i % platformTemplates.length];
        memories.push({
            id: generateId(),
            platform: platform,
            type: template.type,
            content: template.content,
            media: template.media,
            createdAt: new Date(Date.now() - (i * 3600000)).toISOString(), // Hours ago
            syncedAt: new Date().toISOString(),
            tags: [],
            likes: Math.floor(Math.random() * 100),
            comments: Math.floor(Math.random() * 20)
        });
    }
    
    return memories;
}

// Memory Management
function loadMemories() {
    const memoryGrid = $('#memory-grid');
    const emptyState = $('#empty-state');
    
    if (AppState.memories.length === 0) {
        emptyState.style.display = 'block';
        memoryGrid.style.display = 'none';
        return;
    }
    
    emptyState.style.display = 'none';
    memoryGrid.style.display = 'grid';
    
    // Sort memories by date
    const sortedMemories = [...AppState.memories].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    memoryGrid.innerHTML = sortedMemories.map(memory => 
        createMemoryCard(memory)
    ).join('');
}

function createMemoryCard(memory) {
    const platform = PLATFORMS[memory.platform];
    const hasMedia = memory.media && memory.media !== null;
    
    return `
        <div class="memory-card" data-memory-id="${memory.id}">
            <div class="memory-header">
                <div class="memory-platform">
                    <span class="platform-icon ${memory.platform}-icon">${platform.icon}</span>
                    <span class="platform-name">${platform.name}</span>
                </div>
                <div class="memory-date">${formatDate(memory.createdAt)}</div>
            </div>
            
            ${hasMedia ? `
                <div class="memory-media">
                    <img src="${memory.media}" alt="Memory media" loading="lazy" />
                </div>
            ` : ''}
            
            <div class="memory-content">
                <p>${memory.content}</p>
            </div>
            
            <div class="memory-footer">
                <div class="memory-stats">
                    <span class="stat">❤️ ${memory.likes || 0}</span>
                    <span class="stat">💬 ${memory.comments || 0}</span>
                </div>
                <div class="memory-actions">
                    <button class="action-btn" onclick="addToTimeCapsule('${memory.id}')" title="Add to Time Capsule">
                        📦
                    </button>
                    <button class="action-btn" onclick="shareMemory('${memory.id}')" title="Share">
                        📤
                    </button>
                </div>
            </div>
        </div>
    `;
}

function hideEmptyState() {
    const emptyState = $('#empty-state');
    const memoryGrid = $('#memory-grid');
    
    if (emptyState && memoryGrid) {
        emptyState.style.display = 'none';
        memoryGrid.style.display = 'grid';
    }
}

function sortMemories(sortType) {
    switch (sortType) {
        case 'recent':
            AppState.memories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
        case 'oldest':
            AppState.memories.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            break;
        case 'platform':
            AppState.memories.sort((a, b) => a.platform.localeCompare(b.platform));
            break;
        case 'type':
            AppState.memories.sort((a, b) => a.type.localeCompare(b.type));
            break;
    }
    
    loadMemories();
    
    trackEvent('memories_sorted', {
        sortType: sortType
    });
}

// Notification Management
function showNotifications() {
    const panel = $('#notification-panel');
    const profile = $('#profile-dropdown');
    
    // Close profile if open
    if (profile) profile.style.display = 'none';
    
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
    
    // Load notifications
    loadNotifications();
}

function closeNotifications() {
    const panel = $('#notification-panel');
    if (panel) panel.style.display = 'none';
}

function loadNotifications() {
    const list = $('#notification-list');
    if (!list) return;
    
    // Add some sample notifications if none exist
    if (AppState.notifications.length === 0) {
        AppState.notifications = [
            {
                id: 1,
                icon: '🎉',
                title: 'Welcome to Story Vault!',
                text: 'Start connecting your social accounts to preserve your stories.',
                time: new Date(),
                read: false,
                type: 'welcome'
            },
            {
                id: 2,
                icon: '🔄',
                title: 'Auto-sync enabled',
                text: 'Your connected platforms will now sync automatically every 6 hours.',
                time: new Date(Date.now() - 3600000), // 1 hour ago
                read: false,
                type: 'sync'
            }
        ];
    }
    
    const notificationHtml = AppState.notifications.map(notification => `
        <div class="notification-item ${notification.read ? '' : 'unread'}" data-notification-id="${notification.id}">
            <div class="notification-icon">${notification.icon}</div>
            <div class="notification-content">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-text">${notification.text}</div>
                <div class="notification-time">${formatTimeAgo(notification.time)}</div>
            </div>
        </div>
    `).join('');
    
    list.innerHTML = notificationHtml;
    
    // Mark as read when clicked
    $$('.notification-item').forEach(item => {
        item.addEventListener('click', () => {
            const notificationId = parseInt(item.dataset.notificationId);
            markNotificationAsRead(notificationId);
        });
    });
}

function markNotificationAsRead(notificationId) {
    const notification = AppState.notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
        notification.read = true;
        updateNotificationBadge();
        loadNotifications();
        
        // Save to storage
        storageManager.save({ notifications: AppState.notifications });
    }
}

function markAllAsRead() {
    AppState.notifications.forEach(n => n.read = true);
    updateNotificationBadge();
    loadNotifications();
    storageManager.save({ notifications: AppState.notifications });
}

function addNotification(icon, title, text, type = 'info') {
    const notification = {
        id: Date.now(),
        icon,
        title,
        text,
        time: new Date(),
        read: false,
        type
    };
    
    AppState.notifications.unshift(notification);
    updateNotificationBadge();
    
    // Keep only last 20 notifications
    if (AppState.notifications.length > 20) {
        AppState.notifications = AppState.notifications.slice(0, 20);
    }
    
    storageManager.save({ notifications: AppState.notifications });
    
    // If notification panel is open, refresh it
    const panel = $('#notification-panel');
    if (panel && panel.style.display === 'block') {
        loadNotifications();
    }
}

// Profile Management
function showProfileMenu() {
    const profile = $('#profile-dropdown');
    const notifications = $('#notification-panel');
    
    // Close notifications if open
    if (notifications) notifications.style.display = 'none';
    
    if (profile) {
        profile.style.display = profile.style.display === 'none' ? 'block' : 'none';
    }
    
    updateProfileInfo();
}

function openAccountSettings() {
    $('#profile-dropdown').style.display = 'none';
    showNotification('Account settings will be available in the next version!', 'info');
}

function openPreferences() {
    $('#profile-dropdown').style.display = 'none';
    showNotification('Preferences panel coming soon!', 'info');
}

function exportUserData() {
    $('#profile-dropdown').style.display = 'none';
    
    // Create export data
    const exportData = {
        user: AppState.currentUser,
        memories: AppState.memories,
        timeCapsules: AppState.timeCapsules,
        connectedPlatforms: AppState.connectedPlatforms,
        exportDate: new Date().toISOString()
    };
    
    // Download as JSON
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `story-vault-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Data exported successfully!', 'success');
}

function showHelpModal() {
    $('#profile-dropdown').style.display = 'none';
    showNotification('Help documentation coming soon! Email support@storyvault.com for assistance.', 'info');
}

function confirmLogout() {
    $('#profile-dropdown').style.display = 'none';
    
    if (confirm('Are you sure you want to sign out? Your local data will be preserved.')) {
        // Clear auth data but keep local memories
        localStorage.removeItem('storyvault-auth-token');
        sessionStorage.clear();
        
        // Reset to onboarding
        location.reload();
    }
}

// Modal Management
function closeModal(modalId) {
    const modal = $(`#${modalId}`);
    if (modal) {
        modal.classList.remove('active');
    }
}

function showUpgradeModal() {
    // Check if user is already on cloud storage
    if (AppState.storageType === 'cloud') {
        showNotification('You are already using premium features!', 'info');
        return;
    }
    
    const modal = $('#storage-migration-modal');
    
    // Update migration information
    const currentStorageType = $('#current-storage-type');
    const migrationCount = $('#migration-count');
    
    if (currentStorageType) currentStorageType.textContent = 'Local Storage';
    if (migrationCount) migrationCount.textContent = AppState.memories.length;
    
    modal.classList.add('active');
}

async function startMigration() {
    try {
        showLoading('Preparing cloud migration...');
        
        // Simulate upgrade process
        if (window.location.hostname !== 'localhost') {
            // Real Stripe checkout in production
            const response = await fetch(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.upgrade}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    plan: 'premium',
                    trial: true
                })
            });
            
            if (response.ok) {
                const { checkoutUrl } = await response.json();
                window.location.href = checkoutUrl;
            }
        } else {
            // Mock migration for development
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            AppState.storageType = 'cloud';
            await storageManager.save({ storageType: 'cloud' });
            
            updateStorageIndicator();
            updatePlatformAvailability();
            
            closeModal('storage-migration-modal');
            showNotification('Welcome to Story Vault Premium! 🎉', 'success');
        }
        
        hideLoading();
        
    } catch (error) {
        console.error('Migration failed:', error);
        showNotification('Migration failed. Please try again.', 'error');
        hideLoading();
    }

    trackEvent('upgrade_attempt', {
        fromStorage: 'local',
        toStorage: 'cloud'
    });
}

// Manual Memory Creation
function openCreateModal() {
    // For now, create a simple prompt-based memory creation
    const content = prompt('Enter your memory:');
    if (content && content.trim()) {
        createMemory({
            content: content.trim(),
            type: 'manual',
            platform: 'manual'
        });
    }
}

function createMemory(memoryData) {
    const newMemory = {
        id: generateId(),
        ...memoryData,
        createdAt: new Date().toISOString(),
        syncedAt: new Date().toISOString(),
        likes: 0,
        comments: 0,
        tags: []
    };
    
    AppState.memories.unshift(newMemory);
    
    // Update daily stats
    AppState.dailyStats.postsSavedToday += 1;
    
    storageManager.save({ 
        memories: AppState.memories,
        dailyStats: AppState.dailyStats
    });
    
    updateCounts();
    updateDailyStats();
    updateActivityFeed();
    hideEmptyState();
    loadMemories();
    
    showNotification('Memory added successfully!', 'success');
    addNotification('📝', 'New memory created', 'You manually added a new memory to your collection', 'memory');
    
    trackEvent('memory_created', {
        type: 'manual'
    });
}

// Time Capsule Functions
function openCapsuleModal() {
    const modal = createCapsuleModal();
    document.body.appendChild(modal);
    modal.classList.add('active');
}

function createCapsuleModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'create-capsule-modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Create Time Capsule</h3>
                <button class="close-btn" onclick="closeModal('create-capsule-modal')">&times;</button>
            </div>
            <div class="modal-body">
                <form id="capsule-form">
                    <div class="form-group">
                        <label for="capsule-name">Capsule Name</label>
                        <input type="text" id="capsule-name" required placeholder="My Time Capsule">
                    </div>
                    
                    <div class="form-group">
                        <label for="capsule-unlock-date">Unlock Date</label>
                        <input type="date" id="capsule-unlock-date" required min="${new Date().toISOString().split('T')[0]}">
                    </div>
                    
                    <div class="form-group">
                        <label for="capsule-description">Description (Optional)</label>
                        <textarea id="capsule-description" placeholder="What makes this capsule special?"></textarea>
                    </div>
                    
                    <div class="memory-selection">
                        <h4>Select Memories</h4>
                        <div class="memory-checkboxes" id="memory-checkboxes">
                            ${AppState.memories.map(memory => `
                                <div class="memory-checkbox">
                                    <input type="checkbox" id="memory-${memory.id}" value="${memory.id}">
                                    <label for="memory-${memory.id}">
                                        <span class="memory-preview">${memory.content.substring(0, 50)}...</span>
                                        <span class="memory-platform">${PLATFORMS[memory.platform]?.icon || '📝'}</span>
                                    </label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="closeModal('create-capsule-modal')">Cancel</button>
                <button class="btn-primary" onclick="createTimeCapsule()">Create Capsule</button>
            </div>
        </div>
    `;
    
    return modal;
}

function createTimeCapsule() {
    const form = $('#capsule-form');
    const formData = new FormData(form);
    
    const name = $('#capsule-name').value;
    const unlockDate = $('#capsule-unlock-date').value;
    const description = $('#capsule-description').value;
    
    if (!name || !unlockDate) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    // Get selected memories
    const selectedMemories = [];
    $$('#memory-checkboxes input[type="checkbox"]:checked').forEach(checkbox => {
        selectedMemories.push(checkbox.value);
    });
    
    const newCapsule = {
        id: generateId(),
        name: name,
        description: description,
        unlockDate: unlockDate,
        createdAt: new Date().toISOString(),
        memories: selectedMemories,
        status: 'sealed',
        unlocked: false
    };
    
    AppState.timeCapsules.push(newCapsule);
    storageManager.save({ timeCapsules: AppState.timeCapsules });
    
    updateCounts();
    updateActivityFeed();
    loadTimeCapsules();
    
    closeModal('create-capsule-modal');
    document.body.removeChild($('#create-capsule-modal'));
    
    showNotification('Time capsule created successfully!', 'success');
    
    trackEvent('capsule_created', {
        memoryCount: selectedMemories.length,
        unlockDate: unlockDate
    });
}

function loadTimeCapsules() {
    const capsuleList = $('#capsule-list');
    
    if (AppState.timeCapsules.length === 0) {
        capsuleList.innerHTML = `
            <div class="empty-capsules">
                <div class="empty-capsule-icon">📦</div>
                <p>No time capsules yet</p>
                <small>Create your first capsule to preserve memories for the future</small>
            </div>
        `;
        return;
    }
    
    const capsuleCards = AppState.timeCapsules.map(capsule => `
        <div class="capsule-card ${capsule.unlocked ? 'unlocked' : 'sealed'}">
            <div class="capsule-header">
                <div class="capsule-icon">${capsule.unlocked ? '📂' : '📦'}</div>
                <div class="capsule-info">
                    <h4>${capsule.name}</h4>
                    <p class="capsule-unlock-date">
                        ${capsule.unlocked ? 'Unlocked' : 'Unlocks ' + formatDate(capsule.unlockDate)}
                    </p>
                </div>
            </div>
            <div class="capsule-stats">
                <span>${capsule.memories.length} memories</span>
            </div>
        </div>
    `).join('');
    
    capsuleList.innerHTML = capsuleCards;
}

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '16px 24px',
        borderRadius: '12px',
        color: 'white',
        zIndex: '9999',
        maxWidth: '400px',
        opacity: '0',
        transform: 'translateX(100%)',
        transition: 'all 0.3s ease'
    });
    
    // Set background color based on type
    const colors = {
        success: '#22C55E',
        error: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6'
    };
    
    notification.style.background = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Loading States
function showLoading(message = 'Loading...') {
    const overlay = $('#loading-overlay');
    const messageEl = $('#loading-message');
    
    if (messageEl) messageEl.textContent = message;
    overlay.classList.add('active');
}

function hideLoading() {
    const overlay = $('#loading-overlay');
    overlay.classList.remove('active');
}

// Analytics and Tracking
function trackEvent(eventName, properties = {}) {
    // In production, send to analytics service
    console.log('Event tracked:', eventName, properties);
    
    // Store events locally for now
    const events = JSON.parse(localStorage.getItem('storyvault-analytics') || '[]');
    events.push({
        event: eventName,
        properties: properties,
        timestamp: new Date().toISOString(),
        sessionId: getSessionId()
    });
    
    // Keep only last 100 events
    if (events.length > 100) {
        events.splice(0, events.length - 100);
    }
    
    localStorage.setItem('storyvault-analytics', JSON.stringify(events));
}

function getSessionId() {
    let sessionId = sessionStorage.getItem('storyvault-session-id');
    if (!sessionId) {
        sessionId = generateId();
        sessionStorage.setItem('storyvault-session-id', sessionId);
    }
    return sessionId;
}

// Keyboard Shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // CMD/Ctrl + N: New memory
        if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
            e.preventDefault();
            openCreateModal();
        }
        
        // CMD/Ctrl + T: New time capsule
        if ((e.metaKey || e.ctrlKey) && e.key === 't') {
            e.preventDefault();
            openCapsuleModal();
        }
        
        // CMD/Ctrl + K: Connect platform
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            showConnectModal();
        }
        
        // Escape: Close modals
        if (e.key === 'Escape') {
            $$('.modal.active').forEach(modal => {
                modal.classList.remove('active');
            });
        }
    });
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Check if user has completed onboarding
    const savedData = storageManager.loadLocal();
    if (savedData && savedData.onboardingCompleted) {
        // Skip onboarding, show main app
        AppState = { ...AppState, ...savedData, isOnboarding: false };
        const onboarding = $('#onboarding-flow');
        const mainApp = $('#main-app');
        if (onboarding) onboarding.style.display = 'none';
        if (mainApp) mainApp.style.display = 'flex';
        initializeMainApp();
    } else {
        // Ensure onboarding is visible for new users
        const onboarding = $('#onboarding-flow');
        const mainApp = $('#main-app');
        if (onboarding) onboarding.style.display = 'block';
        if (mainApp) mainApp.style.display = 'none';
    }
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Setup click handlers for modal backgrounds
    $$('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        const notificationPanel = $('#notification-panel');
        const profileDropdown = $('#profile-dropdown');
        const notificationButton = $('#notification-button');
        const profileButton = $('#profile-button');
        
        // Close notification panel if clicked outside
        if (notificationPanel && 
            notificationPanel.style.display === 'block' && 
            !notificationPanel.contains(e.target) && 
            !notificationButton.contains(e.target)) {
            notificationPanel.style.display = 'none';
        }
        
        // Close profile dropdown if clicked outside
        if (profileDropdown && 
            profileDropdown.style.display === 'block' && 
            !profileDropdown.contains(e.target) && 
            !profileButton.contains(e.target)) {
            profileDropdown.style.display = 'none';
        }
    });
    
    // Initialize floating animations
    initializeFloatingAnimations();
    
    console.log('Story Vault app initialized');
});

function initializeFloatingAnimations() {
    // Add staggered delays to floating elements
    $$('.float-item').forEach((item, index) => {
        item.style.animationDelay = `${index * 2}s`;
    });
    
    // Add sparkle animations
    $$('.sparkle').forEach((sparkle, index) => {
        sparkle.style.animationDelay = `${index * 1}s`;
    });
}

// Export for potential testing or external access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AppState, storageManager, PLATFORMS };
}