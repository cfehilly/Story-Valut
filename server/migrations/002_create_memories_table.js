// Memories table migration
exports.up = function(knex) {
  return knex.schema.createTable('memories', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    
    // Memory content
    table.string('title').notNullable();
    table.text('content').nullable();
    table.enu('type', ['photo', 'video', 'text', 'audio', 'social']).defaultTo('text');
    table.json('tags').defaultTo('[]');
    
    // Platform information
    table.string('platform').nullable(); // twitter, instagram, etc.
    table.string('platform_id').nullable(); // original post/item ID
    table.string('platform_url').nullable();
    
    // Media files
    table.json('media_urls').defaultTo('[]');
    table.json('thumbnail_urls').defaultTo('[]');
    
    // Dates
    table.timestamp('memory_date').notNullable(); // When the original content was created
    table.timestamp('imported_at').defaultTo(knex.fn.now()); // When it was imported to Memento
    
    // Metadata
    table.json('metadata').defaultTo('{}'); // Platform-specific data (likes, comments, etc.)
    table.boolean('is_favorite').defaultTo(false);
    table.boolean('is_public').defaultTo(false);
    
    // Search and discovery
    table.text('search_text').nullable(); // Full-text search content
    table.string('location').nullable();
    table.decimal('latitude', 10, 8).nullable();
    table.decimal('longitude', 11, 8).nullable();
    
    // Status
    table.boolean('is_processed').defaultTo(true);
    table.string('processing_status').nullable();
    table.text('processing_error').nullable();
    
    // Audit
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();
    
    // Indexes
    table.index('user_id');
    table.index('platform');
    table.index('type');
    table.index('memory_date');
    table.index('is_favorite');
    table.index(['platform', 'platform_id']);
    table.index('created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('memories');
};