// Update this file to contain configuration for your database
require('dotenv').config();

module.exports = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'memento_user',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'storyvault_dev'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './server/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './server/seeds'
    }
  },

  testing: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'memento_user',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_TEST_NAME || 'storyvault_test'
    },
    pool: {
      min: 1,
      max: 5
    },
    migrations: {
      directory: './server/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './server/seeds'
    }
  },

  staging: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL || {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './server/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './server/seeds'
    }
  },

  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL || {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 2,
      max: 20
    },
    migrations: {
      directory: './server/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './server/seeds'
    },
    acquireConnectionTimeout: 60000,
    asyncStackTraces: false
  }
};