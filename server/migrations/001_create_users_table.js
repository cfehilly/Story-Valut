// Users table migration
exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.increments('id').primary();
    table.string('email').unique().notNullable();
    table.string('password_hash').nullable(); // Nullable for OAuth-only users
    table.string('display_name').notNullable();
    table.string('profile_image_url').nullable();
    table.enu('plan_type', ['free', 'trial', 'premium']).defaultTo('free');
    table.boolean('email_verified').defaultTo(false);
    
    // Subscription info
    table.string('stripe_customer_id').nullable();
    table.string('stripe_subscription_id').nullable();
    table.string('subscription_status').nullable();
    table.timestamp('current_period_start').nullable();
    table.timestamp('current_period_end').nullable();
    table.timestamp('trial_end_date').nullable();
    table.boolean('cancel_at_period_end').defaultTo(false);
    
    // Platform connections (JSON column)
    table.json('connected_platforms').defaultTo('{}');
    table.json('platform_tokens').defaultTo('{}'); // Encrypted tokens
    
    // Activity tracking
    table.timestamp('last_login_at').nullable();
    table.timestamp('last_sync_at').nullable();
    table.string('last_ip').nullable();
    
    // Preferences
    table.json('preferences').defaultTo('{}');
    table.boolean('email_notifications').defaultTo(true);
    table.boolean('push_notifications').defaultTo(true);
    
    // Metadata
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    
    // Indexes
    table.index('email');
    table.index('stripe_customer_id');
    table.index('plan_type');
    table.index('created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('users');
};