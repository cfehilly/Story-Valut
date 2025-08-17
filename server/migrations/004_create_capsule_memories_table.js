// Junction table for capsule-memory relationships
exports.up = function(knex) {
  return knex.schema.createTable('capsule_memories', function(table) {
    table.increments('id').primary();
    table.integer('capsule_id').unsigned().references('id').inTable('capsules').onDelete('CASCADE');
    table.integer('memory_id').unsigned().references('id').inTable('memories').onDelete('CASCADE');
    
    // Ordering and customization
    table.integer('sort_order').defaultTo(0);
    table.text('custom_note').nullable(); // User can add notes about why this memory is in the capsule
    
    // Timestamps
    table.timestamp('added_at').defaultTo(knex.fn.now());
    
    // Unique constraint to prevent duplicate memory-capsule pairs
    table.unique(['capsule_id', 'memory_id']);
    
    // Indexes
    table.index('capsule_id');
    table.index('memory_id');
    table.index(['capsule_id', 'sort_order']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('capsule_memories');
};