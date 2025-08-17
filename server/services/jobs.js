const Queue = require('bull');
const cron = require('node-cron');
const { cache } = require('./redis');
const TimeCapsule = require('../models/TimeCapsule');
const User = require('../models/User');
const { sendEmail } = require('./notifications');
const { cleanupOldFiles } = require('./storage');

// Initialize job queues
const emailQueue = new Queue('email processing', process.env.REDIS_URL);
const capsuleQueue = new Queue('capsule processing', process.env.REDIS_URL);
const syncQueue = new Queue('social sync', process.env.REDIS_URL);
const maintenanceQueue = new Queue('maintenance tasks', process.env.REDIS_URL);

// Email queue processors
emailQueue.process('send-email', async (job) => {
  const { to, subject, template, data } = job.data;
  
  try {
    await sendEmail(to, subject, template, data);
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
});

emailQueue.process('send-welcome-email', async (job) => {
  const { user } = job.data;
  
  try {
    await sendEmail(user.email, 'Welcome to Memento!', 'welcome', {
      name: user.name,
      storageType: user.storageType
    });
    console.log(`Welcome email sent to ${user.email}`);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    throw error;
  }
});

// Time capsule queue processors
capsuleQueue.process('unlock-capsule', async (job) => {
  const { capsuleId, userId } = job.data;
  
  try {
    const capsule = await TimeCapsule.findById(capsuleId);
    
    if (!capsule || capsule.status === 'unlocked') {
      return; // Capsule already unlocked or doesn't exist
    }

    const now = new Date();
    const unlockDate = new Date(capsule.unlockDate);
    
    if (now >= unlockDate) {
      // Unlock the capsule
      const unlockedCapsule = await TimeCapsule.update(capsuleId, {
        status: 'unlocked',
        unlockedAt: now,
        updatedAt: now
      });

      // Send unlock notification
      const user = await User.findById(userId);
      if (user && capsule.settings.notifyOnUnlock !== false) {
        await emailQueue.add('send-email', {
          to: user.email,
          subject: `🎉 Your time capsule "${capsule.name}" has been unlocked!`,
          template: 'capsule-unlock',
          data: {
            userName: user.name,
            capsuleName: capsule.name,
            memoryCount: capsule.memoryIds.length,
            unlockDate: unlockDate.toLocaleDateString()
          }
        });
      }

      // Emit real-time notification if user is online
      const io = require('../index').get('io');
      if (io) {
        io.to(`user-${userId}`).emit('capsule-unlocked', {
          capsule: unlockedCapsule,
          message: `Your time capsule "${capsule.name}" has been unlocked!`
        });
      }

      console.log(`Time capsule ${capsuleId} unlocked for user ${userId}`);
    }
  } catch (error) {
    console.error('Failed to unlock capsule:', error);
    throw error;
  }
});

// Social media sync queue processors
syncQueue.process('sync-user-platforms', async (job) => {
  const { userId, platforms } = job.data;
  
  try {
    const user = await User.findById(userId);
    if (!user) return;

    for (const platform of platforms) {
      try {
        await syncPlatform(userId, platform);
        console.log(`Synced ${platform} for user ${userId}`);
      } catch (error) {
        console.error(`Failed to sync ${platform} for user ${userId}:`, error);
      }
    }
  } catch (error) {
    console.error('Platform sync job failed:', error);
    throw error;
  }
});

syncQueue.process('sync-platform', async (job) => {
  const { userId, platform } = job.data;
  
  try {
    await syncPlatform(userId, platform);
    console.log(`Platform ${platform} synced for user ${userId}`);
  } catch (error) {
    console.error(`Platform sync failed for ${platform}:`, error);
    throw error;
  }
});

// Maintenance queue processors
maintenanceQueue.process('cleanup-old-files', async (job) => {
  const { daysOld = 90 } = job.data;
  
  try {
    const result = await cleanupOldFiles(daysOld);
    console.log(`Cleaned up ${result.deleted} old files`);
    return result;
  } catch (error) {
    console.error('File cleanup failed:', error);
    throw error;
  }
});

maintenanceQueue.process('check-overdue-capsules', async (job) => {
  try {
    const overdueCapsules = await TimeCapsule.findReadyToUnlock();
    
    for (const capsule of overdueCapsules) {
      await capsuleQueue.add('unlock-capsule', {
        capsuleId: capsule.id,
        userId: capsule.userId
      });
    }

    console.log(`Queued ${overdueCapsules.length} overdue capsules for unlocking`);
    return { processed: overdueCapsules.length };
  } catch (error) {
    console.error('Overdue capsule check failed:', error);
    throw error;
  }
});

maintenanceQueue.process('generate-daily-stats', async (job) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const statsKey = `stats:daily:${today}`;
    
    // Check if already generated
    const existing = await cache.get(statsKey);
    if (existing) {
      return existing;
    }

    // Generate stats (placeholder - implement based on your needs)
    const stats = {
      date: today,
      totalUsers: await getTotalUsers(),
      totalMemories: await getTotalMemories(),
      totalCapsules: await getTotalCapsules(),
      newSignups: await getNewSignups(today),
      capsulesUnlocked: await getCapsulesUnlockedToday(today)
    };

    // Cache for 25 hours
    await cache.set(statsKey, stats, 25 * 60 * 60);
    
    console.log('Daily stats generated:', stats);
    return stats;
  } catch (error) {
    console.error('Daily stats generation failed:', error);
    throw error;
  }
});

// Helper function to sync platform (placeholder)
async function syncPlatform(userId, platform) {
  // This would implement the actual platform sync logic
  // For now, just a placeholder
  console.log(`Syncing ${platform} for user ${userId}`);
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // You would implement actual platform sync here
  return { success: true, platform, userId };
}

// Helper functions for stats
async function getTotalUsers() {
  // Implement database query
  return 0;
}

async function getTotalMemories() {
  // Implement database query
  return 0;
}

async function getTotalCapsules() {
  // Implement database query
  return 0;
}

async function getNewSignups(date) {
  // Implement database query for new signups on specific date
  return 0;
}

async function getCapsulesUnlockedToday(date) {
  // Implement database query for capsules unlocked today
  return 0;
}

// Job scheduling with cron
const startBackgroundJobs = () => {
  console.log('Starting background jobs...');

  // Check for overdue capsules every hour
  cron.schedule('0 * * * *', () => {
    maintenanceQueue.add('check-overdue-capsules', {}, {
      attempts: 3,
      backoff: 'exponential'
    });
  });

  // Clean up old files daily at 2 AM
  cron.schedule('0 2 * * *', () => {
    maintenanceQueue.add('cleanup-old-files', { daysOld: 90 }, {
      attempts: 2,
      backoff: 'fixed'
    });
  });

  // Generate daily stats at midnight
  cron.schedule('0 0 * * *', () => {
    maintenanceQueue.add('generate-daily-stats', {}, {
      attempts: 2,
      backoff: 'fixed'
    });
  });

  // Auto-sync active users' platforms every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      // Get active users with connected platforms
      // This is a placeholder - implement based on your needs
      const activeUsers = []; // await getActiveUsersWithPlatforms();
      
      for (const user of activeUsers) {
        syncQueue.add('sync-user-platforms', {
          userId: user.id,
          platforms: user.connectedPlatforms
        }, {
          attempts: 2,
          backoff: 'fixed',
          delay: Math.random() * 60000 // Random delay up to 1 minute
        });
      }
    } catch (error) {
      console.error('Failed to queue platform syncs:', error);
    }
  });

  console.log('Background jobs scheduled');
};

// Queue monitoring
const getQueueStats = async () => {
  try {
    const stats = {
      email: {
        waiting: await emailQueue.getWaiting().length,
        active: await emailQueue.getActive().length,
        completed: await emailQueue.getCompleted().length,
        failed: await emailQueue.getFailed().length
      },
      capsule: {
        waiting: await capsuleQueue.getWaiting().length,
        active: await capsuleQueue.getActive().length,
        completed: await capsuleQueue.getCompleted().length,
        failed: await capsuleQueue.getFailed().length
      },
      sync: {
        waiting: await syncQueue.getWaiting().length,
        active: await syncQueue.getActive().length,
        completed: await syncQueue.getCompleted().length,
        failed: await syncQueue.getFailed().length
      },
      maintenance: {
        waiting: await maintenanceQueue.getWaiting().length,
        active: await maintenanceQueue.getActive().length,
        completed: await maintenanceQueue.getCompleted().length,
        failed: await maintenanceQueue.getFailed().length
      }
    };

    return stats;
  } catch (error) {
    console.error('Failed to get queue stats:', error);
    return null;
  }
};

// Clean up on shutdown
const cleanup = async () => {
  console.log('Shutting down job queues...');
  
  await Promise.all([
    emailQueue.close(),
    capsuleQueue.close(),
    syncQueue.close(),
    maintenanceQueue.close()
  ]);
  
  console.log('Job queues closed');
};

// Error handlers
emailQueue.on('failed', (job, error) => {
  console.error(`Email job ${job.id} failed:`, error);
});

capsuleQueue.on('failed', (job, error) => {
  console.error(`Capsule job ${job.id} failed:`, error);
});

syncQueue.on('failed', (job, error) => {
  console.error(`Sync job ${job.id} failed:`, error);
});

maintenanceQueue.on('failed', (job, error) => {
  console.error(`Maintenance job ${job.id} failed:`, error);
});

module.exports = {
  emailQueue,
  capsuleQueue,
  syncQueue,
  maintenanceQueue,
  startBackgroundJobs,
  getQueueStats,
  cleanup
};