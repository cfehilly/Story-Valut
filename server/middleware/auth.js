const jwt = require('jsonwebtoken');
const User = require('../models/User');

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const user = await User.findById(decoded.userId);
      
      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Invalid or inactive user' });
      }

      // Add user to request object
      req.user = user;
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Access token expired' });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid access token' });
      } else {
        throw jwtError;
      }
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No auth provided, continue without user
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next(); // No token, continue without user
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (user && user.isActive) {
        req.user = user;
      }
    } catch (jwtError) {
      // Silently continue without user if token is invalid
    }
    
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue without user if there's an error
  }
};

const requirePremium = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.subscriptionStatus !== 'premium' && req.user.subscriptionStatus !== 'trial') {
    return res.status(403).json({ 
      error: 'Premium subscription required',
      upgrade: true,
      currentPlan: req.user.subscriptionStatus
    });
  }

  next();
};

const requireCloudStorage = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.storageType !== 'cloud') {
    return res.status(403).json({ 
      error: 'Cloud storage required',
      upgrade: true,
      currentStorage: req.user.storageType
    });
  }

  next();
};

const checkRateLimit = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.ip + (req.user ? `:${req.user.id}` : '');
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    const userRequests = requests.get(key) || [];
    const recentRequests = userRequests.filter(time => time > windowStart);

    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests',
        retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
      });
    }

    recentRequests.push(now);
    requests.set(key, recentRequests);

    next();
  };
};

const logUserActivity = (action) => {
  return async (req, res, next) => {
    if (req.user) {
      try {
        await User.logActivity(req.user.id, action, {
          url: req.url,
          method: req.method,
          params: req.params,
          query: req.query
        }, {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (error) {
        console.error('Failed to log user activity:', error);
        // Don't fail the request if activity logging fails
      }
    }
    next();
  };
};

// Middleware to validate API version
const validateApiVersion = (req, res, next) => {
  const apiVersion = req.headers['api-version'] || req.query.v || 'v1';
  const supportedVersions = ['v1'];

  if (!supportedVersions.includes(apiVersion)) {
    return res.status(400).json({
      error: 'Unsupported API version',
      supportedVersions
    });
  }

  req.apiVersion = apiVersion;
  next();
};

// Middleware to handle storage type restrictions
const checkStorageAccess = (feature) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const storageRestrictions = {
      'multiple-platforms': ['cloud'],
      'advanced-sync': ['cloud'],
      'sharing': ['cloud'],
      'backup': ['cloud']
    };

    const requiredStorage = storageRestrictions[feature];
    
    if (requiredStorage && !requiredStorage.includes(req.user.storageType)) {
      return res.status(403).json({
        error: `Feature '${feature}' requires cloud storage`,
        upgrade: true,
        currentStorage: req.user.storageType,
        feature
      });
    }

    next();
  };
};

module.exports = {
  requireAuth,
  optionalAuth,
  requirePremium,
  requireCloudStorage,
  checkRateLimit,
  logUserActivity,
  validateApiVersion,
  checkStorageAccess
};