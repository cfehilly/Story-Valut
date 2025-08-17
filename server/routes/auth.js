// Authentication Routes with Real OAuth Integration
const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { getUserByEmail, createUser, updateUser } = require('../services/userService');
const { authenticateToken } = require('../middleware/auth');
const winston = require('winston');

const router = express.Router();
const logger = winston.createLogger({ /* logger config */ });

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Twitter OAuth
router.get('/twitter', passport.authenticate('twitter', {
  scope: ['read', 'write']
}));

router.get('/twitter/callback', 
  passport.authenticate('twitter', { session: false }),
  async (req, res) => {
    try {
      const token = generateToken(req.user);
      
      // Store connection info
      await updateUser(req.user.id, {
        connected_platforms: {
          ...req.user.connected_platforms,
          twitter: {
            connected: true,
            username: req.user.platform_username,
            connectedAt: new Date()
          }
        }
      });

      logger.info(`Twitter connected for user ${req.user.id}`);
      
      // Redirect with token
      res.redirect(`${process.env.CLIENT_URL}/auth/success?token=${token}&platform=twitter`);
    } catch (error) {
      logger.error('Twitter callback error:', error);
      res.redirect(`${process.env.CLIENT_URL}/auth/error?message=twitter_connection_failed`);
    }
  }
);

// Facebook OAuth
router.get('/facebook', passport.authenticate('facebook', {
  scope: ['email', 'user_posts', 'user_photos']
}));

router.get('/facebook/callback',
  passport.authenticate('facebook', { session: false }),
  async (req, res) => {
    try {
      const token = generateToken(req.user);
      
      await updateUser(req.user.id, {
        connected_platforms: {
          ...req.user.connected_platforms,
          facebook: {
            connected: true,
            username: req.user.platform_username,
            connectedAt: new Date()
          }
        }
      });

      logger.info(`Facebook connected for user ${req.user.id}`);
      res.redirect(`${process.env.CLIENT_URL}/auth/success?token=${token}&platform=facebook`);
    } catch (error) {
      logger.error('Facebook callback error:', error);
      res.redirect(`${process.env.CLIENT_URL}/auth/error?message=facebook_connection_failed`);
    }
  }
);

// Instagram OAuth (via Facebook)
router.get('/instagram', passport.authenticate('instagram', {
  scope: ['instagram_basic', 'instagram_content_publish']
}));

router.get('/instagram/callback',
  passport.authenticate('instagram', { session: false }),
  async (req, res) => {
    try {
      const token = generateToken(req.user);
      
      await updateUser(req.user.id, {
        connected_platforms: {
          ...req.user.connected_platforms,
          instagram: {
            connected: true,
            username: req.user.platform_username,
            connectedAt: new Date()
          }
        }
      });

      logger.info(`Instagram connected for user ${req.user.id}`);
      res.redirect(`${process.env.CLIENT_URL}/auth/success?token=${token}&platform=instagram`);
    } catch (error) {
      logger.error('Instagram callback error:', error);
      res.redirect(`${process.env.CLIENT_URL}/auth/error?message=instagram_connection_failed`);
    }
  }
);

// Google OAuth (for YouTube)
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email', 'https://www.googleapis.com/auth/youtube.readonly']
}));

router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  async (req, res) => {
    try {
      const token = generateToken(req.user);
      
      await updateUser(req.user.id, {
        connected_platforms: {
          ...req.user.connected_platforms,
          youtube: {
            connected: true,
            username: req.user.platform_username,
            connectedAt: new Date()
          }
        }
      });

      logger.info(`YouTube connected for user ${req.user.id}`);
      res.redirect(`${process.env.CLIENT_URL}/auth/success?token=${token}&platform=youtube`);
    } catch (error) {
      logger.error('YouTube callback error:', error);
      res.redirect(`${process.env.CLIENT_URL}/auth/error?message=youtube_connection_failed`);
    }
  }
);

// Email/Password Registration
router.post('/register',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('displayName').trim().isLength({ min: 2 }).withMessage('Display name is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, displayName } = req.body;

      // Check if user already exists
      const existingUser = await getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists with this email' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = await createUser({
        email,
        password_hash: hashedPassword,
        display_name: displayName,
        plan_type: 'free',
        created_at: new Date()
      });

      const token = generateToken(user);

      logger.info(`New user registered: ${user.id}`);

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          planType: user.plan_type
        }
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// Email/Password Login
router.post('/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user
      const user = await getUserByEmail(email);
      if (!user || !user.password_hash) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = generateToken(user);

      logger.info(`User logged in: ${user.id}`);

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          planType: user.plan_type,
          connectedPlatforms: user.connected_platforms || {}
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      planType: user.plan_type,
      connectedPlatforms: user.connected_platforms || {},
      createdAt: user.created_at,
      trialEndDate: user.trial_end_date
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Disconnect social platform
router.post('/disconnect/:platform', authenticateToken, async (req, res) => {
  try {
    const { platform } = req.params;
    const user = req.user;

    const updatedPlatforms = { ...user.connected_platforms };
    if (updatedPlatforms[platform]) {
      updatedPlatforms[platform] = {
        ...updatedPlatforms[platform],
        connected: false,
        disconnectedAt: new Date()
      };
    }

    await updateUser(user.id, {
      connected_platforms: updatedPlatforms
    });

    logger.info(`${platform} disconnected for user ${user.id}`);

    res.json({ message: `${platform} disconnected successfully` });
  } catch (error) {
    logger.error(`Disconnect ${req.params.platform} error:`, error);
    res.status(500).json({ error: 'Failed to disconnect platform' });
  }
});

// Refresh token
router.post('/refresh-token', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const token = generateToken(user);

    res.json({ token });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Logout (client-side token removal, server-side blacklisting could be added)
router.post('/logout', authenticateToken, (req, res) => {
  logger.info(`User logged out: ${req.user.id}`);
  res.json({ message: 'Logged out successfully' });
});

// Password reset request
router.post('/forgot-password',
  [body('email').isEmail().withMessage('Valid email is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;
      const user = await getUserByEmail(email);

      if (user) {
        // Generate reset token (implementation needed)
        const resetToken = jwt.sign(
          { userId: user.id, type: 'password_reset' },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        );

        // Send reset email (implementation needed)
        await sendPasswordResetEmail(email, resetToken);
        
        logger.info(`Password reset requested for user ${user.id}`);
      }

      // Always return success to prevent email enumeration
      res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    } catch (error) {
      logger.error('Password reset error:', error);
      res.status(500).json({ error: 'Failed to process password reset' });
    }
  }
);

module.exports = router;