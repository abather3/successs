declare class DockerMigrationRunner {
    private containerId;
    private lockAcquired;
    constructor();
    private acquireMigrationLock;
    private releaseMigrationLock;
    private calculateChecksum;
    private ensureBaseTables;
    private getMigrationFiles;
    private isMigrationApplied;
    private markMigrationAsApplied;
    private runSingleMigration;
    runMigrations(): Promise<void>;
    private waitForDatabase;
}
export { DockerMigrationRunner };
//# sourceMappingURL=docker-migrate.d.ts.map