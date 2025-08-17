const { db } = require('../services/database');

class TimeCapsule {
  static async create(capsuleData) {
    const result = await db.query(`
      INSERT INTO time_capsules (
        user_id, name, description, unlock_date, memory_ids, status,
        settings, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      capsuleData.userId,
      capsuleData.name,
      capsuleData.description,
      capsuleData.unlockDate,
      JSON.stringify(capsuleData.memoryIds),
      capsuleData.status,
      JSON.stringify(capsuleData.settings || {}),
      capsuleData.createdAt,
      capsuleData.createdAt
    ]);
    
    return this.formatCapsule(result.rows[0]);
  }

  static async findById(id) {
    const result = await db.query('SELECT * FROM time_capsules WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.formatCapsule(result.rows[0]) : null;
  }

  static async findByUser(userId, options = {}) {
    const {
      filters = {},
      pagination = { page: 1, limit: 20 },
      sorting = { field: 'created_at', order: 'desc' }
    } = options;

    let query = 'SELECT * FROM time_capsules WHERE user_id = $1';
    let params = [userId];
    let paramIndex = 2;

    // Apply filters
    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.unlockDateFrom) {
      query += ` AND unlock_date >= $${paramIndex}`;
      params.push(filters.unlockDateFrom);
      paramIndex++;
    }

    if (filters.unlockDateTo) {
      query += ` AND unlock_date <= $${paramIndex}`;
      params.push(filters.unlockDateTo);
      paramIndex++;
    }

    // Add sorting
    const allowedSortFields = ['created_at', 'updated_at', 'unlock_date', 'name'];
    const sortField = allowedSortFields.includes(sorting.field) ? sorting.field : 'created_at';
    query += ` ORDER BY ${sortField} ${sorting.order.toUpperCase()}`;

    // Add pagination
    const offset = (pagination.page - 1) * pagination.limit;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pagination.limit, offset);

    const result = await db.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM time_capsules WHERE user_id = $1';
    let countParams = [userId];

    if (filters.status) {
      countQuery += ' AND status = $2';
      countParams.push(filters.status);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    return {
      data: result.rows.map(row => this.formatCapsule(row)),
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
      if (key === 'memory_ids' || key === 'memoryIds') {
        updateFields.push(`memory_ids = $${paramIndex}`);
        params.push(JSON.stringify(updates[key] || updates.memoryIds));
      } else if (key === 'settings') {
        updateFields.push(`settings = $${paramIndex}`);
        params.push(JSON.stringify(updates[key]));
      } else {
        const dbField = key === 'unlockDate' ? 'unlock_date' : 
                       key === 'unlockedAt' ? 'unlocked_at' :
                       key === 'createdAt' ? 'created_at' :
                       key === 'updatedAt' ? 'updated_at' : key;
        updateFields.push(`${dbField} = $${paramIndex}`);
        params.push(updates[key]);
      }
      paramIndex++;
    });

    params.push(id);
    
    const result = await db.query(`
      UPDATE time_capsules SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, params);

    return result.rows.length > 0 ? this.formatCapsule(result.rows[0]) : null;
  }

  static async delete(id) {
    await db.query('DELETE FROM time_capsules WHERE id = $1', [id]);
    return true;
  }

  static async findUpcoming(userId, beforeDate) {
    const result = await db.query(`
      SELECT * FROM time_capsules 
      WHERE user_id = $1 AND status = 'sealed' AND unlock_date <= $2
      ORDER BY unlock_date ASC
    `, [userId, beforeDate]);

    return result.rows.map(row => this.formatCapsule(row));
  }

  static async findReadyToUnlock() {
    const now = new Date();
    const result = await db.query(`
      SELECT * FROM time_capsules 
      WHERE status = 'sealed' AND unlock_date <= $1
      ORDER BY unlock_date ASC
    `, [now]);

    return result.rows.map(row => this.formatCapsule(row));
  }

  static async getStats(userId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_capsules,
        COUNT(CASE WHEN status = 'sealed' THEN 1 END) as sealed_capsules,
        COUNT(CASE WHEN status = 'unlocked' THEN 1 END) as unlocked_capsules,
        AVG(
          CASE WHEN status = 'unlocked' 
          THEN EXTRACT(DAYS FROM (unlocked_at - created_at))
          ELSE EXTRACT(DAYS FROM (unlock_date - created_at))
          END
        ) as avg_wait_days,
        MIN(unlock_date) as next_unlock
      FROM time_capsules 
      WHERE user_id = $1
    `;

    const result = await db.query(statsQuery, [userId]);
    const stats = result.rows[0];

    // Get memory distribution in capsules
    const memoryStatsQuery = `
      SELECT 
        name,
        JSON_ARRAY_LENGTH(memory_ids) as memory_count,
        status,
        unlock_date
      FROM time_capsules 
      WHERE user_id = $1 
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const memoryResult = await db.query(memoryStatsQuery, [userId]);

    return {
      totalCapsules: parseInt(stats.total_capsules || 0),
      sealedCapsules: parseInt(stats.sealed_capsules || 0),
      unlockedCapsules: parseInt(stats.unlocked_capsules || 0),
      averageWaitDays: parseFloat(stats.avg_wait_days || 0),
      nextUnlock: stats.next_unlock,
      recentCapsules: memoryResult.rows.map(row => ({
        name: row.name,
        memoryCount: row.memory_count,
        status: row.status,
        unlockDate: row.unlock_date
      }))
    };
  }

  static async search(userId, searchTerm) {
    const result = await db.query(`
      SELECT * FROM time_capsules 
      WHERE user_id = $1 AND (
        name ILIKE $2 OR 
        description ILIKE $2
      )
      ORDER BY created_at DESC
    `, [userId, `%${searchTerm}%`]);

    return result.rows.map(row => this.formatCapsule(row));
  }

  static formatCapsule(row) {
    if (!row) return null;
    
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      unlockDate: row.unlock_date,
      memoryIds: JSON.parse(row.memory_ids || '[]'),
      status: row.status,
      settings: JSON.parse(row.settings || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      unlockedAt: row.unlocked_at
    };
  }
}

module.exports = TimeCapsule;