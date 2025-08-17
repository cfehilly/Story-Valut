const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const TimeCapsule = require('../models/TimeCapsule');
const Memory = require('../models/Memory');
const router = express.Router();

// Get all time capsules for authenticated user
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const filters = { userId: req.user.id };
    if (status) filters.status = status;
    
    const capsules = await TimeCapsule.findByUser(req.user.id, {
      filters,
      pagination: { page: parseInt(page), limit: parseInt(limit) }
    });
    
    res.json({
      capsules: capsules.data,
      pagination: capsules.pagination,
      total: capsules.total
    });
  } catch (error) {
    console.error('Error fetching time capsules:', error);
    res.status(500).json({ error: 'Failed to fetch time capsules' });
  }
});

// Get single time capsule
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const capsule = await TimeCapsule.findById(req.params.id);
    
    if (!capsule) {
      return res.status(404).json({ error: 'Time capsule not found' });
    }
    
    if (capsule.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Include memories if capsule is unlocked
    if (capsule.status === 'unlocked') {
      capsule.memories = await Memory.findByIds(capsule.memoryIds);
    }
    
    res.json(capsule);
  } catch (error) {
    console.error('Error fetching time capsule:', error);
    res.status(500).json({ error: 'Failed to fetch time capsule' });
  }
});

// Create new time capsule
router.post('/', 
  requireAuth,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('unlockDate').isISO8601().withMessage('Valid unlock date is required'),
    body('memoryIds').isArray().withMessage('Memory IDs must be an array'),
    body('description').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const unlockDate = new Date(req.body.unlockDate);
      const now = new Date();
      
      if (unlockDate <= now) {
        return res.status(400).json({ error: 'Unlock date must be in the future' });
      }

      // Verify all memories belong to the user
      const memories = await Memory.findByIds(req.body.memoryIds);
      const userMemories = memories.filter(m => m.userId === req.user.id);
      
      if (userMemories.length !== req.body.memoryIds.length) {
        return res.status(400).json({ error: 'Some memories do not exist or do not belong to you' });
      }

      const capsuleData = {
        userId: req.user.id,
        name: req.body.name,
        description: req.body.description || '',
        unlockDate: unlockDate,
        memoryIds: req.body.memoryIds,
        status: 'sealed',
        createdAt: new Date(),
        settings: {
          notifyOnUnlock: req.body.notifyOnUnlock !== false,
          shareLink: req.body.shareLink || null
        }
      };

      const capsule = await TimeCapsule.create(capsuleData);
      
      // Schedule unlock notification
      const jobQueue = require('../services/jobs');
      await jobQueue.add('unlock-capsule', {
        capsuleId: capsule.id,
        userId: req.user.id
      }, {
        delay: unlockDate - now
      });
      
      // Emit real-time update
      const io = req.app.get('io');
      io.to(`user-${req.user.id}`).emit('capsule-created', capsule);
      
      res.status(201).json(capsule);
    } catch (error) {
      console.error('Error creating time capsule:', error);
      res.status(500).json({ error: 'Failed to create time capsule' });
    }
  }
);

// Update time capsule (only if not unlocked)
router.put('/:id',
  requireAuth,
  [
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('description').optional().isString(),
    body('unlockDate').optional().isISO8601().withMessage('Valid unlock date is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const capsule = await TimeCapsule.findById(req.params.id);
      
      if (!capsule) {
        return res.status(404).json({ error: 'Time capsule not found' });
      }
      
      if (capsule.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (capsule.status === 'unlocked') {
        return res.status(400).json({ error: 'Cannot modify unlocked time capsule' });
      }

      const updates = {
        name: req.body.name || capsule.name,
        description: req.body.description !== undefined ? req.body.description : capsule.description,
        updatedAt: new Date()
      };

      // Handle unlock date changes
      if (req.body.unlockDate) {
        const newUnlockDate = new Date(req.body.unlockDate);
        if (newUnlockDate <= new Date()) {
          return res.status(400).json({ error: 'Unlock date must be in the future' });
        }
        updates.unlockDate = newUnlockDate;
        
        // Reschedule unlock job
        const jobQueue = require('../services/jobs');
        await jobQueue.removeRepeatableByKey(`unlock-capsule-${capsule.id}`);
        await jobQueue.add('unlock-capsule', {
          capsuleId: capsule.id,
          userId: req.user.id
        }, {
          delay: newUnlockDate - new Date()
        });
      }

      const updatedCapsule = await TimeCapsule.update(req.params.id, updates);
      
      // Emit real-time update
      const io = req.app.get('io');
      io.to(`user-${req.user.id}`).emit('capsule-updated', updatedCapsule);
      
      res.json(updatedCapsule);
    } catch (error) {
      console.error('Error updating time capsule:', error);
      res.status(500).json({ error: 'Failed to update time capsule' });
    }
  }
);

// Delete time capsule
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const capsule = await TimeCapsule.findById(req.params.id);
    
    if (!capsule) {
      return res.status(404).json({ error: 'Time capsule not found' });
    }
    
    if (capsule.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Cancel scheduled unlock job
    const jobQueue = require('../services/jobs');
    await jobQueue.removeRepeatableByKey(`unlock-capsule-${capsule.id}`);

    await TimeCapsule.delete(req.params.id);
    
    // Emit real-time update
    const io = req.app.get('io');
    io.to(`user-${req.user.id}`).emit('capsule-deleted', { id: req.params.id });
    
    res.json({ message: 'Time capsule deleted successfully' });
  } catch (error) {
    console.error('Error deleting time capsule:', error);
    res.status(500).json({ error: 'Failed to delete time capsule' });
  }
});

// Unlock time capsule manually (if unlock date has passed)
router.post('/:id/unlock', requireAuth, async (req, res) => {
  try {
    const capsule = await TimeCapsule.findById(req.params.id);
    
    if (!capsule) {
      return res.status(404).json({ error: 'Time capsule not found' });
    }
    
    if (capsule.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (capsule.status === 'unlocked') {
      return res.status(400).json({ error: 'Time capsule is already unlocked' });
    }

    const now = new Date();
    const unlockDate = new Date(capsule.unlockDate);
    
    if (now < unlockDate) {
      return res.status(400).json({ 
        error: 'Cannot unlock before unlock date',
        unlockDate: unlockDate.toISOString()
      });
    }

    // Unlock the capsule
    const unlockedCapsule = await TimeCapsule.update(req.params.id, {
      status: 'unlocked',
      unlockedAt: now,
      updatedAt: now
    });

    // Get memories for unlocked capsule
    unlockedCapsule.memories = await Memory.findByIds(capsule.memoryIds);

    // Send unlock notification
    const notificationService = require('../services/notifications');
    await notificationService.sendCapsuleUnlockNotification(req.user, unlockedCapsule);
    
    // Emit real-time update
    const io = req.app.get('io');
    io.to(`user-${req.user.id}`).emit('capsule-unlocked', unlockedCapsule);
    
    res.json(unlockedCapsule);
  } catch (error) {
    console.error('Error unlocking time capsule:', error);
    res.status(500).json({ error: 'Failed to unlock time capsule' });
  }
});

// Add memories to existing time capsule
router.post('/:id/memories', 
  requireAuth,
  [
    body('memoryIds').isArray().withMessage('Memory IDs must be an array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const capsule = await TimeCapsule.findById(req.params.id);
      
      if (!capsule) {
        return res.status(404).json({ error: 'Time capsule not found' });
      }
      
      if (capsule.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (capsule.status === 'unlocked') {
        return res.status(400).json({ error: 'Cannot add memories to unlocked time capsule' });
      }

      // Verify memories belong to user
      const memories = await Memory.findByIds(req.body.memoryIds);
      const userMemories = memories.filter(m => m.userId === req.user.id);
      
      if (userMemories.length !== req.body.memoryIds.length) {
        return res.status(400).json({ error: 'Some memories do not exist or do not belong to you' });
      }

      // Add new memory IDs to capsule (avoid duplicates)
      const existingIds = new Set(capsule.memoryIds);
      const newIds = req.body.memoryIds.filter(id => !existingIds.has(id));
      const updatedMemoryIds = [...capsule.memoryIds, ...newIds];

      const updatedCapsule = await TimeCapsule.update(req.params.id, {
        memoryIds: updatedMemoryIds,
        updatedAt: new Date()
      });

      res.json({
        message: `Added ${newIds.length} new memories to time capsule`,
        capsule: updatedCapsule
      });
    } catch (error) {
      console.error('Error adding memories to time capsule:', error);
      res.status(500).json({ error: 'Failed to add memories to time capsule' });
    }
  }
);

// Remove memories from time capsule
router.delete('/:id/memories/:memoryId', requireAuth, async (req, res) => {
  try {
    const capsule = await TimeCapsule.findById(req.params.id);
    
    if (!capsule) {
      return res.status(404).json({ error: 'Time capsule not found' });
    }
    
    if (capsule.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (capsule.status === 'unlocked') {
      return res.status(400).json({ error: 'Cannot modify unlocked time capsule' });
    }

    const updatedMemoryIds = capsule.memoryIds.filter(id => id !== req.params.memoryId);
    
    const updatedCapsule = await TimeCapsule.update(req.params.id, {
      memoryIds: updatedMemoryIds,
      updatedAt: new Date()
    });

    res.json({
      message: 'Memory removed from time capsule',
      capsule: updatedCapsule
    });
  } catch (error) {
    console.error('Error removing memory from time capsule:', error);
    res.status(500).json({ error: 'Failed to remove memory from time capsule' });
  }
});

// Get upcoming unlocks (next 7 days)
router.get('/upcoming', requireAuth, async (req, res) => {
  try {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const upcomingCapsules = await TimeCapsule.findUpcoming(req.user.id, nextWeek);
    
    res.json(upcomingCapsules);
  } catch (error) {
    console.error('Error fetching upcoming unlocks:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming unlocks' });
  }
});

// Get time capsule statistics
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const stats = await TimeCapsule.getStats(req.user.id);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching time capsule stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;