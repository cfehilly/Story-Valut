const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const Memory = require('../models/Memory');
const { uploadMiddleware } = require('../middleware/upload');
const router = express.Router();

// Get all memories for authenticated user
router.get('/', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, platform, type, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const filters = { userId: req.user.id };
    if (platform) filters.platform = platform;
    if (type) filters.type = type;
    
    const memories = await Memory.findByUser(req.user.id, {
      filters,
      pagination: { page: parseInt(page), limit: parseInt(limit) },
      sorting: { field: sortBy, order: sortOrder }
    });
    
    res.json({
      memories: memories.data,
      pagination: memories.pagination,
      total: memories.total
    });
  } catch (error) {
    console.error('Error fetching memories:', error);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

// Get single memory
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);
    
    if (!memory) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    
    if (memory.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(memory);
  } catch (error) {
    console.error('Error fetching memory:', error);
    res.status(500).json({ error: 'Failed to fetch memory' });
  }
});

// Create new memory
router.post('/', 
  requireAuth,
  uploadMiddleware.array('media', 5),
  [
    body('content').notEmpty().withMessage('Content is required'),
    body('type').isIn(['text', 'photo', 'video', 'audio', 'link']).withMessage('Invalid memory type'),
    body('platform').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const memoryData = {
        userId: req.user.id,
        content: req.body.content,
        type: req.body.type,
        platform: req.body.platform || 'manual',
        media: req.files ? req.files.map(file => file.location || file.path) : [],
        metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {},
        tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
        location: req.body.location,
        createdAt: new Date()
      };

      const memory = await Memory.create(memoryData);
      
      // Emit real-time update
      const io = req.app.get('io');
      io.to(`user-${req.user.id}`).emit('memory-created', memory);
      
      res.status(201).json(memory);
    } catch (error) {
      console.error('Error creating memory:', error);
      res.status(500).json({ error: 'Failed to create memory' });
    }
  }
);

// Update memory
router.put('/:id',
  requireAuth,
  [
    body('content').optional().notEmpty().withMessage('Content cannot be empty'),
    body('tags').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const memory = await Memory.findById(req.params.id);
      
      if (!memory) {
        return res.status(404).json({ error: 'Memory not found' });
      }
      
      if (memory.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updates = {
        content: req.body.content || memory.content,
        tags: req.body.tags || memory.tags,
        location: req.body.location || memory.location,
        updatedAt: new Date()
      };

      const updatedMemory = await Memory.update(req.params.id, updates);
      
      // Emit real-time update
      const io = req.app.get('io');
      io.to(`user-${req.user.id}`).emit('memory-updated', updatedMemory);
      
      res.json(updatedMemory);
    } catch (error) {
      console.error('Error updating memory:', error);
      res.status(500).json({ error: 'Failed to update memory' });
    }
  }
);

// Delete memory
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);
    
    if (!memory) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    
    if (memory.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Memory.delete(req.params.id);
    
    // Emit real-time update
    const io = req.app.get('io');
    io.to(`user-${req.user.id}`).emit('memory-deleted', { id: req.params.id });
    
    res.json({ message: 'Memory deleted successfully' });
  } catch (error) {
    console.error('Error deleting memory:', error);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

// Search memories
router.get('/search', requireAuth, async (req, res) => {
  try {
    const { q, platform, type, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchResults = await Memory.search(req.user.id, {
      query: q.trim(),
      filters: {
        platform,
        type,
        dateFrom,
        dateTo
      },
      pagination: { page: parseInt(page), limit: parseInt(limit) }
    });

    res.json(searchResults);
  } catch (error) {
    console.error('Error searching memories:', error);
    res.status(500).json({ error: 'Failed to search memories' });
  }
});

// Get memory statistics
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const stats = await Memory.getStats(req.user.id);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching memory stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Export memories
router.get('/export', requireAuth, async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    
    const memories = await Memory.findByUser(req.user.id, { includeMedia: true });
    
    switch (format) {
      case 'json':
        res.setHeader('Content-Disposition', 'attachment; filename=memento-memories.json');
        res.setHeader('Content-Type', 'application/json');
        res.json(memories);
        break;
      
      case 'csv':
        const csv = Memory.toCSV(memories);
        res.setHeader('Content-Disposition', 'attachment; filename=memento-memories.csv');
        res.setHeader('Content-Type', 'text/csv');
        res.send(csv);
        break;
      
      default:
        return res.status(400).json({ error: 'Unsupported export format' });
    }
  } catch (error) {
    console.error('Error exporting memories:', error);
    res.status(500).json({ error: 'Failed to export memories' });
  }
});

module.exports = router;