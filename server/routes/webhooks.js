// Webhook handlers for payments and social platforms
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { updateUserSubscription, getUserById } = require('../services/userService');
const { sendSubscriptionEmail, sendCapsuleNotification } = require('../services/emailService');
const { checkUnlockableCapsules } = require('../services/capsuleService');
const winston = require('winston');

const router = express.Router();
const logger = winston.createLogger({ /* logger config */ });

// Stripe webhook endpoint
router.post('/stripe', 
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object);
          break;

        case 'customer.subscription.created':
          await handleSubscriptionCreated(event.data.object);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;

        case 'invoice.payment_succeeded':
          await handlePaymentSucceeded(event.data.object);
          break;

        case 'invoice.payment_failed':
          await handlePaymentFailed(event.data.object);
          break;

        case 'customer.subscription.trial_will_end':
          await handleTrialWillEnd(event.data.object);
          break;

        default:
          logger.info(`Unhandled webhook event type: ${event.type}`);
      }

      res.status(200).json({ received: true });

    } catch (error) {
      logger.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

// Handle successful checkout session
async function handleCheckoutCompleted(session) {
  try {
    const userId = session.metadata.userId;
    const planType = session.metadata.planType;

    if (!userId) {
      logger.error('No userId in checkout session metadata');
      return;
    }

    const user = await getUserById(parseInt(userId));
    if (!user) {
      logger.error(`User not found: ${userId}`);
      return;
    }

    // Retrieve the subscription
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    
    await updateUserSubscription(userId, {
      planType: 'premium',
      stripeCustomerId: session.customer,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialEndDate: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
    });

    logger.info(`Subscription activated for user ${userId}`, {
      subscriptionId: subscription.id,
      planType: planType
    });

    // Send welcome email
    await sendSubscriptionEmail(user.email, 'welcome', {
      displayName: user.display_name,
      planType: planType
    });

  } catch (error) {
    logger.error('Error handling checkout completion:', error);
    throw error;
  }
}

// Handle subscription creation
async function handleSubscriptionCreated(subscription) {
  try {
    const userId = subscription.metadata.userId;
    
    if (!userId) {
      logger.error('No userId in subscription metadata');
      return;
    }

    await updateUserSubscription(userId, {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialEndDate: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
    });

    logger.info(`Subscription created for user ${userId}`, {
      subscriptionId: subscription.id
    });

  } catch (error) {
    logger.error('Error handling subscription creation:', error);
    throw error;
  }
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription) {
  try {
    const userId = subscription.metadata.userId;
    
    if (!userId) {
      // Try to find user by customer ID
      const customer = await stripe.customers.retrieve(subscription.customer);
      if (customer.metadata.userId) {
        userId = customer.metadata.userId;
      } else {
        logger.error('No userId found for subscription update');
        return;
      }
    }

    const planType = subscription.status === 'active' ? 'premium' : 
                    subscription.status === 'trialing' ? 'trial' : 'free';

    await updateUserSubscription(userId, {
      planType: planType,
      subscriptionStatus: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialEndDate: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });

    logger.info(`Subscription updated for user ${userId}`, {
      subscriptionId: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });

    // Send appropriate email based on status change
    const user = await getUserById(parseInt(userId));
    if (user && subscription.cancel_at_period_end) {
      await sendSubscriptionEmail(user.email, 'cancellation', {
        displayName: user.display_name,
        periodEnd: new Date(subscription.current_period_end * 1000)
      });
    }

  } catch (error) {
    logger.error('Error handling subscription update:', error);
    throw error;
  }
}

// Handle subscription deletion
async function handleSubscriptionDeleted(subscription) {
  try {
    const userId = subscription.metadata.userId;
    
    if (!userId) {
      logger.error('No userId in subscription metadata for deletion');
      return;
    }

    await updateUserSubscription(userId, {
      planType: 'free',
      subscriptionStatus: 'cancelled',
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      trialEndDate: null,
      cancelAtPeriodEnd: false
    });

    logger.info(`Subscription cancelled for user ${userId}`, {
      subscriptionId: subscription.id
    });

    // Send cancellation confirmation email
    const user = await getUserById(parseInt(userId));
    if (user) {
      await sendSubscriptionEmail(user.email, 'cancelled', {
        displayName: user.display_name
      });
    }

  } catch (error) {
    logger.error('Error handling subscription deletion:', error);
    throw error;
  }
}

// Handle successful payment
async function handlePaymentSucceeded(invoice) {
  try {
    if (invoice.billing_reason === 'subscription_cycle') {
      // Regular subscription payment
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const userId = subscription.metadata.userId;

      if (userId) {
        const user = await getUserById(parseInt(userId));
        if (user) {
          await sendSubscriptionEmail(user.email, 'payment_success', {
            displayName: user.display_name,
            amount: invoice.amount_paid / 100,
            currency: invoice.currency.toUpperCase(),
            periodStart: new Date(subscription.current_period_start * 1000),
            periodEnd: new Date(subscription.current_period_end * 1000)
          });

          logger.info(`Payment succeeded for user ${userId}`, {
            invoiceId: invoice.id,
            amount: invoice.amount_paid
          });
        }
      }
    }

  } catch (error) {
    logger.error('Error handling payment success:', error);
    throw error;
  }
}

// Handle failed payment
async function handlePaymentFailed(invoice) {
  try {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    const userId = subscription.metadata.userId;

    if (userId) {
      const user = await getUserById(parseInt(userId));
      if (user) {
        await sendSubscriptionEmail(user.email, 'payment_failed', {
          displayName: user.display_name,
          amount: invoice.amount_due / 100,
          currency: invoice.currency.toUpperCase(),
          nextAttempt: invoice.next_payment_attempt ? 
            new Date(invoice.next_payment_attempt * 1000) : null
        });

        logger.warn(`Payment failed for user ${userId}`, {
          invoiceId: invoice.id,
          amount: invoice.amount_due,
          attemptCount: invoice.attempt_count
        });
      }
    }

  } catch (error) {
    logger.error('Error handling payment failure:', error);
    throw error;
  }
}

// Handle trial ending soon
async function handleTrialWillEnd(subscription) {
  try {
    const userId = subscription.metadata.userId;

    if (userId) {
      const user = await getUserById(parseInt(userId));
      if (user) {
        await sendSubscriptionEmail(user.email, 'trial_ending', {
          displayName: user.display_name,
          trialEnd: new Date(subscription.trial_end * 1000),
          daysLeft: Math.ceil((subscription.trial_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
        });

        logger.info(`Trial ending notification sent to user ${userId}`, {
          trialEnd: new Date(subscription.trial_end * 1000)
        });
      }
    }

  } catch (error) {
    logger.error('Error handling trial will end:', error);
    throw error;
  }
}

// Social media platform webhooks (for real-time updates)
router.post('/twitter', async (req, res) => {
  try {
    // Twitter webhook for real-time updates
    // Verify webhook signature
    const signature = req.headers['x-twitter-webhooks-signature'];
    // Implementation for Twitter webhook verification and processing
    
    logger.info('Twitter webhook received');
    res.status(200).json({ status: 'ok' });

  } catch (error) {
    logger.error('Twitter webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

router.post('/facebook', async (req, res) => {
  try {
    // Facebook/Instagram webhook for real-time updates
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      // Process webhook data
      logger.info('Facebook webhook received');
      res.status(200).json({ status: 'ok' });
    }

  } catch (error) {
    logger.error('Facebook webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Time capsule unlock notifications (scheduled job webhook)
router.post('/capsule-unlock', async (req, res) => {
  try {
    const { userId, capsuleId } = req.body;
    
    if (!userId || !capsuleId) {
      return res.status(400).json({ error: 'Missing userId or capsuleId' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if capsule is ready to unlock
    const unlockedCapsules = await checkUnlockableCapsules(userId);
    const targetCapsule = unlockedCapsules.find(c => c.id === capsuleId);

    if (targetCapsule) {
      // Send unlock notification
      await sendCapsuleNotification(user.email, targetCapsule);
      
      // Send real-time notification via WebSocket
      const io = req.app.get('io');
      io.to(`user-${userId}`).emit('capsule-unlock', {
        capsuleId: capsuleId,
        capsuleName: targetCapsule.name,
        unlockDate: targetCapsule.unlock_date
      });

      logger.info(`Capsule unlock notification sent to user ${userId}`, {
        capsuleId: capsuleId
      });
    }

    res.status(200).json({ status: 'ok' });

  } catch (error) {
    logger.error('Capsule unlock webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;