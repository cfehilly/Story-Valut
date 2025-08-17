exports.up = function(knex) {
  return knex.schema.createTable('social_connections', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('platform', 50).notNullable(); // twitter, facebook, instagram, etc.
    table.string('platform_user_id').notNullable();
    table.string('platform_username');
    table.text('access_token');
    table.text('refresh_token');
    table.timestamp('token_expires_at');
    table.jsonb('platform_data').defaultTo('{}'); // Store platform-specific user info
    table.string('status', 20).defaultTo('connected'); // connected, disconnected, error
    table.timestamp('connected_at').defaultTo(knex.fn.now());
    table.timestamp('last_sync_at');
    table.string('last_sync_status', 20);
    table.text('last_sync_error');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('user_id');
    table.index('platform');
    table.index('status');
    table.index(['user_id', 'platform']);
    table.unique(['user_id', 'platform', 'platform_user_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('social_connections');
};