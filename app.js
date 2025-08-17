// Memento - Digital Time Capsule App
// Main application functionality

// App state
let currentScreen = 1;
const totalScreens = 4; // Updated for main app onboarding
let currentTab = 'home';
let memories = [];
let capsules = [];
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
    console.log('Memento app initializing...');
    
    // Initialize onboarding
    initializeOnboarding();
    
    // Initialize main app
    initializeMainApp();
    
    // Load saved data
    loadAppData();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('Memento app initialized successfully');
});

// Onboarding Functions
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
        
    }, 600);
}

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
    
    // Auto-save form data
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('input', debounce(saveFormData, 1000));
    });
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
            break;
        case 'connect':
            updateConnectionStatus();
            break;
        case 'capsules':
            loadCapsules();
            break;
        case 'discover':
            loadTimeline();
            break;
    }
}

// Social Media Integration
function connectSocial(platform) {
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

function authorizeConnection() {
    const platform = window.currentConnectingPlatform;
    if (!platform) return;
    
    console.log(`Authorizing ${platform} connection`);
    
    // Show loading
    showLoading(`Connecting to ${platform.charAt(0).toUpperCase() + platform.slice(1)}...`);
    
    // Close modal
    closeModal('social-connect-modal');
    
    // Simulate OAuth flow
    simulateOAuthFlow(platform);
}

function simulateOAuthFlow(platform) {
    // In a real app, this would redirect to the platform's OAuth URL
    // For demo purposes, we'll simulate the process
    
    setTimeout(() => {
        // Simulate successful connection
        socialConnections[platform] = true;
        
        // Update UI
        updateConnectionStatus();
        
        // Start syncing data
        startDataSync(platform);
        
        hideLoading();
        
        // Show success message
        showNotification(`Successfully connected to ${platform.charAt(0).toUpperCase() + platform.slice(1)}!`, 'success');
        
        // Start importing existing content
        importExistingContent(platform);
        
    }, 2000 + Math.random() * 3000); // Simulate variable connection time
}

function updateConnectionStatus() {
    Object.keys(socialConnections).forEach(platform => {
        const statusElement = document.getElementById(`${platform}-status`);
        const connectBtn = document.querySelector(`[onclick="connectSocial('${platform}')"]`);
        
        if (socialConnections[platform]) {
            if (statusElement) {
                statusElement.textContent = 'Connected';
                statusElement.classList.add('connected');
            }
            if (connectBtn) {
                connectBtn.textContent = 'Disconnect';
                connectBtn.classList.add('connected');
                connectBtn.onclick = () => disconnectSocial(platform);
            }
        }
    });
}

function disconnectSocial(platform) {
    console.log(`Disconnecting ${platform}`);
    
    socialConnections[platform] = false;
    updateConnectionStatus();
    
    // Reset button
    const connectBtn = document.querySelector(`[onclick="disconnectSocial('${platform}')"]`);
    if (connectBtn) {
        connectBtn.textContent = 'Connect';
        connectBtn.classList.remove('connected');
        connectBtn.onclick = () => connectSocial(platform);
    }
    
    showNotification(`Disconnected from ${platform.charAt(0).toUpperCase() + platform.slice(1)}`, 'info');
}

function startDataSync(platform) {
    console.log(`Starting data sync for ${platform}`);
    
    // Simulate periodic data fetching
    setInterval(() => {
        if (socialConnections[platform]) {
            fetchPlatformData(platform);
        }
    }, 300000); // Check every 5 minutes
    
    // Initial fetch
    fetchPlatformData(platform);
}

function fetchPlatformData(platform) {
    console.log(`Fetching data from ${platform}`);
    
    // Simulate API calls to fetch new content
    const mockData = generateMockSocialData(platform);
    
    mockData.forEach(item => {
        addMemory(item);
    });
}

function generateMockSocialData(platform) {
    const mockData = [];
    const count = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < count; i++) {
        const memory = {
            id: Date.now() + i,
            type: getMockDataType(platform),
            title: getMockTitle(platform),
            description: getMockDescription(platform),
            date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Within last week
            platform: platform,
            tags: getMockTags(platform),
            content: getMockContent(platform)
        };
        mockData.push(memory);
    }
    
    return mockData;
}

function importExistingContent(platform) {
    showLoading(`Importing your ${platform.charAt(0).toUpperCase() + platform.slice(1)} content...`);
    
    setTimeout(() => {
        // Generate more comprehensive historical data
        const historicalData = [];
        const itemCount = 10 + Math.floor(Math.random() * 20);
        
        for (let i = 0; i < itemCount; i++) {
            const daysBack = Math.floor(Math.random() * 365);
            const memory = {
                id: Date.now() + i,
                type: getMockDataType(platform),
                title: getMockTitle(platform),
                description: getMockDescription(platform),
                date: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000),
                platform: platform,
                tags: getMockTags(platform),
                content: getMockContent(platform)
            };
            historicalData.push(memory);
        }
        
        // Add to memories
        historicalData.forEach(memory => addMemory(memory));
        
        hideLoading();
        
        showNotification(`Imported ${itemCount} items from ${platform.charAt(0).toUpperCase() + platform.slice(1)}!`, 'success');
        
        // Refresh displays
        loadRecentMemories();
        loadTimeline();
        
    }, 3000 + Math.random() * 4000);
}

// Memory Management
function addMemory(memory) {
    memories.unshift(memory); // Add to beginning of array
    saveAppData();
    console.log('Added memory:', memory.title);
}

function saveMemory() {
    const form = document.getElementById('memory-form');
    const formData = new FormData(form);
    
    const memory = {
        id: Date.now(),
        type: document.getElementById('memory-type').value,
        title: document.getElementById('memory-title').value,
        description: document.getElementById('memory-description').value,
        date: new Date(document.getElementById('memory-date').value || Date.now()),
        tags: document.getElementById('memory-tags').value.split(',').map(tag => tag.trim()).filter(tag => tag),
        platform: 'manual',
        files: [] // File handling would be implemented here
    };
    
    if (!memory.title.trim()) {
        showNotification('Please enter a title for your memory', 'error');
        return;
    }
    
    addMemory(memory);
    closeModal('create-memory-modal');
    showNotification('Memory saved successfully!', 'success');
    
    // Clear form
    form.reset();
    
    // Refresh display
    loadRecentMemories();
}

function loadRecentMemories() {
    const memoryGrid = document.getElementById('memory-grid');
    if (!memoryGrid) return;
    
    // Get recent memories (last 6)
    const recentMemories = memories.slice(0, 6);
    
    memoryGrid.innerHTML = recentMemories.length > 0 
        ? recentMemories.map(memory => createMemoryCard(memory)).join('')
        : '<p style="grid-column: 1/-1; text-align: center; color: var(--warm-gray);">No memories yet. Start by connecting your social accounts or adding memories manually!</p>';
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
    
    // Clear form
    form.reset();
    
    // Refresh display
    loadCapsules();
}

function loadCapsules() {
    const capsulesGrid = document.getElementById('capsules-grid');
    if (!capsulesGrid) return;
    
    capsulesGrid.innerHTML = capsules.length > 0
        ? capsules.map(capsule => createCapsuleCard(capsule)).join('')
        : '<p style="grid-column: 1/-1; text-align: center; color: var(--warm-gray);">No time capsules yet. Create your first one to start preserving memories for the future!</p>';
    
    // Check for unlockable capsules
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
        
        // Show notification for ready capsules
        readyCapsules.forEach(capsule => {
            showNotification(`🎉 Time capsule "${capsule.name}" is ready to unlock!`, 'success', 8000);
        });
    }
}

function unlockCapsule(capsuleId) {
    const capsule = capsules.find(c => c.id === capsuleId);
    if (!capsule) return;
    
    console.log(`Unlocking capsule: ${capsule.name}`);
    
    // Create unlock experience
    showUnlockExperience(capsule);
}

function showUnlockExperience(capsule) {
    // Create a special modal for the unlock experience
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
    
    // Mark capsule as unlocked
    capsule.locked = false;
    capsule.unlockedAt = new Date();
    saveAppData();
    
    // Add unlock sound/animation
    playUnlockSound();
}

function closeUnlockModal(capsuleId) {
    const modal = document.querySelector('.unlock-modal');
    if (modal) {
        modal.remove();
    }
    
    // Refresh capsules display
    loadCapsules();
    
    // Switch to discover tab to show the unlocked memories
    showTab('discover');
}

// Timeline and Discovery
function loadTimeline() {
    const timeline = document.getElementById('memory-timeline');
    if (!timeline) return;
    
    // Combine memories and unlocked capsules for timeline
    const timelineItems = [];
    
    // Add recent memories
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
    
    // Add unlocked capsules
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
    
    // Sort by date (newest first)
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
function openCreateModal() {
    showModal('create-memory-modal');
    document.getElementById('memory-date').value = new Date().toISOString().split('T')[0];
}

function openCapsuleModal() {
    showModal('create-capsule-modal');
    loadMemorySelector();
    
    // Set default unlock date to 1 year from now
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    document.getElementById('capsule-unlock-date').value = futureDate.toISOString().slice(0, 16);
}

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
        // In a real app, you'd upload these files to your server/cloud storage
        console.log(`File ${index + 1}: ${file.name} (${file.type})`);
    });
    
    // Update UI to show files are selected
    const uploadArea = document.getElementById('file-upload');
    if (uploadArea) {
        uploadArea.innerHTML = `<p>✓ ${files.length} file(s) selected</p>`;
    }
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

function getMockDataType(platform) {
    const types = {
        twitter: 'social',
        instagram: 'photo',
        facebook: 'social',
        youtube: 'video',
        tiktok: 'video',
        spotify: 'audio'
    };
    return types[platform] || 'social';
}

function getMockTitle(platform) {
    const titles = {
        twitter: ['Shared a thought', 'Replied to a tweet', 'Liked a post'],
        instagram: ['Posted a photo', 'Shared a story', 'Added to highlights'],
        facebook: ['Shared an update', 'Posted a photo', 'Checked in at'],
        youtube: ['Watched a video', 'Liked a video', 'Added to playlist'],
        tiktok: ['Posted a video', 'Liked a video', 'Shared a video'],
        spotify: ['Discovered new music', 'Created playlist', 'Saved album']
    };
    const platformTitles = titles[platform] || ['New memory'];
    return platformTitles[Math.floor(Math.random() * platformTitles.length)];
}

function getMockDescription(platform) {
    const descriptions = {
        twitter: ['An interesting conversation about...', 'Thoughts on current events...', 'A funny observation about...'],
        instagram: ['A beautiful moment captured...', 'Weekend adventures...', 'Time with friends and family...'],
        facebook: ['Sharing life updates with friends...', 'Memorable moments from today...', 'Celebrating special occasions...'],
        youtube: ['Discovered an amazing video about...', 'Learning something new...', 'Entertainment for the evening...'],
        tiktok: ['Creative content that made me smile...', 'Trending videos and challenges...', 'Inspiration and entertainment...'],
        spotify: ['New songs that speak to the soul...', 'Perfect playlist for the mood...', 'Musical discoveries and favorites...']
    };
    const platformDescriptions = descriptions[platform] || ['A memory from your digital life...'];
    return platformDescriptions[Math.floor(Math.random() * platformDescriptions.length)];
}

function getMockTags(platform) {
    const tags = {
        twitter: ['social', 'thoughts', 'conversation'],
        instagram: ['photos', 'memories', 'lifestyle'],
        facebook: ['friends', 'family', 'social'],
        youtube: ['videos', 'entertainment', 'learning'],
        tiktok: ['videos', 'creative', 'trending'],
        spotify: ['music', 'playlist', 'discovery']
    };
    return tags[platform] || ['memory'];
}

function getMockContent(platform) {
    // This would contain the actual content in a real app
    return {
        text: getMockDescription(platform),
        url: `https://${platform}.com/mock-content`,
        metadata: { platform, imported: true }
    };
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
        border-left: 4px solid var(--${type === 'success' ? 'success-green' : type === 'error' ? 'error-red' : 'vintage-gold'});
        z-index: 1500;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
        max-width: 300px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Animate out and remove
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, duration);
}

function handleKeyboardShortcuts(e) {
    // Ctrl+N or Cmd+N: New memory
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openCreateModal();
    }
    
    // Ctrl+T or Cmd+T: New time capsule
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        openCapsuleModal();
    }
    
    // Number keys 1-4: Switch tabs
    if (e.key >= '1' && e.key <= '4') {
        const tabs = ['home', 'connect', 'capsules', 'discover'];
        showTab(tabs[parseInt(e.key) - 1]);
    }
    
    // Escape: Close modals
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

// Data Persistence
function saveAppData() {
    const data = {
        memories,
        capsules,
        socialConnections,
        lastSaved: new Date().toISOString()
    };
    
    localStorage.setItem('memento-app-data', JSON.stringify(data));
}

function loadAppData() {
    const saved = localStorage.getItem('memento-app-data');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            memories = data.memories || [];
            capsules = data.capsules || [];
            socialConnections = data.socialConnections || socialConnections;
            
            console.log(`Loaded ${memories.length} memories and ${capsules.length} capsules`);
        } catch (error) {
            console.error('Error loading saved data:', error);
        }
    }
}

function saveFormData() {
    // Auto-save form data to prevent loss
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        const formData = new FormData(form);
        const data = {};
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        localStorage.setItem(`memento-form-${form.id}`, JSON.stringify(data));
    });
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
        // Audio not supported, continue silently
    }
}

function playUnlockSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create a magical chime sound
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
        // Audio not supported, continue silently
    }
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export functions for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        addMemory,
        saveCapsule,
        formatDate,
        getSocialIcon,
        getMemoryIcon
    };
}