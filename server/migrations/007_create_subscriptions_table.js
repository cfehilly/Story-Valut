exports.up = function(knex) {
  return knex.schema.createTable('subscriptions', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('stripe_customer_id');
    table.string('stripe_subscription_id');
    table.string('stripe_price_id');
    table.string('status', 50).notNullable(); // active, canceled, past_due, etc.
    table.string('plan', 50).notNullable(); // free, premium, trial
    table.integer('trial_days_remaining').defaultTo(0);
    table.timestamp('trial_ends_at');
    table.timestamp('current_period_start');
    table.timestamp('current_period_end');
    table.boolean('cancel_at_period_end').defaultTo(false);
    table.timestamp('canceled_at');
    table.decimal('amount', 10, 2); // Monthly/yearly amount
    table.string('currency', 3).defaultTo('usd');
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('user_id');
    table.index('stripe_customer_id');
    table.index('stripe_subscription_id');
    table.index('status');
    table.index('plan');
    table.unique('user_id'); // One subscription per user
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('subscriptions');
};