import sqlite3 from 'sqlite3';
import { Database } from 'sqlite';
declare let db: Database<sqlite3.Database, sqlite3.Statement> | null;
export declare const connectSQLiteDatabase: () => Promise<Database<sqlite3.Database, sqlite3.Statement>>;
export declare const initializeSQLiteDatabase: () => Promise<void>;
export declare const sqlitePool: {
    query: (text: string, params?: any[]) => Promise<{
        rows: any;
        rowCount: any;
    }>;
};
export { db };
//# sourceMappingURL=database-sqlite.d.ts.map