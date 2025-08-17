const { db } = require('../services/database');
const bcrypt = require('bcryptjs');

class User {
  static async create(userData) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    const result = await db.query(`
      INSERT INTO users (
        email, password_hash, name, storage_type, subscription_status,
        preferences, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      userData.email,
      hashedPassword,
      userData.name,
      userData.storageType || 'local',
      userData.subscriptionStatus || 'free',
      JSON.stringify(userData.preferences || {}),
      new Date(),
      new Date()
    ]);
    
    return this.formatUser(result.rows[0]);
  }

  static async findById(id) {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.formatUser(result.rows[0]) : null;
  }

  static async findByEmail(email) {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows.length > 0 ? this.formatUser(result.rows[0]) : null;
  }

  static async update(id, updates) {
    const updateFields = [];
    const params = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (key === 'preferences') {
        updateFields.push(`preferences = $${paramIndex}`);
        params.push(JSON.stringify(updates[key]));
      } else if (key === 'password') {
        // Hash password if provided
        updateFields.push(`password_hash = $${paramIndex}`);
        params.push(bcrypt.hashSync(updates[key], 12));
      } else {
        const dbField = key === 'storageType' ? 'storage_type' :
                       key === 'subscriptionStatus' ? 'subscription_status' :
                       key === 'createdAt' ? 'created_at' :
                       key === 'updatedAt' ? 'updated_at' : key;
        updateFields.push(`${dbField} = $${paramIndex}`);
        params.push(updates[key]);
      }
      paramIndex++;
    });

    params.push(id);
    
    const result = await db.query(`
      UPDATE users SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, params);

    return result.rows.length > 0 ? this.formatUser(result.rows[0]) : null;
  }

  static async validatePassword(user, password) {
    return bcrypt.compare(password, user.passwordHash);
  }

  static async getPreferences(userId) {
    const result = await db.query('SELECT preferences FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return null;
    
    return JSON.parse(result.rows[0].preferences || '{}');
  }

  static async updatePreferences(userId, preferences) {
    const result = await db.query(`
      UPDATE users SET preferences = $1, updated_at = $2
      WHERE id = $3
      RETURNING preferences
    `, [JSON.stringify(preferences), new Date(), userId]);

    return result.rows.length > 0 ? JSON.parse(result.rows[0].preferences) : null;
  }

  static async getStorageInfo(userId) {
    const user = await this.findById(userId);
    if (!user) return null;

    // Get storage usage statistics
    const memoryStatsQuery = `
      SELECT 
        COUNT(*) as total_memories,
        COUNT(CASE WHEN media != '[]' THEN 1 END) as memories_with_media,
        SUM(LENGTH(content)) as content_size
      FROM memories WHERE user_id = $1
    `;

    const capsuleStatsQuery = `
      SELECT COUNT(*) as total_capsules
      FROM time_capsules WHERE user_id = $1
    `;

    const memoryStats = await db.query(memoryStatsQuery, [userId]);
    const capsuleStats = await db.query(capsuleStatsQuery, [userId]);

    const storageUsage = {
      totalMemories: parseInt(memoryStats.rows[0].total_memories || 0),
      memoriesWithMedia: parseInt(memoryStats.rows[0].memories_with_media || 0),
      contentSize: parseInt(memoryStats.rows[0].content_size || 0),
      totalCapsules: parseInt(capsuleStats.rows[0].total_capsules || 0)
    };

    return {
      storageType: user.storageType,
      subscriptionStatus: user.subscriptionStatus,
      usage: storageUsage,
      limits: this.getStorageLimits(user.subscriptionStatus),
      upgrade: user.storageType === 'local' && user.subscriptionStatus === 'free'
    };
  }

  static getStorageLimits(subscriptionStatus) {
    const limits = {
      free: {
        maxMemories: 1000,
        maxCapsules: 3,
        maxPlatforms: 2,
        maxMediaSize: 50 * 1024 * 1024, // 50MB
        cloudStorage: false
      },
      premium: {
        maxMemories: -1, // Unlimited
        maxCapsules: -1, // Unlimited
        maxPlatforms: -1, // Unlimited
        maxMediaSize: 10 * 1024 * 1024 * 1024, // 10GB
        cloudStorage: true
      }
    };

    return limits[subscriptionStatus] || limits.free;
  }

  static async deleteAccount(userId) {
    // Start transaction
    await db.query('BEGIN');
    
    try {
      // Delete user memories
      await db.query('DELETE FROM memories WHERE user_id = $1', [userId]);
      
      // Delete user time capsules
      await db.query('DELETE FROM time_capsules WHERE user_id = $1', [userId]);
      
      // Delete social connections
      await db.query('DELETE FROM social_connections WHERE user_id = $1', [userId]);
      
      // Delete user activity logs
      await db.query('DELETE FROM user_activity WHERE user_id = $1', [userId]);
      
      // Finally delete the user
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
      
      await db.query('COMMIT');
      return true;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }

  static async exportData(userId) {
    const user = await this.findById(userId);
    if (!user) return null;

    // Get all user memories
    const memoriesQuery = `
      SELECT * FROM memories WHERE user_id = $1 ORDER BY created_at DESC
    `;
    const memories = await db.query(memoriesQuery, [userId]);

    // Get all user time capsules
    const capsulesQuery = `
      SELECT * FROM time_capsules WHERE user_id = $1 ORDER BY created_at DESC
    `;
    const capsules = await db.query(capsulesQuery, [userId]);

    // Get social connections
    const connectionsQuery = `
      SELECT platform, connected_at, status FROM social_connections 
      WHERE user_id = $1
    `;
    const connections = await db.query(connectionsQuery, [userId]);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        storageType: user.storageType,
        subscriptionStatus: user.subscriptionStatus,
        preferences: user.preferences,
        createdAt: user.createdAt,
        exportedAt: new Date().toISOString()
      },
      memories: memories.rows.map(row => ({
        id: row.id,
        platform: row.platform,
        type: row.type,
        content: row.content,
        media: JSON.parse(row.media || '[]'),
        metadata: JSON.parse(row.metadata || '{}'),
        tags: JSON.parse(row.tags || '[]'),
        location: JSON.parse(row.location || 'null'),
        createdAt: row.created_at
      })),
      timeCapsules: capsules.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        unlockDate: row.unlock_date,
        memoryIds: JSON.parse(row.memory_ids || '[]'),
        status: row.status,
        createdAt: row.created_at,
        unlockedAt: row.unlocked_at
      })),
      socialConnections: connections.rows,
      exportInfo: {
        version: '1.0',
        format: 'JSON',
        exportedAt: new Date().toISOString(),
        totalMemories: memories.rows.length,
        totalCapsules: capsules.rows.length
      }
    };
  }

  static async getActivityLog(userId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const result = await db.query(`
      SELECT * FROM user_activity 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    const countResult = await db.query(
      'SELECT COUNT(*) FROM user_activity WHERE user_id = $1',
      [userId]
    );

    return {
      activities: result.rows.map(row => ({
        id: row.id,
        action: row.action,
        details: JSON.parse(row.details || '{}'),
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        createdAt: row.created_at
      })),
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    };
  }

  static async logActivity(userId, action, details = {}, metadata = {}) {
    await db.query(`
      INSERT INTO user_activity (user_id, action, details, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      userId,
      action,
      JSON.stringify(details),
      metadata.ipAddress || null,
      metadata.userAgent || null,
      new Date()
    ]);
  }

  static formatUser(row) {
    if (!row) return null;
    
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash, // Keep for validation
      name: row.name,
      storageType: row.storage_type,
      subscriptionStatus: row.subscription_status,
      preferences: JSON.parse(row.preferences || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at,
      isActive: row.is_active !== false
    };
  }
}

module.exports = User;