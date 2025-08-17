// Nostalgic Time Capsule App - Onboarding Flow
// Smooth, magical transitions with warmth and comfort

let currentScreen = 1;
const totalScreens = 5;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    console.log('App initialized');
    initializeParticles();
    addTouchGestures();
    
    // Make sure all screens except the first are hidden
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
});

// Screen transition function
function nextScreen(screenNumber) {
    console.log(`Transitioning from screen ${screenNumber} to screen ${screenNumber + 1}`);
    
    const currentScreenElement = document.getElementById(`screen-${screenNumber}`);
    const nextScreenElement = document.getElementById(`screen-${screenNumber + 1}`);
    
    if (!currentScreenElement || !nextScreenElement) {
        console.error('Screen elements not found:', {
            current: currentScreenElement,
            next: nextScreenElement
        });
        return;
    }
    
    // Add subtle vibration on mobile if supported
    if ('vibrate' in navigator) {
        navigator.vibrate(50);
    }
    
    // Play transition sound effect (if audio is available)
    playTransitionSound();
    
    // Hide current screen
    currentScreenElement.classList.remove('active');
    
    // Show next screen after a brief delay
    setTimeout(() => {
        nextScreenElement.classList.add('active');
        
        // Update current screen counter
        currentScreen = screenNumber + 1;
        
        // Trigger special animations for specific screens
        triggerScreenAnimations(currentScreen);
        
        // Update progress dots
        updateProgressDots(screenNumber + 1);
        
        console.log(`Now on screen ${currentScreen}`);
    }, 300);
}

// Reset to beginning for demo purposes
function resetOnboarding() {
    const currentScreenElement = document.getElementById(`screen-${currentScreen}`);
    const firstScreenElement = document.getElementById('screen-1');
    
    // Fade out current screen
    currentScreenElement.classList.remove('active');
    
    // Reset to first screen after delay
    setTimeout(() => {
        firstScreenElement.classList.add('active');
        currentScreen = 1;
        updateProgressDots(1);
        
        // Reset all animations
        resetAllAnimations();
    }, 600);
}

// Screen-specific animations
function triggerScreenAnimations(screenNumber) {
    switch(screenNumber) {
        case 1:
            animateAppIcon();
            break;
        case 2:
            animateFloatingPhotos();
            break;
        case 3:
            animateTimeSpiral();
            break;
        case 4:
            animateConstellation();
            break;
        case 5:
            animateWelcome();
            break;
    }
}

// Individual animation functions
function animateAppIcon() {
    const chest = document.querySelector('.icon-chest');
    const sparkles = document.querySelectorAll('.sparkle');
    
    // Chest entrance
    setTimeout(() => {
        chest.style.animation = 'chestOpen 3s ease-in-out infinite';
    }, 300);
    
    // Sparkles cascade
    sparkles.forEach((sparkle, index) => {
        setTimeout(() => {
            sparkle.style.animation = `sparkle 2s ease-in-out infinite`;
            sparkle.style.animationDelay = `${index * 0.7}s`;
        }, 600 + index * 200);
    });
}

function animateFloatingPhotos() {
    const photos = document.querySelectorAll('.photo-frame');
    
    photos.forEach((photo, index) => {
        setTimeout(() => {
            photo.style.opacity = '1';
            photo.style.transform = 'translateY(0px) rotate(0deg)';
            photo.style.animation = `floatPhoto 6s ease-in-out infinite`;
            photo.style.animationDelay = `${index * 2}s`;
        }, 400 + index * 300);
    });
}

function animateTimeSpiral() {
    const rings = document.querySelectorAll('.spiral-ring');
    const centerDot = document.querySelector('.center-dot');
    
    rings.forEach((ring, index) => {
        setTimeout(() => {
            ring.style.opacity = '0.7';
            ring.style.animation = `spiral 8s linear infinite`;
            ring.style.animationDelay = `${-index * 2}s`;
        }, 300 + index * 150);
    });
    
    setTimeout(() => {
        centerDot.style.animation = 'pulse 2s ease-in-out infinite';
    }, 800);
}

function animateConstellation() {
    const stars = document.querySelectorAll('.memory-star');
    const lines = document.querySelectorAll('.constellation-line');
    
    // Stars appear first
    stars.forEach((star, index) => {
        setTimeout(() => {
            star.style.opacity = '1';
            star.style.animation = `twinkle 3s ease-in-out infinite`;
            star.style.animationDelay = `${index * 0.6}s`;
        }, 200 + index * 150);
    });
    
    // Lines connect after stars
    lines.forEach((line, index) => {
        setTimeout(() => {
            line.style.opacity = '0.6';
            line.style.animation = 'connectionGlow 4s ease-in-out infinite';
        }, 1200 + index * 200);
    });
}

function animateWelcome() {
    const chest = document.querySelector('.treasure-chest');
    const previewCards = document.querySelectorAll('.preview-card');
    
    // Chest opening animation
    setTimeout(() => {
        chest.querySelector('.chest-lid-open').style.animation = 'lidOpen 2s ease-in-out';
        chest.querySelector('.golden-light').style.animation = 'goldenGlow 2s ease-in-out infinite';
    }, 300);
    
    // Preview cards cascade
    previewCards.forEach((card, index) => {
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0px)';
            card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        }, 800 + index * 200);
    });
}

// Progress dots update
function updateProgressDots(screenNumber) {
    const dots = document.querySelectorAll('.dot');
    
    dots.forEach((dot, index) => {
        if (index === screenNumber - 2) { // Adjust for 0-based indexing and screen offset
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

// Initialize floating particles for magical effect
function initializeParticles() {
    const particleContainers = document.querySelectorAll('.background-particles');
    
    particleContainers.forEach(container => {
        // Create subtle floating particles
        for (let i = 0; i < 6; i++) {
            createParticle(container, i);
        }
    });
}

function createParticle(container, index) {
    const particle = document.createElement('div');
    particle.className = 'floating-particle';
    particle.style.cssText = `
        position: absolute;
        width: 4px;
        height: 4px;
        background: var(--vintage-gold);
        border-radius: 50%;
        opacity: 0.3;
        pointer-events: none;
        animation: floatParticle ${8 + index}s ease-in-out infinite;
        animation-delay: ${index * 1.5}s;
        top: ${20 + index * 10}%;
        left: ${10 + index * 15}%;
    `;
    
    container.appendChild(particle);
}

// Add CSS for floating particles
const particleStyle = document.createElement('style');
particleStyle.textContent = `
    @keyframes floatParticle {
        0%, 100% { 
            transform: translateY(0px) translateX(0px) rotate(0deg); 
            opacity: 0.1; 
        }
        25% { 
            transform: translateY(-30px) translateX(10px) rotate(90deg); 
            opacity: 0.3; 
        }
        50% { 
            transform: translateY(-60px) translateX(-5px) rotate(180deg); 
            opacity: 0.5; 
        }
        75% { 
            transform: translateY(-30px) translateX(-15px) rotate(270deg); 
            opacity: 0.3; 
        }
    }
`;
document.head.appendChild(particleStyle);

// Touch gesture support for mobile
function addTouchGestures() {
    let startY = 0;
    let endY = 0;
    
    document.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
    });
    
    document.addEventListener('touchend', (e) => {
        endY = e.changedTouches[0].clientY;
        handleSwipe();
    });
    
    function handleSwipe() {
        const swipeDistance = startY - endY;
        const minSwipeDistance = 50;
        
        // Swipe up to go to next screen
        if (swipeDistance > minSwipeDistance && currentScreen < totalScreens) {
            nextScreen(currentScreen);
        }
        // Swipe down to go to previous screen
        else if (swipeDistance < -minSwipeDistance && currentScreen > 1) {
            // Could implement going back to previous screen
            // previousScreen(currentScreen);
        }
    }
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowRight':
        case ' ':
        case 'Enter':
            if (currentScreen < totalScreens) {
                nextScreen(currentScreen);
            } else {
                resetOnboarding();
            }
            break;
        case 'ArrowLeft':
            // Could implement going back
            break;
        case 'Escape':
            resetOnboarding();
            break;
    }
});

// Preload next screen for smooth transitions
function preloadNextScreen() {
    if (currentScreen < totalScreens) {
        const nextScreenElement = document.getElementById(`screen-${currentScreen + 1}`);
        if (nextScreenElement) {
            // Preload any images or resources
            nextScreenElement.style.visibility = 'hidden';
            nextScreenElement.style.display = 'flex';
            
            setTimeout(() => {
                nextScreenElement.style.display = 'none';
                nextScreenElement.style.visibility = 'visible';
            }, 100);
        }
    }
}

// Reset all animations to initial state
function resetAllAnimations() {
    // Reset all animated elements
    const animatedElements = document.querySelectorAll('[style*="animation"]');
    animatedElements.forEach(element => {
        element.style.animation = '';
        element.style.opacity = '';
        element.style.transform = '';
    });
    
    // Reset progress dots
    const dots = document.querySelectorAll('.dot');
    dots.forEach(dot => dot.classList.remove('active'));
}

// Subtle sound effects (optional - placeholder functions)
function playTransitionSound() {
    // Could implement gentle transition sounds here
    // using Web Audio API for subtle paper-rustling or chime sounds
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
        // Audio not supported or blocked, continue silently
    }
}

// Performance optimization: pause animations when not visible
document.addEventListener('visibilitychange', () => {
    const allAnimatedElements = document.querySelectorAll('[style*="animation"]');
    
    if (document.hidden) {
        // Pause animations when tab is not visible
        allAnimatedElements.forEach(element => {
            element.style.animationPlayState = 'paused';
        });
    } else {
        // Resume animations when tab becomes visible
        allAnimatedElements.forEach(element => {
            element.style.animationPlayState = 'running';
        });
    }
});

// Add subtle parallax effect on mouse move (desktop only)
if (window.innerWidth > 768) {
    document.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;
        
        const particles = document.querySelectorAll('.floating-particle');
        particles.forEach((particle, index) => {
            const speed = (index + 1) * 0.5;
            const x = (mouseX - 0.5) * speed;
            const y = (mouseY - 0.5) * speed;
            
            particle.style.transform += ` translate(${x}px, ${y}px)`;
        });
    });
}

// Easter egg: konami code for special animation
let konamiCode = [];
const konamiSequence = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65]; // Up, Up, Down, Down, Left, Right, Left, Right, B, A

document.addEventListener('keydown', (e) => {
    konamiCode.push(e.keyCode);
    
    if (konamiCode.length > konamiSequence.length) {
        konamiCode.shift();
    }
    
    if (konamiCode.length === konamiSequence.length && 
        konamiCode.every((code, index) => code === konamiSequence[index])) {
        triggerEasterEgg();
        konamiCode = [];
    }
});

function triggerEasterEgg() {
    // Special magical effect when konami code is entered
    const body = document.body;
    body.style.animation = 'rainbow 2s ease-in-out';
    
    // Add rainbow animation
    const rainbowStyle = document.createElement('style');
    rainbowStyle.textContent = `
        @keyframes rainbow {
            0% { filter: hue-rotate(0deg); }
            25% { filter: hue-rotate(90deg); }
            50% { filter: hue-rotate(180deg); }
            75% { filter: hue-rotate(270deg); }
            100% { filter: hue-rotate(360deg); }
        }
    `;
    document.head.appendChild(rainbowStyle);
    
    setTimeout(() => {
        body.style.animation = '';
        rainbowStyle.remove();
    }, 2000);
}