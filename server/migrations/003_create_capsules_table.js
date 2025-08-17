// Time capsules table migration
exports.up = function(knex) {
  return knex.schema.createTable('capsules', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    
    // Capsule information
    table.string('name').notNullable();
    table.text('description').nullable();
    table.text('message_to_future_self').nullable();
    
    // Unlock configuration
    table.timestamp('unlock_date').notNullable();
    table.boolean('is_locked').defaultTo(true);
    table.timestamp('unlocked_at').nullable();
    table.boolean('unlock_notification_sent').defaultTo(false);
    
    // Capsule settings
    table.boolean('auto_unlock').defaultTo(true);
    table.json('unlock_conditions').defaultTo('{}'); // Future: location-based, etc.
    table.string('capsule_color').defaultTo('#D4A574');
    table.string('capsule_icon').defaultTo('📦');
    
    // Privacy settings
    table.boolean('is_public').defaultTo(false);
    table.boolean('allow_sharing').defaultTo(false);
    table.string('sharing_code').nullable(); // For sharing with specific people
    
    // Statistics
    table.integer('memory_count').defaultTo(0);
    table.integer('view_count').defaultTo(0);
    table.timestamp('last_viewed_at').nullable();
    
    // Metadata
    table.json('metadata').defaultTo('{}');
    table.text('search_text').nullable();
    
    // Audit
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    
    // Indexes
    table.index('user_id');
    table.index('unlock_date');
    table.index('is_locked');
    table.index('sharing_code');
    table.index('created_at');
    table.index(['user_id', 'is_locked']);
    table.index(['unlock_date', 'is_locked']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('capsules');
};