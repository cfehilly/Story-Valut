// Payment Processing with Stripe
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { getUserById, updateUserSubscription } = require('../services/userService');
const { sendSubscriptionEmail } = require('../services/emailService');
const winston = require('winston');

const router = express.Router();
const logger = winston.createLogger({ /* logger config */ });

// Create Stripe customer
async function createStripeCustomer(user) {
  try {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.display_name,
      metadata: {
        userId: user.id.toString(),
        platform: 'memento'
      }
    });
    return customer;
  } catch (error) {
    logger.error('Failed to create Stripe customer:', error);
    throw error;
  }
}

// Get pricing configuration
router.get('/pricing', (req, res) => {
  const pricing = {
    monthly: {
      priceId: process.env.STRIPE_MONTHLY_PRICE_ID,
      amount: 499, // $4.99
      currency: 'usd',
      interval: 'month',
      trialDays: 7
    },
    yearly: {
      priceId: process.env.STRIPE_YEARLY_PRICE_ID,
      amount: 3999, // $39.99 (33% savings)
      currency: 'usd',
      interval: 'year',
      trialDays: 7
    }
  };
  
  res.json(pricing);
});

// Create checkout session
router.post('/create-checkout-session', 
  authenticateToken,
  [
    body('priceId').notEmpty().withMessage('Price ID is required'),
    body('planType').isIn(['monthly', 'yearly']).withMessage('Invalid plan type')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { priceId, planType } = req.body;
      const user = await getUserById(req.user.id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Create or get Stripe customer
      let customerId = user.stripe_customer_id;
      if (!customerId) {
        const customer = await createStripeCustomer(user);
        customerId = customer.id;
        // Update user with customer ID
        await updateUserSubscription(user.id, { stripeCustomerId: customerId });
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'subscription',
        allow_promotion_codes: true,
        subscription_data: {
          trial_period_days: 7,
          metadata: {
            userId: user.id.toString(),
            planType: planType
          }
        },
        success_url: `${process.env.CLIENT_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/subscription/cancelled`,
        metadata: {
          userId: user.id.toString(),
          planType: planType
        }
      });

      logger.info(`Checkout session created for user ${user.id}`, {
        sessionId: session.id,
        planType: planType
      });

      res.json({ sessionUrl: session.url });
    } catch (error) {
      logger.error('Checkout session creation failed:', error);
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  }
);

// Get subscription status
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    
    if (!user || !user.stripe_customer_id) {
      return res.json({ status: 'free', subscription: null });
    }

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      return res.json({ status: 'free', subscription: null });
    }

    const subscription = subscriptions.data[0];
    const product = await stripe.products.retrieve(subscription.items.data[0].price.product);

    res.json({
      status: subscription.status === 'trialing' ? 'trial' : 'premium',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        planName: product.name,
        amount: subscription.items.data[0].price.unit_amount,
        currency: subscription.items.data[0].price.currency,
        interval: subscription.items.data[0].price.recurring.interval
      }
    });
  } catch (error) {
    logger.error('Failed to get subscription status:', error);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// Cancel subscription
router.post('/cancel-subscription', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    
    if (!user || !user.stripe_customer_id) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const subscription = subscriptions.data[0];
    
    // Cancel at period end (don't immediately revoke access)
    const cancelledSubscription = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true
    });

    logger.info(`Subscription cancelled for user ${user.id}`, {
      subscriptionId: subscription.id,
      cancelAtPeriodEnd: true
    });

    res.json({
      message: 'Subscription will be cancelled at the end of the current billing period',
      cancelAtPeriodEnd: new Date(cancelledSubscription.current_period_end * 1000)
    });
  } catch (error) {
    logger.error('Failed to cancel subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Reactivate subscription
router.post('/reactivate-subscription', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    
    if (!user || !user.stripe_customer_id) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const subscription = subscriptions.data[0];
    
    if (!subscription.cancel_at_period_end) {
      return res.status(400).json({ error: 'Subscription is not set to cancel' });
    }

    // Reactivate subscription
    const reactivatedSubscription = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: false
    });

    logger.info(`Subscription reactivated for user ${user.id}`, {
      subscriptionId: subscription.id
    });

    res.json({
      message: 'Subscription reactivated successfully',
      subscription: {
        status: reactivatedSubscription.status,
        currentPeriodEnd: new Date(reactivatedSubscription.current_period_end * 1000)
      }
    });
  } catch (error) {
    logger.error('Failed to reactivate subscription:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

// Create customer portal session
router.post('/create-portal-session', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    
    if (!user || !user.stripe_customer_id) {
      return res.status(404).json({ error: 'No customer found' });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.CLIENT_URL}/settings/billing`,
    });

    res.json({ portalUrl: portalSession.url });
  } catch (error) {
    logger.error('Failed to create portal session:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Apply promo code
router.post('/apply-promo-code', 
  authenticateToken,
  [body('promoCode').notEmpty().withMessage('Promo code is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { promoCode } = req.body;

      // Validate promo code
      const promotionCodes = await stripe.promotionCodes.list({
        code: promoCode,
        active: true,
        limit: 1
      });

      if (promotionCodes.data.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired promo code' });
      }

      const promotionCode = promotionCodes.data[0];
      const coupon = promotionCode.coupon;

      res.json({
        valid: true,
        discount: {
          type: coupon.percent_off ? 'percentage' : 'amount',
          value: coupon.percent_off || coupon.amount_off,
          duration: coupon.duration,
          description: coupon.name
        }
      });
    } catch (error) {
      logger.error('Failed to apply promo code:', error);
      res.status(500).json({ error: 'Failed to validate promo code' });
    }
  }
);

module.exports = router;