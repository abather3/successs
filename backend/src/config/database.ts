import { Pool } from 'pg';
import { getSecureConfig } from './config';

// Support both DATABASE_URL and individual environment variables
const DATABASE_URL = process.env.DATABASE_URL;
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || 'escashop';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

// PostgreSQL configuration
console.log('Using PostgreSQL database');
console.log(`Database configuration: ${DB_HOST}:${DB_PORT}/${DB_NAME} (user: ${DB_USER})`);

// Create pool config object
let poolConfig: any;

if (DATABASE_URL) {
  console.log('Using DATABASE_URL for connection');
  poolConfig = {
    connectionString: DATABASE_URL,
    ssl: (DATABASE_URL?.includes('localhost') || DATABASE_URL?.includes('postgres:')) ? false : { rejectUnauthorized: false },
  };
} else {
  console.log('Using individual environment variables for connection');
  poolConfig = {
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: (DB_HOST?.includes('localhost') || DB_HOST === 'postgres') ? false : { rejectUnauthorized: false },
  };
}

// Add common pool settings
poolConfig.max = 20; // Maximum number of clients in the pool
poolConfig.idleTimeoutMillis = 30000; // Close idle clients after 30 seconds
poolConfig.connectionTimeoutMillis = 2000; // Return an error after 2 seconds if connection could not be established

const pgPool = new Pool(poolConfig);

const pool = pgPool;

const connectDatabase = async (): Promise<void> => {
  try {
    const client = await pgPool.connect();
    console.log('Database connection established');
    client.release();
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};

const initializeDatabase = async (): Promise<void> => {
  try {
    console.log('Database initialization skipped - handled by migration system.');
    return; // Skip initialization as it's handled by the migration system
  } catch (error) {
    console.error('Error initializing PostgreSQL database:', error);
    throw error;
  }
};

export { pool, connectDatabase, initializeDatabase };

// Graceful shutdown - only handle explicit shutdown signals
let isShuttingDown = false;

const gracefulShutdown = () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('Closing database connection pool...');
  pool.end(() => {
    console.log('Database connection pool closed');
    process.exit(0);
  });
};

// Only handle actual shutdown signals, not development reload signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGQUIT', gracefulShutdown);

// Handle Ctrl+C in production, but not in development with nodemon  
if (process.env.NODE_ENV === 'production') {
  process.on('SIGINT', gracefulShutdown);
}

export default pool;
