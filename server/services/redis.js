const redis = require('redis');
const winston = require('winston');

let redisClient = null;

const initializeRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = redis.createClient({
      url: redisUrl,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          console.error('Redis connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    redisClient.on('error', (err) => {
      console.error('Redis error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Connected to Redis');
    });

    redisClient.on('ready', () => {
      console.log('Redis client ready');
    });

    redisClient.on('end', () => {
      console.log('Redis connection ended');
    });

    await redisClient.connect();
    
    // Test connection
    await redisClient.ping();
    console.log('Redis connection successful');
    
    return redisClient;
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
    // Don't fail the app if Redis is not available
    redisClient = null;
    return null;
  }
};

const getRedisClient = () => {
  return redisClient;
};

// Cache operations with fallback
const cache = {
  async get(key) {
    if (!redisClient) return null;
    
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  },

  async set(key, value, ttl = 3600) {
    if (!redisClient) return false;
    
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await redisClient.setEx(key, ttl, serialized);
      } else {
        await redisClient.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  },

  async del(key) {
    if (!redisClient) return false;
    
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  },

  async exists(key) {
    if (!redisClient) return false;
    
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  },

  async incr(key, ttl = null) {
    if (!redisClient) return 1;
    
    try {
      const result = await redisClient.incr(key);
      if (ttl && result === 1) {
        await redisClient.expire(key, ttl);
      }
      return result;
    } catch (error) {
      console.error('Redis INCR error:', error);
      return 1;
    }
  },

  async sadd(key, ...members) {
    if (!redisClient) return false;
    
    try {
      await redisClient.sAdd(key, members);
      return true;
    } catch (error) {
      console.error('Redis SADD error:', error);
      return false;
    }
  },

  async smembers(key) {
    if (!redisClient) return [];
    
    try {
      return await redisClient.sMembers(key);
    } catch (error) {
      console.error('Redis SMEMBERS error:', error);
      return [];
    }
  },

  async srem(key, member) {
    if (!redisClient) return false;
    
    try {
      await redisClient.sRem(key, member);
      return true;
    } catch (error) {
      console.error('Redis SREM error:', error);
      return false;
    }
  }
};

// Session management
const session = {
  async create(userId, sessionData, ttl = 86400) {
    const sessionKey = `session:${userId}`;
    return await cache.set(sessionKey, {
      ...sessionData,
      createdAt: new Date().toISOString()
    }, ttl);
  },

  async get(userId) {
    const sessionKey = `session:${userId}`;
    return await cache.get(sessionKey);
  },

  async update(userId, updates) {
    const sessionKey = `session:${userId}`;
    const existing = await cache.get(sessionKey);
    if (existing) {
      return await cache.set(sessionKey, {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString()
      });
    }
    return false;
  },

  async destroy(userId) {
    const sessionKey = `session:${userId}`;
    return await cache.del(sessionKey);
  }
};

// Rate limiting
const rateLimit = {
  async check(key, limit, window) {
    if (!redisClient) return { allowed: true, count: 0 };
    
    try {
      const count = await cache.incr(key, window);
      return {
        allowed: count <= limit,
        count,
        limit,
        remaining: Math.max(0, limit - count),
        resetTime: new Date(Date.now() + window * 1000)
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      return { allowed: true, count: 0 };
    }
  }
};

// Queue operations (for background jobs)
const queue = {
  async add(queueName, jobData, options = {}) {
    if (!redisClient) return false;
    
    try {
      const job = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        data: jobData,
        options,
        createdAt: new Date().toISOString(),
        status: 'pending'
      };
      
      await redisClient.lPush(`queue:${queueName}`, JSON.stringify(job));
      return job.id;
    } catch (error) {
      console.error('Queue add error:', error);
      return false;
    }
  },

  async get(queueName) {
    if (!redisClient) return null;
    
    try {
      const jobString = await redisClient.rPop(`queue:${queueName}`);
      return jobString ? JSON.parse(jobString) : null;
    } catch (error) {
      console.error('Queue get error:', error);
      return null;
    }
  },

  async length(queueName) {
    if (!redisClient) return 0;
    
    try {
      return await redisClient.lLen(`queue:${queueName}`);
    } catch (error) {
      console.error('Queue length error:', error);
      return 0;
    }
  }
};

// Pub/Sub for real-time features
const pubsub = {
  async publish(channel, message) {
    if (!redisClient) return false;
    
    try {
      await redisClient.publish(channel, JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Publish error:', error);
      return false;
    }
  },

  async subscribe(channel, callback) {
    if (!redisClient) return false;
    
    try {
      const subscriber = redisClient.duplicate();
      await subscriber.connect();
      
      await subscriber.subscribe(channel, (message) => {
        try {
          callback(JSON.parse(message));
        } catch (error) {
          console.error('Message parse error:', error);
        }
      });
      
      return subscriber;
    } catch (error) {
      console.error('Subscribe error:', error);
      return false;
    }
  }
};

// Clean up on app shutdown
const cleanup = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('Redis connection closed');
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }
};

module.exports = {
  initializeRedis,
  getRedisClient,
  cache,
  session,
  rateLimit,
  queue,
  pubsub,
  cleanup
};