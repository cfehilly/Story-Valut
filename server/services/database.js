// Database configuration and initialization
const knex = require('knex');
const path = require('path');

const knexConfig = {
  client: 'postgresql',
  connection: process.env.DATABASE_URL || {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'memento_user',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'memento_db'
  },
  pool: {
    min: 2,
    max: 10,
    createTimeoutMillis: 3000,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
    propagateCreateError: false
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: path.join(__dirname, '../migrations')
  },
  seeds: {
    directory: path.join(__dirname, '../seeds')
  }
};

let db;

async function initializeDatabase() {
  try {
    db = knex(knexConfig);
    
    // Test connection
    await db.raw('SELECT 1');
    console.log('Database connection established');
    
    // Run migrations in production
    if (process.env.NODE_ENV === 'production') {
      await db.migrate.latest();
      console.log('Database migrations completed');
    }
    
    return db;
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return db;
}

// Close database connection
async function closeDatabase() {
  if (db) {
    await db.destroy();
    db = null;
    console.log('Database connection closed');
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  db: () => getDatabase() // Shorthand access
};