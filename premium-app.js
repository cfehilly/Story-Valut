// Memento Premium - Digital Time Capsule App with Subscription Model

// App state with premium features
let currentScreen = 1;
const totalScreens = 4;
let currentTab = 'home';
let memories = [];
let capsules = [];
let userPlan = 'free'; // 'free', 'premium', 'trial'
let trialEndDate = null;

// Plan limits and features
const planLimits = {
    free: {
        capsules: 3,
        platforms: 2,
        allowedPlatforms: ['instagram', 'twitter'],
        features: ['basic-memories', 'basic-capsules']
    },
    premium: {
        capsules: Infinity,
        platforms: Infinity,
        allowedPlatforms: ['instagram', 'twitter', 'facebook', 'youtube', 'tiktok', 'spotify', 'linkedin'],
        features: ['unlimited-memories', 'unlimited-capsules', 'cloud-sync', 'ai-insights', 'custom-themes', 'priority-support']
    },
    trial: {
        capsules: Infinity,
        platforms: Infinity,
        allowedPlatforms: ['instagram', 'twitter', 'facebook', 'youtube', 'tiktok', 'spotify', 'linkedin'],
        features: ['unlimited-memories', 'unlimited-capsules', 'cloud-sync', 'ai-insights', 'custom-themes', 'priority-support']
    }
};

let socialConnections = {
    twitter: false,
    instagram: false,
    facebook: false,
    youtube: false,
    tiktok: false,
    spotify: false
};

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    console.log('Memento Premium app initializing...');
    
    // Initialize onboarding
    initializeOnboarding();
    
    // Initialize main app
    initializeMainApp();
    
    // Load saved data
    loadAppData();
    
    // Setup event listeners
    setupEventListeners();
    
    // Update UI based on current plan
    updatePlanUI();
    
    // Check trial status
    checkTrialStatus();
    
    console.log('Memento Premium app initialized successfully');
});

// Premium Feature Management
function updatePlanUI() {
    const currentLimits = planLimits[userPlan];
    
    // Update plan indicator
    const planIndicator = document.getElementById('plan-indicator');
    if (planIndicator) {
        planIndicator.textContent = userPlan.toUpperCase();
        planIndicator.className = `plan-indicator ${userPlan}`;
    }
    
    // Update usage stats
    updateUsageStats();
    
    // Update platform availability
    updatePlatformAvailability();
    
    // Update welcome stats in onboarding
    updateWelcomeStats();
    
    // Show/hide premium banner
    updatePremiumBanner();
}

function updateUsageStats() {
    const currentLimits = planLimits[userPlan];
    const connectedCount = Object.values(socialConnections).filter(Boolean).length;
    
    // Update hero stats
    const totalMemoriesEl = document.getElementById('total-memories');
    const connectedPlatformsEl = document.getElementById('connected-platforms');
    
    if (totalMemoriesEl) totalMemoriesEl.textContent = memories.length;
    if (connectedPlatformsEl) connectedPlatformsEl.textContent = connectedCount;
    
    // Update ready capsules bubble
    const readyCapsulesEl = document.getElementById('ready-capsules');
    const readyCapsules = capsules.filter(c => c.locked && new Date(c.unlockDate) <= new Date());
    if (readyCapsulesEl) {
        if (readyCapsules.length > 0) {
            readyCapsulesEl.style.display = 'block';
            readyCapsulesEl.querySelector('.stat-number').textContent = readyCapsules.length;
        } else {
            readyCapsulesEl.style.display = 'none';
        }
    }
    
    // Update account overview stats
    const capsuleCountHome = document.getElementById('capsule-count-home');
    const capsuleMaxHome = document.getElementById('capsule-max-home');
    const platformCountHome = document.getElementById('platform-count-home');
    const platformMaxHome = document.getElementById('platform-max-home');
    
    if (capsuleCountHome) capsuleCountHome.textContent = capsules.length;
    if (capsuleMaxHome) {
        capsuleMaxHome.textContent = currentLimits.capsules === Infinity ? '∞' : currentLimits.capsules;
    }
    if (platformCountHome) platformCountHome.textContent = connectedCount;
    if (platformMaxHome) {
        platformMaxHome.textContent = currentLimits.platforms === Infinity ? '∞' : currentLimits.platforms;
    }
    
    // Update plan badge
    const planBadge = document.getElementById('plan-badge');
    if (planBadge) {
        planBadge.textContent = userPlan.toUpperCase() + (userPlan === 'trial' ? ' (TRIAL)' : ' PLAN');
        planBadge.className = `plan-badge ${userPlan}`;
    }
    
    // Update main overview action
    const mainOverviewAction = document.getElementById('main-overview-action');
    if (mainOverviewAction) {
        if (connectedCount === 0) {
            mainOverviewAction.textContent = 'Connect Your First Account';
            mainOverviewAction.onclick = () => showTab('connect');
        } else if (userPlan === 'free') {
            mainOverviewAction.textContent = 'Upgrade to Premium';
            mainOverviewAction.onclick = () => showPremiumModal();
        } else {
            mainOverviewAction.textContent = 'View All Features';
            mainOverviewAction.onclick = () => showTab('discover');
        }
    }
}

function updatePlatformAvailability() {
    const currentLimits = planLimits[userPlan];
    const allowedPlatforms = currentLimits.allowedPlatforms;
    
    // Update social cards
    Object.keys(socialConnections).forEach(platform => {
        const card = document.querySelector(`[data-platform="${platform}"]`);
        if (card) {
            const isAllowed = allowedPlatforms.includes(platform);
            const connectBtn = card.querySelector('.connect-btn');
            
            if (isAllowed) {
                card.classList.remove('premium-locked');
                if (connectBtn) {
                    connectBtn.classList.remove('premium-required');
                    connectBtn.onclick = () => connectSocial(platform);
                    connectBtn.textContent = socialConnections[platform] ? 'Disconnect' : 'Connect';
                }
            } else {
                card.classList.add('premium-locked');
                if (connectBtn) {
                    connectBtn.classList.add('premium-required');
                    connectBtn.onclick = () => showPremiumModal();
                    connectBtn.textContent = 'Upgrade';
                }
            }
        }
    });
}

function updateWelcomeStats() {
    const currentLimits = planLimits[userPlan];
    
    const capsuleLimit = document.getElementById('capsule-limit');
    const platformLimit = document.getElementById('platform-limit');
    
    if (capsuleLimit) {
        capsuleLimit.textContent = currentLimits.capsules === Infinity ? '∞' : currentLimits.capsules;
    }
    if (platformLimit) {
        platformLimit.textContent = currentLimits.platforms === Infinity ? '∞' : currentLimits.platforms;
    }
}

function updatePremiumBanner() {
    const banner = document.getElementById('premium-banner');
    if (!banner) return;
    
    if (userPlan === 'free') {
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

function checkTrialStatus() {
    if (userPlan === 'trial' && trialEndDate) {
        const now = new Date();
        const trialEnd = new Date(trialEndDate);
        
        if (now > trialEnd) {
            // Trial expired, downgrade to free
            userPlan = 'free';
            showNotification('Your free trial has ended. Upgrade to Premium to continue using advanced features.', 'info', 8000);
            updatePlanUI();
            saveAppData();
        } else {
            // Show trial countdown
            const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 3) {
                showNotification(`Your free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Upgrade now to keep your premium features!`, 'warning', 6000);
            }
        }
    }
}

// Premium Feature Gating
function checkCapsuleLimit() {
    const currentLimits = planLimits[userPlan];
    
    if (capsules.length >= currentLimits.capsules) {
        showLimitModal('time capsule');
        return false;
    }
    
    openCapsuleModal();
    return true;
}

function checkPlatformLimit(platform) {
    const currentLimits = planLimits[userPlan];
    const connectedCount = Object.values(socialConnections).filter(Boolean).length;
    
    if (!currentLimits.allowedPlatforms.includes(platform)) {
        showPremiumModal();
        return false;
    }
    
    if (connectedCount >= currentLimits.platforms) {
        showLimitModal('platform connection');
        return false;
    }
    
    return true;
}

function showLimitModal(featureType) {
    const modal = document.getElementById('limit-modal');
    const limitMessage = modal.querySelector('.limit-message p:first-child');
    
    if (limitMessage) {
        limitMessage.innerHTML = `You've reached your <strong>free plan limit</strong> for ${featureType}.`;
    }
    
    showModal('limit-modal');
}

// Premium Modal and Subscription
function showPremiumModal() {
    showModal('premium-modal');
}

function startTrial() {
    console.log('Starting premium trial');
    
    // Set trial period (7 days)
    const trialStart = new Date();
    trialEndDate = new Date(trialStart.getTime() + (7 * 24 * 60 * 60 * 1000));
    
    userPlan = 'trial';
    updatePlanUI();
    saveAppData();
    
    showNotification('🎉 Premium trial started! Enjoy all features for 7 days.', 'success', 5000);
    
    // Continue to next screen
    nextScreen(3);
}

function subscribePlan(planType) {
    console.log(`Subscribing to ${planType} plan`);
    
    // Show loading
    showLoading('Processing your subscription...');
    
    // Simulate payment processing
    setTimeout(() => {
        // In a real app, this would integrate with Stripe, Apple Pay, Google Play, etc.
        const success = Math.random() > 0.1; // 90% success rate for demo
        
        hideLoading();
        
        if (success) {
            userPlan = 'premium';
            trialEndDate = null; // Clear trial end date
            updatePlanUI();
            saveAppData();
            
            closeModal('premium-modal');
            showNotification(`🎉 Welcome to Memento Premium! Your ${planType} subscription is now active.`, 'success', 6000);
            
            // Show premium welcome experience
            showPremiumWelcome();
            
        } else {
            showNotification('Payment failed. Please try again or use a different payment method.', 'error', 5000);
        }
    }, 3000);
}

function showPremiumWelcome() {
    // Create a special welcome modal for new premium users
    const welcomeModal = document.createElement('div');
    welcomeModal.className = 'modal active premium-welcome-modal';
    welcomeModal.innerHTML = `
        <div class="modal-content premium-modal-content">
            <div class="modal-body" style="text-align: center; padding: 40px;">
                <div class="premium-crown-big">👑</div>
                <h2 style="margin: 20px 0; color: var(--charcoal-brown);">Welcome to Premium!</h2>
                <p style="margin-bottom: 30px;">You now have access to all premium features:</p>
                
                <div class="premium-features-list" style="text-align: left; max-width: 300px; margin: 0 auto 30px;">
                    <div class="premium-feature" style="margin-bottom: 12px;">
                        <span style="margin-right: 8px;">✨</span>
                        Unlimited time capsules
                    </div>
                    <div class="premium-feature" style="margin-bottom: 12px;">
                        <span style="margin-right: 8px;">🔗</span>
                        Connect all 6+ platforms
                    </div>
                    <div class="premium-feature" style="margin-bottom: 12px;">
                        <span style="margin-right: 8px;">☁️</span>
                        Cloud backup & sync
                    </div>
                    <div class="premium-feature" style="margin-bottom: 12px;">
                        <span style="margin-right: 8px;">🧠</span>
                        AI memory insights
                    </div>
                    <div class="premium-feature" style="margin-bottom: 12px;">
                        <span style="margin-right: 8px;">🎨</span>
                        Custom themes
                    </div>
                </div>
                
                <button class="btn-primary" onclick="closePremiumWelcome()">Start Exploring</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(welcomeModal);
}

function closePremiumWelcome() {
    const modal = document.querySelector('.premium-welcome-modal');
    if (modal) {
        modal.remove();
    }
}

function closePremiumBanner() {
    const banner = document.getElementById('premium-banner');
    if (banner) {
        banner.classList.add('hidden');
        // Remember that user dismissed the banner
        localStorage.setItem('memento-banner-dismissed', 'true');
    }
}

// Profile and Account Management
function showProfileModal() {
    updateProfileModal();
    showModal('profile-modal');
}

function updateProfileModal() {
    const currentPlan = document.getElementById('current-plan');
    const planDetails = document.getElementById('plan-details');
    const planManageBtn = document.querySelector('.plan-manage');
    
    if (currentPlan) {
        currentPlan.textContent = userPlan === 'trial' ? 'Premium Trial' : `${userPlan.charAt(0).toUpperCase() + userPlan.slice(1)} Plan`;
        currentPlan.className = `plan-name ${userPlan}`;
    }
    
    if (planDetails) {
        const currentLimits = planLimits[userPlan];
        const capsuleLimit = currentLimits.capsules === Infinity ? 'Unlimited' : currentLimits.capsules;
        const platformLimit = currentLimits.platforms === Infinity ? 'All' : currentLimits.platforms;
        planDetails.textContent = `${capsuleLimit} time capsules • ${platformLimit} platforms`;
    }
    
    if (planManageBtn) {
        if (userPlan === 'free') {
            planManageBtn.textContent = 'Upgrade';
            planManageBtn.onclick = () => showPremiumModal();
        } else {
            planManageBtn.textContent = 'Manage';
            planManageBtn.onclick = () => showSubscriptionManagement();
        }
    }
    
    // Update usage stats in profile
    const statsContainer = document.querySelector('.usage-overview');
    if (statsContainer) {
        const memoryCount = memories.length;
        const capsuleCount = capsules.length;
        const platformCount = Object.values(socialConnections).filter(Boolean).length;
        const currentLimits = planLimits[userPlan];
        
        statsContainer.innerHTML = `
            <div class="usage-stat">
                <span class="stat-label">Memories Created</span>
                <span class="stat-value">${memoryCount}</span>
            </div>
            <div class="usage-stat">
                <span class="stat-label">Time Capsules</span>
                <span class="stat-value">${capsuleCount} / ${currentLimits.capsules === Infinity ? '∞' : currentLimits.capsules}</span>
            </div>
            <div class="usage-stat">
                <span class="stat-label">Connected Platforms</span>
                <span class="stat-value">${platformCount} / ${currentLimits.platforms === Infinity ? '∞' : currentLimits.platforms}</span>
            </div>
            ${userPlan === 'trial' ? `
            <div class="usage-stat">
                <span class="stat-label">Trial Status</span>
                <span class="stat-value">${getTrialDaysLeft()} days left</span>
            </div>
            ` : ''}
        `;
    }
}

function getTrialDaysLeft() {
    if (!trialEndDate) return 0;
    const now = new Date();
    const trialEnd = new Date(trialEndDate);
    return Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
}

function showSubscriptionManagement() {
    // In a real app, this would link to billing portal (Stripe Customer Portal, etc.)
    showNotification('This would open your subscription management portal.', 'info', 4000);
}

// Override social connection with premium checking
function connectSocial(platform) {
    if (!checkPlatformLimit(platform)) {
        return;
    }
    
    console.log(`Attempting to connect ${platform}`);
    
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
    
    // Update modal content
    document.getElementById('platform-name').textContent = platformName;
    document.getElementById('platform-name-2').textContent = platformName;
    document.getElementById('platform-name-3').textContent = platformName;
    
    const iconElement = document.getElementById('connect-platform-icon');
    iconElement.className = `platform-icon ${platform}-icon`;
    iconElement.textContent = getSocialIcon(platform);
    
    // Show connection modal
    showModal('social-connect-modal');
    
    // Store current platform for authorization
    window.currentConnectingPlatform = platform;
}

// Enhanced onboarding functions
function initializeOnboarding() {
    // Ensure only first screen is visible
    for (let i = 2; i <= totalScreens; i++) {
        const screen = document.getElementById(`screen-${i}`);
        if (screen) {
            screen.classList.remove('active');
        }
    }
    
    // Ensure first screen is visible
    const firstScreen = document.getElementById('screen-1');
    if (firstScreen) {
        firstScreen.classList.add('active');
    }
    
    // Update welcome stats
    updateWelcomeStats();
}

function nextScreen(screenNumber) {
    console.log(`Transitioning from screen ${screenNumber} to screen ${screenNumber + 1}`);
    
    const currentScreenElement = document.getElementById(`screen-${screenNumber}`);
    const nextScreenElement = document.getElementById(`screen-${screenNumber + 1}`);
    
    if (!currentScreenElement || !nextScreenElement) {
        console.error('Screen elements not found');
        return;
    }
    
    // Add haptic feedback
    if ('vibrate' in navigator) {
        navigator.vibrate(50);
    }
    
    // Play transition sound
    playTransitionSound();
    
    // Hide current screen
    currentScreenElement.classList.remove('active');
    
    // Show next screen
    setTimeout(() => {
        nextScreenElement.classList.add('active');
        currentScreen = screenNumber + 1;
        console.log(`Now on screen ${currentScreen}`);
    }, 300);
}

function showMainApp() {
    console.log('Showing main app');
    
    const onboardingFlow = document.getElementById('onboarding-flow');
    const mainApp = document.getElementById('main-app');
    
    // Hide onboarding with animation
    onboardingFlow.style.transform = 'translateY(-100%)';
    onboardingFlow.style.opacity = '0';
    
    setTimeout(() => {
        onboardingFlow.style.display = 'none';
        mainApp.style.display = 'flex';
        
        // Animate main app entrance
        setTimeout(() => {
            mainApp.style.opacity = '1';
            mainApp.style.transform = 'translateY(0)';
        }, 100);
        
        // Load initial data
        loadRecentMemories();
        loadCapsules();
        loadTimeline();
        
        // Update UI for current plan
        updatePlanUI();
        
    }, 600);
}

// Enhanced data persistence with premium features
function saveAppData() {
    const data = {
        memories,
        capsules,
        socialConnections,
        userPlan,
        trialEndDate,
        lastSaved: new Date().toISOString()
    };
    
    localStorage.setItem('memento-premium-data', JSON.stringify(data));
}

function loadAppData() {
    const saved = localStorage.getItem('memento-premium-data');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            memories = data.memories || [];
            capsules = data.capsules || [];
            socialConnections = data.socialConnections || socialConnections;
            userPlan = data.userPlan || 'free';
            trialEndDate = data.trialEndDate;
            
            console.log(`Loaded ${memories.length} memories, ${capsules.length} capsules, plan: ${userPlan}`);
        } catch (error) {
            console.error('Error loading saved data:', error);
        }
    }
    
    // Check if banner was dismissed
    const bannerDismissed = localStorage.getItem('memento-banner-dismissed');
    if (bannerDismissed) {
        const banner = document.getElementById('premium-banner');
        if (banner) {
            banner.classList.add('hidden');
        }
    }
}

// Import base functionality from app.js
// Main App Functions
function initializeMainApp() {
    const mainApp = document.getElementById('main-app');
    if (mainApp) {
        mainApp.style.opacity = '0';
        mainApp.style.transform = 'translateY(20px)';
        mainApp.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
    }
}

function setupEventListeners() {
    // Tab navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            showTab(tab);
        });
    });
    
    // File upload handling
    const fileUpload = document.getElementById('file-upload');
    const fileInput = document.getElementById('memory-file');
    
    if (fileUpload && fileInput) {
        fileUpload.addEventListener('click', () => fileInput.click());
        fileUpload.addEventListener('dragover', handleDragOver);
        fileUpload.addEventListener('drop', handleFileDrop);
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Tab Management
function showTab(tabName) {
    console.log(`Switching to ${tabName} tab`);
    
    // Update tab buttons
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });
    
    // Update tab content
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabPanes.forEach(pane => {
        pane.classList.remove('active');
    });
    
    const targetPane = document.getElementById(`${tabName}-tab`);
    if (targetPane) {
        targetPane.classList.add('active');
    }
    
    currentTab = tabName;
    
    // Load tab-specific data
    switch(tabName) {
        case 'home':
            loadRecentMemories();
            updateUsageStats();
            break;
        case 'connect':
            updatePlatformAvailability();
            break;
        case 'capsules':
            loadCapsules();
            break;
        case 'discover':
            loadTimeline();
            break;
    }
}

// Memory Management
function addMemory(memory) {
    memories.unshift(memory);
    saveAppData();
    updateUsageStats();
    console.log('Added memory:', memory.title);
}

function openCreateModal() {
    showModal('create-memory-modal');
    document.getElementById('memory-date').value = new Date().toISOString().split('T')[0];
}

function saveMemory() {
    const form = document.getElementById('memory-form');
    
    const memory = {
        id: Date.now(),
        type: document.getElementById('memory-type').value,
        title: document.getElementById('memory-title').value,
        description: document.getElementById('memory-description').value,
        date: new Date(document.getElementById('memory-date').value || Date.now()),
        tags: document.getElementById('memory-tags').value.split(',').map(tag => tag.trim()).filter(tag => tag),
        platform: 'manual',
        files: []
    };
    
    if (!memory.title.trim()) {
        showNotification('Please enter a title for your memory', 'error');
        return;
    }
    
    addMemory(memory);
    closeModal('create-memory-modal');
    showNotification('Memory saved successfully!', 'success');
    
    form.reset();
    loadRecentMemories();
}

function loadRecentMemories() {
    const emptyState = document.getElementById('empty-state');
    const recentMemoriesGrid = document.getElementById('recent-memories-grid');
    const quickCapsule = document.getElementById('quick-capsule');
    const memoryCapsuleCount = document.getElementById('memory-count-capsule');
    
    if (!emptyState || !recentMemoriesGrid) return;
    
    const recentMemories = memories.slice(0, 6);
    
    if (recentMemories.length === 0) {
        // Show empty state
        emptyState.style.display = 'block';
        recentMemoriesGrid.style.display = 'none';
        if (quickCapsule) quickCapsule.style.display = 'none';
    } else {
        // Show recent memories
        emptyState.style.display = 'none';
        recentMemoriesGrid.style.display = 'grid';
        recentMemoriesGrid.innerHTML = recentMemories.map(memory => createMemoryCard(memory)).join('');
        
        // Show quick capsule creation if user has memories but no capsules
        if (quickCapsule && memoryCapsuleCount) {
            if (capsules.length === 0 && memories.length >= 3) {
                quickCapsule.style.display = 'block';
                memoryCapsuleCount.textContent = memories.length;
            } else {
                quickCapsule.style.display = 'none';
            }
        }
    }
}

function createMemoryCard(memory) {
    const formattedDate = formatDate(memory.date);
    const tags = memory.tags ? memory.tags.map(tag => `<span class="memory-tag">${tag}</span>`).join('') : '';
    const icon = getMemoryIcon(memory.type, memory.platform);
    
    return `
        <div class="memory-card" data-memory-id="${memory.id}">
            <div class="memory-image">
                ${icon}
            </div>
            <div class="memory-content">
                <div class="memory-title">${memory.title}</div>
                <div class="memory-description">${memory.description}</div>
                <div class="memory-date">${formattedDate}</div>
                <div class="memory-tags">${tags}</div>
            </div>
        </div>
    `;
}

// Time Capsule Management
function openCapsuleModal() {
    showModal('create-capsule-modal');
    loadMemorySelector();
    
    // Set default unlock date to 1 year from now
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    document.getElementById('capsule-unlock-date').value = futureDate.toISOString().slice(0, 16);
}

function saveCapsule() {
    const form = document.getElementById('capsule-form');
    
    const capsule = {
        id: Date.now(),
        name: document.getElementById('capsule-name').value,
        unlockDate: new Date(document.getElementById('capsule-unlock-date').value),
        message: document.getElementById('capsule-message').value,
        memories: getSelectedMemories(),
        created: new Date(),
        locked: true
    };
    
    if (!capsule.name.trim()) {
        showNotification('Please enter a name for your time capsule', 'error');
        return;
    }
    
    if (!capsule.unlockDate || capsule.unlockDate <= new Date()) {
        showNotification('Please select a future date for unlocking', 'error');
        return;
    }
    
    if (capsule.memories.length === 0) {
        showNotification('Please select at least one memory for your capsule', 'error');
        return;
    }
    
    capsules.unshift(capsule);
    saveAppData();
    
    closeModal('create-capsule-modal');
    showNotification(`Time capsule "${capsule.name}" created successfully!`, 'success');
    
    form.reset();
    loadCapsules();
    updateUsageStats();
}

function loadCapsules() {
    const capsulesGrid = document.getElementById('capsules-grid');
    if (!capsulesGrid) return;
    
    capsulesGrid.innerHTML = capsules.length > 0
        ? capsules.map(capsule => createCapsuleCard(capsule)).join('')
        : '<p style="grid-column: 1/-1; text-align: center; color: var(--warm-gray);">No time capsules yet. Create your first one to start preserving memories for the future!</p>';
    
    checkUnlockableCapsules();
}

function createCapsuleCard(capsule) {
    const now = new Date();
    const isReady = capsule.unlockDate <= now;
    const statusClass = isReady ? 'ready' : 'locked';
    const unlockDate = formatDate(capsule.unlockDate);
    const previewItems = capsule.memories.slice(0, 4).map(memoryId => {
        const memory = memories.find(m => m.id === memoryId);
        const icon = memory ? getMemoryIcon(memory.type, memory.platform) : '📄';
        return `<div class="capsule-preview-item">${icon}</div>`;
    }).join('');
    
    const actionButton = isReady 
        ? `<button class="capsule-btn primary" onclick="unlockCapsule(${capsule.id})">🔓 Unlock</button>`
        : `<button class="capsule-btn" onclick="viewCapsule(${capsule.id})">👁️ Preview</button>`;
    
    return `
        <div class="capsule-card ${statusClass}" data-capsule-id="${capsule.id}">
            <div class="capsule-title">${capsule.name}</div>
            <div class="capsule-unlock-date">${isReady ? 'Ready to unlock!' : `Unlocks: ${unlockDate}`}</div>
            <div class="capsule-preview">${previewItems}</div>
            <div class="capsule-memory-count">${capsule.memories.length} memories inside</div>
            <div class="capsule-actions">
                ${actionButton}
                <button class="capsule-btn" onclick="editCapsule(${capsule.id})">✏️ Edit</button>
            </div>
        </div>
    `;
}

function checkUnlockableCapsules() {
    const now = new Date();
    const readyCapsules = capsules.filter(capsule => capsule.locked && capsule.unlockDate <= now);
    
    if (readyCapsules.length > 0) {
        const notificationBtn = document.querySelector('.notification-btn .notification-count');
        if (notificationBtn) {
            notificationBtn.textContent = readyCapsules.length.toString();
            notificationBtn.style.display = 'flex';
        }
        
        readyCapsules.forEach(capsule => {
            showNotification(`🎉 Time capsule "${capsule.name}" is ready to unlock!`, 'success', 8000);
        });
    }
}

function unlockCapsule(capsuleId) {
    const capsule = capsules.find(c => c.id === capsuleId);
    if (!capsule) return;
    
    console.log(`Unlocking capsule: ${capsule.name}`);
    showUnlockExperience(capsule);
}

function showUnlockExperience(capsule) {
    const modal = document.createElement('div');
    modal.className = 'modal active unlock-modal';
    modal.innerHTML = `
        <div class="modal-content unlock-content">
            <div class="unlock-animation">
                <div class="treasure-chest opening">
                    <div class="chest-base"></div>
                    <div class="chest-lid-opening"></div>
                    <div class="golden-light pulsing"></div>
                </div>
                <h2 style="margin: 20px 0; font-family: 'Crimson Text', serif;">✨ ${capsule.name} ✨</h2>
                ${capsule.message ? `<p style="font-style: italic; margin-bottom: 30px;">"${capsule.message}"</p>` : ''}
                <div class="unlocked-memories">
                    ${capsule.memories.map(memoryId => {
                        const memory = memories.find(m => m.id === memoryId);
                        return memory ? createMemoryCard(memory) : '';
                    }).join('')}
                </div>
                <button class="btn-primary" onclick="closeUnlockModal(${capsule.id})" style="margin-top: 30px;">
                    Continue to Memories
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    capsule.locked = false;
    capsule.unlockedAt = new Date();
    saveAppData();
    
    playUnlockSound();
}

function closeUnlockModal(capsuleId) {
    const modal = document.querySelector('.unlock-modal');
    if (modal) {
        modal.remove();
    }
    
    loadCapsules();
    showTab('discover');
}

// Timeline and Discovery
function loadTimeline() {
    const timeline = document.getElementById('memory-timeline');
    if (!timeline) return;
    
    const timelineItems = [];
    
    memories.slice(0, 10).forEach(memory => {
        timelineItems.push({
            type: 'memory',
            date: memory.date,
            title: memory.title,
            description: memory.description,
            icon: getMemoryIcon(memory.type, memory.platform),
            data: memory
        });
    });
    
    capsules.filter(c => !c.locked && c.unlockedAt).forEach(capsule => {
        timelineItems.push({
            type: 'capsule',
            date: capsule.unlockedAt,
            title: `Unlocked: ${capsule.name}`,
            description: `Rediscovered ${capsule.memories.length} precious memories`,
            icon: '🎉',
            data: capsule
        });
    });
    
    timelineItems.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    timeline.innerHTML = timelineItems.length > 0
        ? timelineItems.map(item => createTimelineItem(item)).join('')
        : '<p style="text-align: center; color: var(--warm-gray);">Your memory timeline will appear here as you unlock time capsules and add memories.</p>';
}

function createTimelineItem(item) {
    const formattedDate = formatDate(item.date);
    
    return `
        <div class="timeline-item">
            <div class="timeline-marker">${item.icon}</div>
            <div class="timeline-content">
                <div class="timeline-date">${formattedDate}</div>
                <div class="timeline-title">${item.title}</div>
                <div class="timeline-description">${item.description}</div>
            </div>
        </div>
    `;
}

// Modal Management
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

function loadMemorySelector() {
    const selector = document.getElementById('memory-selector');
    if (!selector || memories.length === 0) return;
    
    selector.innerHTML = memories.map(memory => `
        <div class="memory-select-item">
            <label>
                <input type="checkbox" value="${memory.id}">
                <span class="memory-select-info">
                    <span class="memory-select-icon">${getMemoryIcon(memory.type, memory.platform)}</span>
                    <span class="memory-select-text">
                        <span class="memory-select-title">${memory.title}</span>
                        <span class="memory-select-date">${formatDate(memory.date)}</span>
                    </span>
                </span>
            </label>
        </div>
    `).join('');
}

function getSelectedMemories() {
    const checkboxes = document.querySelectorAll('#memory-selector input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

// Utility Functions
function getSocialIcon(platform) {
    const icons = {
        twitter: '🐦',
        instagram: '📷',
        facebook: '👥',
        youtube: '📹',
        tiktok: '🎵',
        spotify: '🎶'
    };
    return icons[platform] || '📱';
}

function getMemoryIcon(type, platform) {
    if (platform && platform !== 'manual') {
        return getSocialIcon(platform);
    }
    
    const icons = {
        photo: '📸',
        video: '🎥',
        text: '📝',
        audio: '🎵',
        social: '📱'
    };
    return icons[type] || '📄';
}

function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showLoading(message) {
    const overlay = document.getElementById('loading-overlay');
    const messageEl = document.getElementById('loading-message');
    
    if (overlay && messageEl) {
        messageEl.textContent = message;
        overlay.classList.add('active');
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
    }
}

function showNotification(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--antique-white);
        color: var(--charcoal-brown);
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(139, 125, 107, 0.3);
        border-left: 4px solid var(--${type === 'success' ? 'success-green' : type === 'error' ? 'error-red' : type === 'warning' ? 'warning-orange' : 'vintage-gold'});
        z-index: 1500;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
        max-width: 300px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, duration);
}

function handleKeyboardShortcuts(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openCreateModal();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        checkCapsuleLimit();
    }
    
    if (e.key >= '1' && e.key <= '4') {
        const tabs = ['home', 'connect', 'capsules', 'discover'];
        showTab(tabs[parseInt(e.key) - 1]);
    }
    
    if (e.key === 'Escape') {
        const activeModals = document.querySelectorAll('.modal.active');
        activeModals.forEach(modal => {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        });
    }
}

// File Handling
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.style.borderColor = 'var(--vintage-gold)';
    e.currentTarget.style.background = 'rgba(242, 212, 146, 0.1)';
}

function handleFileDrop(e) {
    e.preventDefault();
    e.currentTarget.style.borderColor = '';
    e.currentTarget.style.background = '';
    
    const files = e.dataTransfer.files;
    handleFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

function handleFiles(files) {
    console.log(`Processing ${files.length} files`);
    
    Array.from(files).forEach((file, index) => {
        console.log(`File ${index + 1}: ${file.name} (${file.type})`);
    });
    
    const uploadArea = document.getElementById('file-upload');
    if (uploadArea) {
        uploadArea.innerHTML = `<p>✓ ${files.length} file(s) selected</p>`;
    }
}

// Sound Effects
function playTransitionSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
        
        oscillator.type = 'sine';
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
        // Audio not supported
    }
}

function playUnlockSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        [523.25, 659.25, 783.99].forEach((freq, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + index * 0.15);
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime + index * 0.15);
            gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + index * 0.15 + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + index * 0.15 + 0.6);
            
            oscillator.type = 'sine';
            oscillator.start(audioContext.currentTime + index * 0.15);
            oscillator.stop(audioContext.currentTime + index * 0.15 + 0.6);
        });
    } catch (error) {
        // Audio not supported
    }
}