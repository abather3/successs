import { Pool } from 'pg';
declare const pool: Pool;
declare const connectDatabase: () => Promise<void>;
declare const initializeDatabase: () => Promise<void>;
export { pool, connectDatabase, initializeDatabase };
export default pool;
//# sourceMappingURL=database.d.ts.map