const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

let transporter = null;

// Initialize email transporter
const initializeNotifications = async () => {
  try {
    if (process.env.SENDGRID_API_KEY) {
      // SendGrid configuration
      transporter = nodemailer.createTransporter({
        service: 'SendGrid',
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY
        }
      });
    } else if (process.env.AWS_SES_ACCESS_KEY) {
      // AWS SES configuration
      transporter = nodemailer.createTransporter({
        SES: {
          aws: {
            accessKeyId: process.env.AWS_SES_ACCESS_KEY,
            secretAccessKey: process.env.AWS_SES_SECRET_KEY,
            region: process.env.AWS_SES_REGION || 'us-east-1'
          }
        }
      });
    } else {
      // Development/testing configuration
      transporter = nodemailer.createTransporter({
        host: 'localhost',
        port: 1025,
        ignoreTLS: true,
        auth: false
      });
    }

    // Verify transporter configuration
    if (transporter) {
      await transporter.verify();
      console.log('Email transporter initialized successfully');
    }
    
  } catch (error) {
    console.error('Failed to initialize email transporter:', error);
    transporter = null;
  }
};

// Email templates
const emailTemplates = {
  welcome: {
    subject: 'Welcome to Story Vault! 🎉',
    template: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #F4F0E8; padding: 20px;">
        <div style="background: white; border-radius: 20px; padding: 40px; box-shadow: 0 4px 16px rgba(74, 63, 53, 0.12);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="width: 80px; height: 70px; background: linear-gradient(135deg, #F2D492, #E6C79A); border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 2rem;">📦</div>
            <h1 style="color: #4A3F35; font-family: 'Crimson Text', serif; font-size: 2.5rem; margin: 0;">Welcome to Story Vault!</h1>
          </div>
          
          <p style="color: #8B7D6B; font-size: 1.1rem; line-height: 1.6; margin-bottom: 20px;">
            Hello {{name}},
          </p>
          
          <p style="color: #8B7D6B; font-size: 1.1rem; line-height: 1.6; margin-bottom: 20px;">
            Welcome to your digital time capsule! You've chosen <strong>{{storageType}}</strong> storage for your memories.
          </p>
          
          <div style="background: linear-gradient(135deg, #E8B4A0, #D4C5D9); border-radius: 16px; padding: 30px; margin: 30px 0; text-align: center;">
            <h3 style="color: #4A3F35; margin: 0 0 15px;">What's next?</h3>
            <p style="color: #4A3F35; margin: 0;">
              Start by connecting your social media accounts or adding memories manually to build your first time capsule.
            </p>
          </div>
          
          <p style="color: #8B7D6B; font-size: 1rem; line-height: 1.6;">
            If you have any questions, just reply to this email. We're here to help!
          </p>
          
          <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #E5E5E5; text-align: center;">
            <p style="color: #A09080; font-size: 0.9rem; margin: 0;">
              Happy story preserving,<br>
              The Story Vault Team
            </p>
          </div>
        </div>
      </div>
    `
  },

  'capsule-unlock': {
    subject: '🎉 Your time capsule "{{capsuleName}}" has been unlocked!',
    template: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #F4F0E8; padding: 20px;">
        <div style="background: white; border-radius: 20px; padding: 40px; box-shadow: 0 4px 16px rgba(74, 63, 53, 0.12);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="width: 100px; height: 80px; background: linear-gradient(135deg, #F2D492, #E6C79A); border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 3rem;">📂</div>
            <h1 style="color: #4A3F35; font-family: 'Crimson Text', serif; font-size: 2.2rem; margin: 0;">Time Capsule Unlocked!</h1>
          </div>
          
          <p style="color: #8B7D6B; font-size: 1.1rem; line-height: 1.6; margin-bottom: 20px;">
            Hello {{userName}},
          </p>
          
          <p style="color: #8B7D6B; font-size: 1.1rem; line-height: 1.6; margin-bottom: 30px;">
            Your time capsule <strong>"{{capsuleName}}"</strong> has been unlocked! It contains <strong>{{memoryCount}}</strong> precious memories waiting to be rediscovered.
          </p>
          
          <div style="background: linear-gradient(135deg, #E8B4A0, #D4C5D9); border-radius: 16px; padding: 30px; margin: 30px 0; text-align: center;">
            <h3 style="color: #4A3F35; margin: 0 0 15px;">✨ Ready for a trip down memory lane?</h3>
            <p style="color: #4A3F35; margin: 0 0 20px;">
              Your memories from {{unlockDate}} are now available to view and cherish.
            </p>
            <a href="{{appUrl}}" style="display: inline-block; background: linear-gradient(135deg, #F2D492, #E6C79A); color: #4A3F35; padding: 15px 30px; border-radius: 12px; text-decoration: none; font-weight: 600;">
              Open Your Time Capsule
            </a>
          </div>
          
          <p style="color: #8B7D6B; font-size: 1rem; line-height: 1.6;">
            We hope these memories bring back wonderful moments and emotions. Consider creating your next time capsule to preserve today's memories for the future!
          </p>
          
          <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #E5E5E5; text-align: center;">
            <p style="color: #A09080; font-size: 0.9rem; margin: 0;">
              Keep preserving those precious moments,<br>
              The Story Vault Team
            </p>
          </div>
        </div>
      </div>
    `
  },

  'password-reset': {
    subject: 'Reset your Story Vault password',
    template: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #F4F0E8; padding: 20px;">
        <div style="background: white; border-radius: 20px; padding: 40px; box-shadow: 0 4px 16px rgba(74, 63, 53, 0.12);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="width: 80px; height: 70px; background: linear-gradient(135deg, #F2D492, #E6C79A); border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 2rem;">🔑</div>
            <h1 style="color: #4A3F35; font-family: 'Crimson Text', serif; font-size: 2rem; margin: 0;">Password Reset</h1>
          </div>
          
          <p style="color: #8B7D6B; font-size: 1.1rem; line-height: 1.6; margin-bottom: 20px;">
            Hello {{name}},
          </p>
          
          <p style="color: #8B7D6B; font-size: 1.1rem; line-height: 1.6; margin-bottom: 30px;">
            We received a request to reset your password. Click the button below to create a new password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{resetLink}}" style="display: inline-block; background: linear-gradient(135deg, #F2D492, #E6C79A); color: #4A3F35; padding: 15px 30px; border-radius: 12px; text-decoration: none; font-weight: 600;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #8B7D6B; font-size: 1rem; line-height: 1.6;">
            This link will expire in 1 hour. If you didn't request this password reset, you can safely ignore this email.
          </p>
          
          <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #E5E5E5; text-align: center;">
            <p style="color: #A09080; font-size: 0.9rem; margin: 0;">
              Stay secure,<br>
              The Story Vault Team
            </p>
          </div>
        </div>
      </div>
    `
  },

  'upgrade-reminder': {
    subject: '✨ Unlock more stories with Story Vault Premium',
    template: `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #F4F0E8; padding: 20px;">
        <div style="background: white; border-radius: 20px; padding: 40px; box-shadow: 0 4px 16px rgba(74, 63, 53, 0.12);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="width: 100px; height: 80px; background: linear-gradient(135deg, #F2D492, #E6C79A); border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 2.5rem;">✨</div>
            <h1 style="color: #4A3F35; font-family: 'Crimson Text', serif; font-size: 2.2rem; margin: 0;">Ready for More?</h1>
          </div>
          
          <p style="color: #8B7D6B; font-size: 1.1rem; line-height: 1.6; margin-bottom: 20px;">
            Hello {{userName}},
          </p>
          
          <p style="color: #8B7D6B; font-size: 1.1rem; line-height: 1.6; margin-bottom: 30px;">
            You've been making great stories with Story Vault! You currently have {{memoryCount}} memories and {{capsuleCount}} time capsules.
          </p>
          
          <div style="background: linear-gradient(135deg, #E8B4A0, #D4C5D9); border-radius: 16px; padding: 30px; margin: 30px 0;">
            <h3 style="color: #4A3F35; margin: 0 0 20px; text-align: center;">Upgrade to Premium & Get:</h3>
            <ul style="color: #4A3F35; margin: 0; padding-left: 20px;">
              <li>☁️ Cloud storage with access anywhere</li>
              <li>🔄 Connect all your social platforms</li>
              <li>♾️ Unlimited memories and time capsules</li>
              <li>📤 Share your time capsules with loved ones</li>
              <li>🤖 Advanced AI-powered memory insights</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="{{upgradeUrl}}" style="display: inline-block; background: linear-gradient(135deg, #F2D492, #E6C79A); color: #4A3F35; padding: 15px 30px; border-radius: 12px; text-decoration: none; font-weight: 600;">
              Start Your Free Trial
            </a>
            <p style="color: #A09080; font-size: 0.9rem; margin: 10px 0 0;">
              7 days free, then $4.99/month
            </p>
          </div>
          
          <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #E5E5E5; text-align: center;">
            <p style="color: #A09080; font-size: 0.9rem; margin: 0;">
              Keep creating stories,<br>
              The Story Vault Team
            </p>
          </div>
        </div>
      </div>
    `
  }
};

// Compile template with data
const compileTemplate = (template, data) => {
  const compiled = handlebars.compile(template);
  return compiled({
    ...data,
    appUrl: process.env.CLIENT_URL || 'https://app.storyvault.com',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@storyvault.com'
  });
};

// Send email function
const sendEmail = async (to, subject, templateName, data = {}) => {
  if (!transporter) {
    console.log('Email transporter not available, skipping email to:', to);
    return false;
  }

  try {
    const template = emailTemplates[templateName];
    if (!template) {
      throw new Error(`Email template '${templateName}' not found`);
    }

    // Compile template with data
    const html = compileTemplate(template.template, data);
    const compiledSubject = compileTemplate(template.subject, data);

    const mailOptions = {
      from: `Story Vault <${process.env.FROM_EMAIL || 'noreply@storyvault.com'}>`,
      to,
      subject: compiledSubject,
      html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}:`, result.messageId);
    return true;
    
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
};

// Send bulk emails
const sendBulkEmails = async (recipients, subject, templateName, data = {}) => {
  const results = [];
  
  for (const recipient of recipients) {
    try {
      await sendEmail(recipient.email, subject, templateName, {
        ...data,
        ...recipient.data
      });
      results.push({ email: recipient.email, success: true });
    } catch (error) {
      results.push({ email: recipient.email, success: false, error: error.message });
    }
  }
  
  return results;
};

// Notification preferences
const shouldSendNotification = (user, notificationType) => {
  const preferences = user.preferences?.notifications || {};
  
  switch (notificationType) {
    case 'capsule-unlock':
      return preferences.capsuleUnlock !== false;
    case 'welcome':
      return true; // Always send welcome emails
    case 'password-reset':
      return true; // Always send password reset emails
    case 'upgrade-reminder':
      return preferences.marketing !== false;
    default:
      return preferences.general !== false;
  }
};

// High-level notification functions
const sendWelcomeEmail = async (user) => {
  if (!shouldSendNotification(user, 'welcome')) return false;
  
  return await sendEmail(user.email, null, 'welcome', {
    name: user.name,
    storageType: user.storageType === 'cloud' ? 'Cloud' : 'Local'
  });
};

const sendCapsuleUnlockNotification = async (user, capsule) => {
  if (!shouldSendNotification(user, 'capsule-unlock')) return false;
  
  return await sendEmail(user.email, null, 'capsule-unlock', {
    userName: user.name,
    capsuleName: capsule.name,
    memoryCount: capsule.memoryIds?.length || 0,
    unlockDate: new Date(capsule.unlockDate).toLocaleDateString()
  });
};

const sendPasswordResetEmail = async (user, resetToken) => {
  const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
  
  return await sendEmail(user.email, null, 'password-reset', {
    name: user.name,
    resetLink
  });
};

const sendUpgradeReminder = async (user, stats = {}) => {
  if (!shouldSendNotification(user, 'upgrade-reminder')) return false;
  
  const upgradeUrl = `${process.env.CLIENT_URL}/upgrade`;
  
  return await sendEmail(user.email, null, 'upgrade-reminder', {
    userName: user.name,
    memoryCount: stats.memoryCount || 0,
    capsuleCount: stats.capsuleCount || 0,
    upgradeUrl
  });
};

// Push notifications (placeholder for future implementation)
const sendPushNotification = async (userId, title, body, data = {}) => {
  // This would implement push notifications using Firebase or similar
  console.log(`Push notification to user ${userId}: ${title} - ${body}`);
  return true;
};

// In-app notifications
const createInAppNotification = async (userId, type, title, message, data = {}) => {
  // This would store notifications in database for in-app display
  console.log(`In-app notification for user ${userId}: ${title}`);
  return true;
};

module.exports = {
  initializeNotifications,
  sendEmail,
  sendBulkEmails,
  sendWelcomeEmail,
  sendCapsuleUnlockNotification,
  sendPasswordResetEmail,
  sendUpgradeReminder,
  sendPushNotification,
  createInAppNotification,
  shouldSendNotification
};