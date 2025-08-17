const { db } = require('../services/database');

class Memory {
  static async create(memoryData) {
    const result = await db.query(`
      INSERT INTO memories (
        user_id, platform, type, content, media, metadata, tags, 
        location, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      memoryData.userId,
      memoryData.platform,
      memoryData.type,
      memoryData.content,
      JSON.stringify(memoryData.media || []),
      JSON.stringify(memoryData.metadata || {}),
      JSON.stringify(memoryData.tags || []),
      JSON.stringify(memoryData.location || null),
      memoryData.createdAt,
      memoryData.createdAt
    ]);
    
    return this.formatMemory(result.rows[0]);
  }

  static async findById(id) {
    const result = await db.query('SELECT * FROM memories WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.formatMemory(result.rows[0]) : null;
  }

  static async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
    const result = await db.query(
      `SELECT * FROM memories WHERE id IN (${placeholders}) ORDER BY created_at DESC`,
      ids
    );
    
    return result.rows.map(row => this.formatMemory(row));
  }

  static async findByUser(userId, options = {}) {
    const {
      filters = {},
      pagination = { page: 1, limit: 20 },
      sorting = { field: 'created_at', order: 'desc' }
    } = options;

    let query = 'SELECT * FROM memories WHERE user_id = $1';
    let params = [userId];
    let paramIndex = 2;

    // Apply filters
    if (filters.platform) {
      query += ` AND platform = $${paramIndex}`;
      params.push(filters.platform);
      paramIndex++;
    }

    if (filters.type) {
      query += ` AND type = $${paramIndex}`;
      params.push(filters.type);
      paramIndex++;
    }

    if (filters.dateFrom) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(filters.dateTo);
      paramIndex++;
    }

    // Add sorting
    query += ` ORDER BY ${sorting.field} ${sorting.order.toUpperCase()}`;

    // Add pagination
    const offset = (pagination.page - 1) * pagination.limit;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pagination.limit, offset);

    const result = await db.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM memories WHERE user_id = $1';
    let countParams = [userId];
    let countIndex = 2;

    if (filters.platform) {
      countQuery += ` AND platform = $${countIndex}`;
      countParams.push(filters.platform);
      countIndex++;
    }

    if (filters.type) {
      countQuery += ` AND type = $${countIndex}`;
      countParams.push(filters.type);
      countIndex++;
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    return {
      data: result.rows.map(row => this.formatMemory(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit)
      },
      total
    };
  }

  static async update(id, updates) {
    const updateFields = [];
    const params = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (key === 'media' || key === 'metadata' || key === 'tags' || key === 'location') {
        updateFields.push(`${key} = $${paramIndex}`);
        params.push(JSON.stringify(updates[key]));
      } else {
        updateFields.push(`${key} = $${paramIndex}`);
        params.push(updates[key]);
      }
      paramIndex++;
    });

    params.push(id);
    
    const result = await db.query(`
      UPDATE memories SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, params);

    return result.rows.length > 0 ? this.formatMemory(result.rows[0]) : null;
  }

  static async delete(id) {
    await db.query('DELETE FROM memories WHERE id = $1', [id]);
    return true;
  }

  static async search(userId, searchOptions) {
    const {
      query,
      filters = {},
      pagination = { page: 1, limit: 20 }
    } = searchOptions;

    let searchQuery = `
      SELECT * FROM memories 
      WHERE user_id = $1 AND (
        content ILIKE $2 OR 
        tags::text ILIKE $2 OR
        metadata::text ILIKE $2
      )
    `;
    
    let params = [userId, `%${query}%`];
    let paramIndex = 3;

    // Apply filters
    if (filters.platform) {
      searchQuery += ` AND platform = $${paramIndex}`;
      params.push(filters.platform);
      paramIndex++;
    }

    if (filters.type) {
      searchQuery += ` AND type = $${paramIndex}`;
      params.push(filters.type);
      paramIndex++;
    }

    if (filters.dateFrom) {
      searchQuery += ` AND created_at >= $${paramIndex}`;
      params.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      searchQuery += ` AND created_at <= $${paramIndex}`;
      params.push(filters.dateTo);
      paramIndex++;
    }

    searchQuery += ' ORDER BY created_at DESC';

    // Add pagination
    const offset = (pagination.page - 1) * pagination.limit;
    searchQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pagination.limit, offset);

    const result = await db.query(searchQuery, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) FROM memories 
      WHERE user_id = $1 AND (
        content ILIKE $2 OR 
        tags::text ILIKE $2 OR
        metadata::text ILIKE $2
      )
    `;
    let countParams = [userId, `%${query}%`];

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    return {
      results: result.rows.map(row => this.formatMemory(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit)
      },
      total
    };
  }

  static async getStats(userId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_memories,
        COUNT(DISTINCT platform) as unique_platforms,
        COUNT(DISTINCT DATE(created_at)) as active_days,
        platform,
        COUNT(*) as platform_count
      FROM memories 
      WHERE user_id = $1 
      GROUP BY platform
      ORDER BY platform_count DESC
    `;

    const result = await db.query(statsQuery, [userId]);
    
    const totalMemories = result.rows.length > 0 ? parseInt(result.rows[0].total_memories) : 0;
    const uniquePlatforms = result.rows.length > 0 ? parseInt(result.rows[0].unique_platforms) : 0;
    const activeDays = result.rows.length > 0 ? parseInt(result.rows[0].active_days) : 0;
    
    const platformBreakdown = result.rows.map(row => ({
      platform: row.platform,
      count: parseInt(row.platform_count)
    }));

    return {
      totalMemories,
      uniquePlatforms,
      activeDays,
      platformBreakdown
    };
  }

  static async toCSV(memories) {
    const headers = ['ID', 'Platform', 'Type', 'Content', 'Created At', 'Tags'];
    const rows = memories.map(memory => [
      memory.id,
      memory.platform,
      memory.type,
      `"${memory.content.replace(/"/g, '""')}"`,
      memory.createdAt,
      memory.tags.join(';')
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  static formatMemory(row) {
    if (!row) return null;
    
    return {
      id: row.id,
      userId: row.user_id,
      platform: row.platform,
      type: row.type,
      content: row.content,
      media: JSON.parse(row.media || '[]'),
      metadata: JSON.parse(row.metadata || '{}'),
      tags: JSON.parse(row.tags || '[]'),
      location: JSON.parse(row.location || 'null'),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = Memory;