// Production-ready frontend JavaScript with real API integration
class MementoApp {
  constructor() {
    this.apiUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3001/api' 
      : 'https://your-domain.com/api';
    
    this.token = localStorage.getItem('memento-token');
    this.user = null;
    this.socket = null;
    
    this.init();
  }
  
  async init() {
    // Initialize authentication
    if (this.token) {
      try {
        await this.validateToken();
        this.initializeSocket();
      } catch (error) {
        console.error('Token validation failed:', error);
        this.logout();
      }
    }
    
    // Initialize UI
    this.initializeEventListeners();
    this.initializeOnboarding();
    
    // Check URL parameters for OAuth callbacks
    this.handleOAuthCallback();
  }
  
  // Authentication methods
  async validateToken() {
    const response = await fetch(`${this.apiUrl}/auth/me`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    
    if (response.ok) {
      this.user = await response.json();
      this.updateUI();
    } else {
      throw new Error('Invalid token');
    }
  }
  
  async login(email, password) {
    try {
      const response = await fetch(`${this.apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (response.ok) {
        const data = await response.json();
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('memento-token', this.token);
        this.updateUI();
        this.initializeSocket();
        this.showNotification('Welcome back!', 'success');
      } else {
        const error = await response.json();
        throw new Error(error.error);
      }
    } catch (error) {
      this.showNotification(error.message, 'error');
      throw error;
    }
  }
  
  async register(email, password, displayName) {
    try {
      const response = await fetch(`${this.apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName })
      });
      
      if (response.ok) {
        const data = await response.json();
        this.token = data.token;
        this.user = data.user;
        localStorage.setItem('memento-token', this.token);
        this.updateUI();
        this.initializeSocket();
        this.showNotification('Account created successfully!', 'success');
      } else {
        const error = await response.json();
        throw new Error(error.errors?.[0]?.msg || error.error);
      }
    } catch (error) {
      this.showNotification(error.message, 'error');
      throw error;
    }
  }
  
  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('memento-token');
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.updateUI();
    this.showNotification('Logged out successfully', 'info');
  }
  
  // Social media OAuth
  connectSocialPlatform(platform) {
    const popup = window.open(
      `${this.apiUrl}/auth/${platform}`,
      'social-auth',
      'width=600,height=600,scrollbars=yes,resizable=yes'
    );
    
    // Listen for OAuth completion
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        // Refresh user data to get updated connections
        this.validateToken();
      }
    }, 1000);
  }
  
  handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const platform = urlParams.get('platform');
    const error = urlParams.get('error');
    
    if (token) {
      this.token = token;
      localStorage.setItem('memento-token', token);
      this.validateToken();
      this.showNotification(`${platform} connected successfully!`, 'success');
      
      // Start sync
      this.syncSocialPlatform(platform);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      this.showNotification(`Failed to connect: ${error}`, 'error');
    }
  }
  
  // Social media sync
  async syncSocialPlatform(platform) {
    try {
      this.showLoading(`Syncing ${platform} data...`);
      
      const response = await fetch(`${this.apiUrl}/social/sync/${platform}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.hideLoading();
        this.showNotification(
          `Imported ${data.memoriesSaved} memories from ${platform}!`, 
          'success'
        );
        this.loadRecentMemories();
      } else {
        throw new Error(`Failed to sync ${platform}`);
      }
    } catch (error) {
      this.hideLoading();
      this.showNotification(error.message, 'error');
    }
  }
  
  async syncAllPlatforms() {
    try {
      this.showLoading('Syncing all connected platforms...');
      
      const response = await fetch(`${this.apiUrl}/social/sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.hideLoading();
        this.showNotification(
          `Synced ${data.totalMemories} total memories!`, 
          'success'
        );
        this.loadRecentMemories();
      } else {
        throw new Error('Failed to sync platforms');
      }
    } catch (error) {
      this.hideLoading();
      this.showNotification(error.message, 'error');
    }
  }
  
  // Payment processing with Stripe
  async initializeStripe() {
    if (window.Stripe) return window.Stripe;
    
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.onload = () => {
        resolve(window.Stripe(this.getStripePublishableKey()));
      };
      document.head.appendChild(script);
    });
  }
  
  getStripePublishableKey() {
    // In production, this should come from your backend
    return window.location.hostname === 'localhost' 
      ? 'pk_test_...' 
      : 'pk_live_...';
  }
  
  async subscribeToPremium(planType) {
    try {
      this.showLoading('Processing subscription...');
      
      // Get price ID from backend
      const pricingResponse = await fetch(`${this.apiUrl}/payments/pricing`);
      const pricing = await pricingResponse.json();
      const priceId = pricing[planType].priceId;
      
      // Create checkout session
      const response = await fetch(`${this.apiUrl}/payments/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ priceId, planType })
      });
      
      if (response.ok) {
        const { sessionUrl } = await response.json();
        window.location.href = sessionUrl;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      this.hideLoading();
      this.showNotification(error.message, 'error');
    }
  }
  
  async getSubscriptionStatus() {
    try {
      const response = await fetch(`${this.apiUrl}/payments/subscription`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.ok) {
        return await response.json();
      }
      return { status: 'free', subscription: null };
    } catch (error) {
      console.error('Failed to get subscription status:', error);
      return { status: 'free', subscription: null };
    }
  }
  
  async cancelSubscription() {
    try {
      const confirmed = confirm('Are you sure you want to cancel your subscription? You\'ll keep premium features until the end of your current billing period.');
      if (!confirmed) return;
      
      const response = await fetch(`${this.apiUrl}/payments/cancel-subscription`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.showNotification('Subscription cancelled. You\'ll keep premium features until ' + 
          new Date(data.cancelAtPeriodEnd).toLocaleDateString(), 'info');
      } else {
        throw new Error('Failed to cancel subscription');
      }
    } catch (error) {
      this.showNotification(error.message, 'error');
    }
  }
  
  // Memory management
  async createMemory(memoryData) {
    try {
      const formData = new FormData();
      Object.keys(memoryData).forEach(key => {
        if (key === 'files' && memoryData[key]) {
          Array.from(memoryData[key]).forEach(file => {
            formData.append('files', file);
          });
        } else {
          formData.append(key, memoryData[key]);
        }
      });
      
      const response = await fetch(`${this.apiUrl}/memories`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` },
        body: formData
      });
      
      if (response.ok) {
        const memory = await response.json();
        this.showNotification('Memory created successfully!', 'success');
        this.loadRecentMemories();
        return memory;
      } else {
        throw new Error('Failed to create memory');
      }
    } catch (error) {
      this.showNotification(error.message, 'error');
      throw error;
    }
  }
  
  async loadRecentMemories() {
    try {
      const response = await fetch(`${this.apiUrl}/memories?limit=6&sort=created_at:desc`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.ok) {
        const memories = await response.json();
        this.displayMemories(memories);
      }
    } catch (error) {
      console.error('Failed to load memories:', error);
    }
  }
  
  // Time capsule management
  async createTimeCapsule(capsuleData) {
    try {
      const response = await fetch(`${this.apiUrl}/capsules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(capsuleData)
      });
      
      if (response.ok) {
        const capsule = await response.json();
        this.showNotification(`Time capsule "${capsule.name}" created!`, 'success');
        this.loadCapsules();
        return capsule;
      } else {
        const error = await response.json();
        throw new Error(error.error);
      }
    } catch (error) {
      this.showNotification(error.message, 'error');
      throw error;
    }
  }
  
  async loadCapsules() {
    try {
      const response = await fetch(`${this.apiUrl}/capsules`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.ok) {
        const capsules = await response.json();
        this.displayCapsules(capsules);
      }
    } catch (error) {
      console.error('Failed to load capsules:', error);
    }
  }
  
  async unlockCapsule(capsuleId) {
    try {
      const response = await fetch(`${this.apiUrl}/capsules/${capsuleId}/unlock`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (response.ok) {
        const capsule = await response.json();
        this.showUnlockExperience(capsule);
      } else {
        throw new Error('Failed to unlock capsule');
      }
    } catch (error) {
      this.showNotification(error.message, 'error');
    }
  }
  
  // WebSocket for real-time notifications
  initializeSocket() {
    if (!this.token) return;
    
    this.socket = io(this.apiUrl.replace('/api', ''), {
      auth: { token: this.token }
    });
    
    this.socket.on('connect', () => {
      console.log('Connected to real-time notifications');
      this.socket.emit('join-room', this.user.id);
    });
    
    this.socket.on('capsule-unlock', (data) => {
      this.showNotification(
        `🎉 Time capsule "${data.capsuleName}" is ready to unlock!`, 
        'success', 
        8000
      );
      this.loadCapsules();
    });
    
    this.socket.on('sync-complete', (data) => {
      this.showNotification(
        `✅ ${data.platform} sync completed: ${data.newMemories} new memories`, 
        'success'
      );
      this.loadRecentMemories();
    });
  }
  
  // UI Update methods
  updateUI() {
    if (this.user) {
      this.showMainApp();
      this.updateUserInfo();
      this.updatePlanStatus();
    } else {
      this.showOnboarding();
    }
  }
  
  showMainApp() {
    const onboarding = document.getElementById('onboarding-flow');
    const mainApp = document.getElementById('main-app');
    
    if (onboarding) onboarding.style.display = 'none';
    if (mainApp) mainApp.style.display = 'flex';
    
    // Load initial data
    this.loadRecentMemories();
    this.loadCapsules();
  }
  
  showOnboarding() {
    const onboarding = document.getElementById('onboarding-flow');
    const mainApp = document.getElementById('main-app');
    
    if (onboarding) onboarding.style.display = 'block';
    if (mainApp) mainApp.style.display = 'none';
  }
  
  updateUserInfo() {
    const userNameElements = document.querySelectorAll('.user-name');
    const userEmailElements = document.querySelectorAll('.user-email');
    
    userNameElements.forEach(el => el.textContent = this.user.displayName);
    userEmailElements.forEach(el => el.textContent = this.user.email);
  }
  
  async updatePlanStatus() {
    const subscription = await this.getSubscriptionStatus();
    const planBadge = document.getElementById('plan-badge');
    const planIndicator = document.getElementById('plan-indicator');
    
    let planText = subscription.status.toUpperCase();
    if (subscription.status === 'trial' && subscription.subscription?.trialEnd) {
      const daysLeft = Math.ceil((new Date(subscription.subscription.trialEnd) - new Date()) / (1000 * 60 * 60 * 24));
      planText += ` (${daysLeft} days left)`;
    }
    
    if (planBadge) {
      planBadge.textContent = planText;
      planBadge.className = `plan-badge ${subscription.status}`;
    }
    
    if (planIndicator) {
      planIndicator.textContent = subscription.status.toUpperCase();
      planIndicator.className = `plan-indicator ${subscription.status}`;
    }
    
    // Update premium banner visibility
    const premiumBanner = document.getElementById('premium-banner');
    if (premiumBanner) {
      premiumBanner.style.display = subscription.status === 'free' ? 'flex' : 'none';
    }
  }
  
  // Notification system
  showNotification(message, type = 'info', duration = 4000) {
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
      cursor: pointer;
    `;
    
    notification.textContent = message;
    notification.onclick = () => notification.remove();
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }
  
  showLoading(message) {
    const overlay = document.getElementById('loading-overlay');
    const messageEl = document.getElementById('loading-message');
    
    if (overlay && messageEl) {
      messageEl.textContent = message;
      overlay.classList.add('active');
      overlay.style.display = 'flex';
    }
  }
  
  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => overlay.style.display = 'none', 300);
    }
  }
  
  // Initialize event listeners
  initializeEventListeners() {
    // Auth forms
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.email.value;
        const password = e.target.password.value;
        await this.login(email, password);
      });
    }
    
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.email.value;
        const password = e.target.password.value;
        const displayName = e.target.displayName.value;
        await this.register(email, password, displayName);
      });
    }
    
    // Social connect buttons
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-social-connect]')) {
        const platform = e.target.dataset.socialConnect;
        this.connectSocialPlatform(platform);
      }
      
      if (e.target.matches('[data-sync-platform]')) {
        const platform = e.target.dataset.syncPlatform;
        this.syncSocialPlatform(platform);
      }
      
      if (e.target.matches('[data-subscribe]')) {
        const planType = e.target.dataset.subscribe;
        this.subscribeToPremium(planType);
      }
    });
  }
  
  // Onboarding flow
  initializeOnboarding() {
    // Keep existing onboarding code but integrate with real auth
    // ... (previous onboarding code)
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.mementoApp = new MementoApp();
});