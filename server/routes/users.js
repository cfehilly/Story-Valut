const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const router = express.Router();

// Get user profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove sensitive information
    const { password, ...userProfile } = user;
    
    res.json(userProfile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update user profile
router.put('/profile', 
  requireAuth,
  [
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('timezone').optional().isString(),
    body('dateFormat').optional().isIn(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']),
    body('theme').optional().isIn(['light', 'dark', 'sepia'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updates = {
        updatedAt: new Date()
      };

      // Only update provided fields
      if (req.body.name) updates.name = req.body.name;
      if (req.body.email) {
        // Check if email is already taken
        const existingUser = await User.findByEmail(req.body.email);
        if (existingUser && existingUser.id !== req.user.id) {
          return res.status(400).json({ error: 'Email is already taken' });
        }
        updates.email = req.body.email;
      }
      if (req.body.timezone) updates.timezone = req.body.timezone;
      if (req.body.dateFormat) updates.dateFormat = req.body.dateFormat;
      if (req.body.theme) updates.theme = req.body.theme;

      const updatedUser = await User.update(req.user.id, updates);
      
      // Remove sensitive information
      const { password, ...userProfile } = updatedUser;
      
      res.json(userProfile);
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ error: 'Failed to update user profile' });
    }
  }
);

// Get user preferences
router.get('/preferences', requireAuth, async (req, res) => {
  try {
    const preferences = await User.getPreferences(req.user.id);
    res.json(preferences);
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({ error: 'Failed to fetch user preferences' });
  }
});

// Update user preferences
router.put('/preferences',
  requireAuth,
  [
    body('notifications').optional().isObject(),
    body('privacy').optional().isObject(),
    body('sync').optional().isObject()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const preferences = {
        notifications: req.body.notifications || {},
        privacy: req.body.privacy || {},
        sync: req.body.sync || {}
      };

      const updatedPreferences = await User.updatePreferences(req.user.id, preferences);
      res.json(updatedPreferences);
    } catch (error) {
      console.error('Error updating user preferences:', error);
      res.status(500).json({ error: 'Failed to update user preferences' });
    }
  }
);

// Get user storage info
router.get('/storage', requireAuth, async (req, res) => {
  try {
    const storageInfo = await User.getStorageInfo(req.user.id);
    res.json(storageInfo);
  } catch (error) {
    console.error('Error fetching storage info:', error);
    res.status(500).json({ error: 'Failed to fetch storage information' });
  }
});

// Delete user account
router.delete('/account', requireAuth, async (req, res) => {
  try {
    // Delete all user data
    await User.deleteAccount(req.user.id);
    
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting user account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Export user data
router.get('/export', requireAuth, async (req, res) => {
  try {
    const userData = await User.exportData(req.user.id);
    
    res.setHeader('Content-Disposition', 'attachment; filename=memento-data-export.json');
    res.setHeader('Content-Type', 'application/json');
    res.json(userData);
  } catch (error) {
    console.error('Error exporting user data:', error);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

// Get user activity log
router.get('/activity', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const activity = await User.getActivityLog(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    res.json(activity);
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

module.exports = router;