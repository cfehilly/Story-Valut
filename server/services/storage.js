const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');

let s3 = null;

const initializeStorage = async () => {
  try {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
      });

      // Test S3 connection
      await s3.headBucket({ Bucket: process.env.AWS_S3_BUCKET }).promise();
      console.log('AWS S3 initialized successfully');
    } else {
      console.log('AWS credentials not provided, using local storage only');
    }

    // Ensure local uploads directory exists
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('Local uploads directory created');
    }

    return true;
  } catch (error) {
    console.error('Storage initialization error:', error);
    return false;
  }
};

const uploadFile = async (file, userId, options = {}) => {
  const { isPublic = false, folder = 'general' } = options;
  
  try {
    if (s3) {
      // Upload to S3
      const fileKey = `users/${userId}/${folder}/${Date.now()}-${file.originalname}`;
      
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: isPublic ? 'public-read' : 'private',
        Metadata: {
          originalName: file.originalname,
          uploadedBy: userId.toString(),
          uploadedAt: new Date().toISOString(),
          folder: folder
        }
      };

      const result = await s3.upload(params).promise();
      
      return {
        success: true,
        url: result.Location,
        key: result.Key,
        bucket: result.Bucket,
        storage: 'cloud'
      };
    } else {
      // Local storage fallback
      const uploadsDir = path.join(__dirname, '../../uploads', userId.toString());
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filename = `${Date.now()}-${file.originalname}`;
      const filePath = path.join(uploadsDir, filename);
      
      fs.writeFileSync(filePath, file.buffer);
      
      return {
        success: true,
        url: `/uploads/${userId}/${filename}`,
        path: filePath,
        storage: 'local'
      };
    }
  } catch (error) {
    console.error('File upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

const deleteFile = async (fileIdentifier, storage = 'cloud') => {
  try {
    if (storage === 'cloud' && s3) {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileIdentifier // fileIdentifier should be the S3 key
      };

      await s3.deleteObject(params).promise();
      return { success: true };
    } else {
      // Local storage
      if (fs.existsSync(fileIdentifier)) {
        fs.unlinkSync(fileIdentifier);
        return { success: true };
      }
      return { success: false, error: 'File not found' };
    }
  } catch (error) {
    console.error('File deletion error:', error);
    return { success: false, error: error.message };
  }
};

const getSignedUrl = async (fileKey, expiresIn = 3600) => {
  if (!s3 || !fileKey) {
    return null;
  }

  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileKey,
      Expires: expiresIn
    };

    return s3.getSignedUrl('getObject', params);
  } catch (error) {
    console.error('Signed URL error:', error);
    return null;
  }
};

const listFiles = async (userId, folder = null) => {
  try {
    if (s3) {
      const prefix = folder ? `users/${userId}/${folder}/` : `users/${userId}/`;
      
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Prefix: prefix
      };

      const result = await s3.listObjectsV2(params).promise();
      
      return {
        success: true,
        files: result.Contents.map(file => ({
          key: file.Key,
          size: file.Size,
          lastModified: file.LastModified,
          url: `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${file.Key}`
        }))
      };
    } else {
      // Local storage
      const userDir = path.join(__dirname, '../../uploads', userId.toString());
      if (!fs.existsSync(userDir)) {
        return { success: true, files: [] };
      }

      const files = fs.readdirSync(userDir).map(filename => {
        const filePath = path.join(userDir, filename);
        const stats = fs.statSync(filePath);
        
        return {
          filename,
          path: filePath,
          size: stats.size,
          lastModified: stats.mtime,
          url: `/uploads/${userId}/${filename}`
        };
      });

      return { success: true, files };
    }
  } catch (error) {
    console.error('List files error:', error);
    return { success: false, error: error.message };
  }
};

const getStorageStats = async (userId) => {
  try {
    const fileList = await listFiles(userId);
    
    if (!fileList.success) {
      return { success: false, error: fileList.error };
    }

    const stats = fileList.files.reduce((acc, file) => {
      acc.totalFiles += 1;
      acc.totalSize += file.size || 0;
      return acc;
    }, { totalFiles: 0, totalSize: 0 });

    return {
      success: true,
      stats: {
        ...stats,
        totalSizeMB: Math.round(stats.totalSize / (1024 * 1024) * 100) / 100,
        storageType: s3 ? 'cloud' : 'local'
      }
    };
  } catch (error) {
    console.error('Storage stats error:', error);
    return { success: false, error: error.message };
  }
};

const migrateToCloud = async (userId) => {
  if (!s3) {
    return { success: false, error: 'Cloud storage not configured' };
  }

  try {
    const localDir = path.join(__dirname, '../../uploads', userId.toString());
    
    if (!fs.existsSync(localDir)) {
      return { success: true, migrated: 0, message: 'No local files to migrate' };
    }

    const files = fs.readdirSync(localDir);
    let migrated = 0;
    let errors = 0;

    for (const filename of files) {
      try {
        const filePath = path.join(localDir, filename);
        const fileBuffer = fs.readFileSync(filePath);
        const stats = fs.statSync(filePath);
        
        const fileKey = `users/${userId}/migrated/${filename}`;
        
        const params = {
          Bucket: process.env.AWS_S3_BUCKET,
          Key: fileKey,
          Body: fileBuffer,
          Metadata: {
            originalName: filename,
            uploadedBy: userId.toString(),
            migratedAt: new Date().toISOString(),
            originalPath: filePath
          }
        };

        await s3.upload(params).promise();
        
        // Delete local file after successful upload
        fs.unlinkSync(filePath);
        migrated++;
        
      } catch (error) {
        console.error(`Migration error for file ${filename}:`, error);
        errors++;
      }
    }

    // Remove empty directory if all files migrated
    if (migrated > 0 && errors === 0) {
      try {
        fs.rmdirSync(localDir);
      } catch (error) {
        console.log('Could not remove local directory:', error.message);
      }
    }

    return {
      success: true,
      migrated,
      errors,
      message: `Migrated ${migrated} files to cloud storage${errors > 0 ? ` (${errors} errors)` : ''}`
    };
    
  } catch (error) {
    console.error('Migration error:', error);
    return { success: false, error: error.message };
  }
};

const createBackup = async (userId) => {
  try {
    const fileList = await listFiles(userId);
    
    if (!fileList.success) {
      return { success: false, error: fileList.error };
    }

    const backupData = {
      userId,
      createdAt: new Date().toISOString(),
      files: fileList.files,
      totalFiles: fileList.files.length,
      totalSize: fileList.files.reduce((sum, file) => sum + (file.size || 0), 0)
    };

    const backupKey = `backups/${userId}/${Date.now()}-backup.json`;
    
    if (s3) {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: backupKey,
        Body: JSON.stringify(backupData, null, 2),
        ContentType: 'application/json',
        Metadata: {
          type: 'backup',
          userId: userId.toString(),
          createdAt: new Date().toISOString()
        }
      };

      await s3.upload(params).promise();
    } else {
      const backupsDir = path.join(__dirname, '../../backups', userId.toString());
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }
      
      const backupPath = path.join(backupsDir, `${Date.now()}-backup.json`);
      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    }

    return {
      success: true,
      backup: backupData
    };
    
  } catch (error) {
    console.error('Backup creation error:', error);
    return { success: false, error: error.message };
  }
};

// Clean up old files (scheduled job)
const cleanupOldFiles = async (daysOld = 90) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    if (s3) {
      // Clean up S3 files
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Prefix: 'temp/' // Only cleanup temp files automatically
      };

      const objects = await s3.listObjectsV2(params).promise();
      const oldObjects = objects.Contents.filter(obj => obj.LastModified < cutoffDate);

      if (oldObjects.length > 0) {
        const deleteParams = {
          Bucket: process.env.AWS_S3_BUCKET,
          Delete: {
            Objects: oldObjects.map(obj => ({ Key: obj.Key }))
          }
        };

        await s3.deleteObjects(deleteParams).promise();
        return { success: true, deleted: oldObjects.length };
      }
    } else {
      // Clean up local temp files
      const tempDir = path.join(__dirname, '../../uploads/temp');
      
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        let deleted = 0;

        for (const file of files) {
          const filePath = path.join(tempDir, file);
          const stats = fs.statSync(filePath);

          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
            deleted++;
          }
        }

        return { success: true, deleted };
      }
    }

    return { success: true, deleted: 0 };
    
  } catch (error) {
    console.error('Cleanup error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  initializeStorage,
  uploadFile,
  deleteFile,
  getSignedUrl,
  listFiles,
  getStorageStats,
  migrateToCloud,
  createBackup,
  cleanupOldFiles
};