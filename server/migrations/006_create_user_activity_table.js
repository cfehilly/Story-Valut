exports.up = function(knex) {
  return knex.schema.createTable('user_activity', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('action', 100).notNullable(); // login, logout, create_memory, etc.
    table.jsonb('details').defaultTo('{}'); // Additional action details
    table.string('ip_address', 45); // IPv4 or IPv6
    table.text('user_agent');
    table.string('session_id');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('user_id');
    table.index('action');
    table.index('created_at');
    table.index(['user_id', 'created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('user_activity');
};