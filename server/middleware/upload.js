const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const AWS = require('aws-sdk');

// Configure AWS S3 if using cloud storage
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Local storage configuration
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  }
});

// Memory storage for cloud uploads
const memoryStorage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'audio/mp3',
    'audio/wav',
    'audio/mpeg',
    'audio/ogg'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`), false);
  }
};

// Upload limits
const limits = {
  fileSize: 10 * 1024 * 1024, // 10MB per file
  files: 5 // Max 5 files per upload
};

// Create multer instances
const localUpload = multer({
  storage: localStorage,
  fileFilter,
  limits
});

const cloudUpload = multer({
  storage: memoryStorage,
  fileFilter,
  limits
});

// Middleware to handle file uploads based on user storage preference
const uploadMiddleware = {
  single: (fieldName) => {
    return async (req, res, next) => {
      try {
        const isCloudUser = req.user && req.user.storageType === 'cloud';
        const upload = isCloudUser ? cloudUpload : localUpload;
        
        upload.single(fieldName)(req, res, async (err) => {
          if (err) {
            return res.status(400).json({ error: err.message });
          }

          if (req.file && isCloudUser) {
            try {
              await uploadToS3(req.file, req.user.id);
            } catch (s3Error) {
              return res.status(500).json({ error: 'Failed to upload to cloud storage' });
            }
          }

          next();
        });
      } catch (error) {
        res.status(500).json({ error: 'Upload processing failed' });
      }
    };
  },

  array: (fieldName, maxCount) => {
    return async (req, res, next) => {
      try {
        const isCloudUser = req.user && req.user.storageType === 'cloud';
        const upload = isCloudUser ? cloudUpload : localUpload;
        
        upload.array(fieldName, maxCount)(req, res, async (err) => {
          if (err) {
            return res.status(400).json({ error: err.message });
          }

          if (req.files && req.files.length > 0 && isCloudUser) {
            try {
              for (const file of req.files) {
                await uploadToS3(file, req.user.id);
              }
            } catch (s3Error) {
              return res.status(500).json({ error: 'Failed to upload to cloud storage' });
            }
          }

          next();
        });
      } catch (error) {
        res.status(500).json({ error: 'Upload processing failed' });
      }
    };
  }
};

// Function to upload file to S3
async function uploadToS3(file, userId) {
  const fileKey = `users/${userId}/${Date.now()}-${file.originalname}`;
  
  let processedBuffer = file.buffer;
  
  // Process images if needed
  if (file.mimetype.startsWith('image/')) {
    processedBuffer = await processImage(file.buffer, file.mimetype);
  }

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: fileKey,
    Body: processedBuffer,
    ContentType: file.mimetype,
    ACL: 'private', // Files are private by default
    Metadata: {
      originalName: file.originalname,
      uploadedBy: userId.toString(),
      uploadedAt: new Date().toISOString()
    }
  };

  const result = await s3.upload(params).promise();
  
  // Add S3 info to file object
  file.location = result.Location;
  file.key = result.Key;
  file.bucket = result.Bucket;
  
  return result;
}

// Function to process images (resize, optimize)
async function processImage(buffer, mimetype) {
  try {
    // Only process JPEG and PNG images
    if (!['image/jpeg', 'image/png'].includes(mimetype)) {
      return buffer;
    }

    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Resize if image is too large
    if (metadata.width > 1920 || metadata.height > 1920) {
      return await image
        .resize(1920, 1920, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .jpeg({ quality: 85 })
        .toBuffer();
    }

    // Optimize quality
    return await image
      .jpeg({ quality: 90 })
      .toBuffer();
      
  } catch (error) {
    console.error('Image processing error:', error);
    // Return original buffer if processing fails
    return buffer;
  }
}

// Function to generate signed URL for S3 objects
async function getSignedUrl(key, expiresIn = 3600) {
  if (!key || !process.env.AWS_S3_BUCKET) {
    return null;
  }

  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Expires: expiresIn // 1 hour by default
    };

    return s3.getSignedUrl('getObject', params);
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }
}

// Function to delete file from S3
async function deleteFromS3(key) {
  if (!key || !process.env.AWS_S3_BUCKET) {
    return false;
  }

  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key
    };

    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    console.error('Error deleting from S3:', error);
    return false;
  }
}

// Function to delete local file
function deleteLocalFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting local file:', error);
    return false;
  }
}

// Middleware to serve uploaded files (for local storage)
const serveUploadedFile = (req, res, next) => {
  const filePath = path.join(__dirname, '../../uploads', req.params.filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Security check - ensure file belongs to requesting user
  if (req.user) {
    // You might want to add additional checks here to ensure
    // the file belongs to the requesting user
  }

  res.sendFile(filePath);
};

// Middleware to validate file ownership
const validateFileOwnership = async (req, res, next) => {
  try {
    // This would typically check a database table that maps files to users
    // For now, we'll assume files are accessible if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ error: 'File validation failed' });
  }
};

// Clean up old files (for scheduled cleanup jobs)
const cleanupOldFiles = async (daysOld = 30) => {
  const uploadsDir = path.join(__dirname, '../../uploads');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  try {
    if (!fs.existsSync(uploadsDir)) {
      return { deleted: 0, errors: 0 };
    }

    const files = fs.readdirSync(uploadsDir);
    let deleted = 0;
    let errors = 0;

    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtime < cutoffDate) {
        try {
          fs.unlinkSync(filePath);
          deleted++;
        } catch (error) {
          console.error(`Failed to delete ${file}:`, error);
          errors++;
        }
      }
    }

    return { deleted, errors };
  } catch (error) {
    console.error('Cleanup failed:', error);
    return { deleted: 0, errors: 1 };
  }
};

module.exports = {
  uploadMiddleware,
  getSignedUrl,
  deleteFromS3,
  deleteLocalFile,
  serveUploadedFile,
  validateFileOwnership,
  cleanupOldFiles,
  processImage
};