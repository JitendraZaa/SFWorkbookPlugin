/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { execSync } from 'node:child_process';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf_workbook', 'jz.logdelete');

export type LogDeleteResult = {
  totalLogsFound: number;
  logsDeleted: number;
  logsFailed: number;
  deletedLogIds: string[];
  failedLogIds: string[];
};

type CliLogRecord = {
  Id: string;
  LogUser?: {
    Name: string;
    Username?: string;
  };
  Operation?: string;
  Status?: string;
  DurationMilliseconds?: number;
  LogLength?: number;
  StartTime?: string;
};

export default class LogDelete extends SfCommand<LogDeleteResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'confirm': Flags.boolean({
      char: 'c',
      summary: messages.getMessage('flags.confirm.summary'),
      description: messages.getMessage('flags.confirm.description'),
      default: false,
    }),
    'dry-run': Flags.boolean({
      char: 'd',
      summary: messages.getMessage('flags.dry-run.summary'),
      description: messages.getMessage('flags.dry-run.description'),
      default: false,
    }),
    'batch-size': Flags.integer({
      char: 'b',
      summary: messages.getMessage('flags.batch-size.summary'),
      description: messages.getMessage('flags.batch-size.description'),
      default: 10,
      min: 1,
      max: 50,
    }),
  };

  private static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async run(): Promise<LogDeleteResult> {
    const { flags } = await this.parse(LogDelete);
    const orgAlias = flags['target-org'].getUsername() ?? 'default';
    const orgId = flags['target-org'].getOrgId();
    const isDryRun = flags['dry-run'];
    const confirmDelete = flags['confirm'];
    const batchSize = flags['batch-size'];

    this.log(`Fetching debug logs from org: ${orgAlias} (${orgId})`);

    // Step 1: Get list of logs using SF CLI
    const logListResult = this.getLogList(orgAlias);

    if (!logListResult || logListResult.length === 0) {
      this.log('No debug logs found in the org.');
      return {
        totalLogsFound: 0,
        logsDeleted: 0,
        logsFailed: 0,
        deletedLogIds: [],
        failedLogIds: [],
      };
    }

    this.log('================================');
    this.log(`Found ${logListResult.length} debug logs`);
    this.log('================================');

    // Display summary of logs to be deleted
    this.displayLogSummary(logListResult);

    // Step 2: Handle dry-run mode
    if (isDryRun) {
      this.log('================================');
      this.log('🔍 DRY RUN MODE - No logs will be deleted');
      this.log(`Would delete ${logListResult.length} debug logs`);
      this.log('Use --confirm flag to actually delete the logs');
      this.log('================================');

      return {
        totalLogsFound: logListResult.length,
        logsDeleted: 0,
        logsFailed: 0,
        deletedLogIds: [],
        failedLogIds: [],
      };
    }

    // Step 3: Require confirmation for actual deletion
    if (!confirmDelete) {
      this.log('================================');
      this.log('⚠️  CONFIRMATION REQUIRED');
      this.log(`This will permanently delete ${logListResult.length} debug logs from the org.`);
      this.log('Use --confirm flag to proceed with deletion, or --dry-run to preview.');
      this.log('================================');

      return {
        totalLogsFound: logListResult.length,
        logsDeleted: 0,
        logsFailed: 0,
        deletedLogIds: [],
        failedLogIds: [],
      };
    }

    // Step 4: Delete logs in batches
    this.log('================================');
    this.log(`🗑️  Starting deletion of ${logListResult.length} debug logs in batches of ${batchSize}...`);
    this.log('================================');

    const result = await this.deleteLogs(logListResult, orgAlias, batchSize);

    // Step 5: Display final results
    this.log('================================');
    this.log('🎉 Deletion completed!');
    this.log('📊 Results:');
    this.log(`   ✅ Successfully deleted: ${result.logsDeleted}`);
    this.log(`   ❌ Failed to delete: ${result.logsFailed}`);
    this.log(`   📈 Total processed: ${result.totalLogsFound}`);

    if (result.failedLogIds.length > 0) {
      this.log(`   🔴 Failed log IDs: ${result.failedLogIds.join(', ')}`);
    }

    this.log('================================');

    return result;
  }

  private getLogList(orgAlias: string): CliLogRecord[] {
    try {
      this.log(`Getting log list using SF CLI for org: ${orgAlias}`);
      const command = `sf apex list log --target-org ${orgAlias} --json`;
      const output = execSync(command, { encoding: 'utf8' });
      const result = JSON.parse(output) as { status: number; result: CliLogRecord[] };

      if (result.status === 0 && result.result) {
        this.log(`Found ${result.result.length} logs via SF CLI`);
        return result.result;
      } else {
        this.log('No logs found via SF CLI');
        return [];
      }
    } catch (error) {
      this.log(`Failed to get log list: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private displayLogSummary(logs: CliLogRecord[]): void {
    // Group logs by user for summary
    const userSummary = new Map<string, number>();
    const statusSummary = new Map<string, number>();
    let totalSize = 0;

    for (const log of logs) {
      const userName = log.LogUser?.Name ?? 'Unknown';
      const status = log.Status ?? 'Unknown';
      const size = log.LogLength ?? 0;

      userSummary.set(userName, (userSummary.get(userName) ?? 0) + 1);
      statusSummary.set(status, (statusSummary.get(status) ?? 0) + 1);
      totalSize += size;
    }

    this.log('📋 Log Summary:');
    this.log(`   📊 Total logs: ${logs.length}`);
    this.log(`   💾 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    this.log('   👥 Logs by user:');
    for (const [user, count] of Array.from(userSummary.entries()).sort((a, b) => b[1] - a[1])) {
      this.log(`      ${user}: ${count} logs`);
    }

    this.log('   📈 Logs by status:');
    for (const [status, count] of Array.from(statusSummary.entries()).sort((a, b) => b[1] - a[1])) {
      this.log(`      ${status}: ${count} logs`);
    }
  }

  private async deleteLogs(
    logs: CliLogRecord[],
    orgAlias: string,
    batchSize: number
  ): Promise<LogDeleteResult> {
    const deletedLogIds: string[] = [];
    const failedLogIds: string[] = [];
    let processedCount = 0;

    // Split logs into batches
    const batches = [];
    for (let i = 0; i < logs.length; i += batchSize) {
      batches.push(logs.slice(i, i + batchSize));
    }

    this.log(`Processing ${logs.length} logs in ${batches.length} batches of ${batchSize}...`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchStartTime = Date.now();

      this.log(`🗑️  Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} logs)...`);

      // Process each log in the current batch
      for (const log of batch) {
        processedCount++;
        const progressPercent = Math.round((processedCount / logs.length) * 100);

        try {
          this.log(`Deleting log ${processedCount}/${logs.length} (${progressPercent}%): ${log.Id}`);

          const success = this.deleteSingleLog(orgAlias, log.Id);

          if (success) {
            deletedLogIds.push(log.Id);
            this.log(`✅ Deleted: ${log.Id}`);
          } else {
            failedLogIds.push(log.Id);
            this.log(`❌ Failed: ${log.Id}`);
          }

          // Small delay between individual deletions to avoid overwhelming the API
          // Note: Using synchronous delay to avoid await in loop linting error

        } catch (error) {
          failedLogIds.push(log.Id);
          this.log(`💥 Error deleting ${log.Id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const batchDuration = Math.round((Date.now() - batchStartTime) / 1000);
      const remaining = logs.length - processedCount;

      this.log(`📊 Batch ${batchIndex + 1}/${batches.length} completed in ${batchDuration}s`);
      this.log(`📈 Progress: ✅ Deleted: ${deletedLogIds.length}, ❌ Failed: ${failedLogIds.length}, ⏳ Remaining: ${remaining}`);

      // Longer delay between batches to be respectful to the API
      if (batchIndex < batches.length - 1) {
        this.log('⏸️  Pausing between batches...');
        // eslint-disable-next-line no-await-in-loop
        await LogDelete.sleep(1000);
      }
    }

    return {
      totalLogsFound: logs.length,
      logsDeleted: deletedLogIds.length,
      logsFailed: failedLogIds.length,
      deletedLogIds,
      failedLogIds,
    };
  }

  private deleteSingleLog(orgAlias: string, logId: string): boolean {
    try {
      const command = `sf data delete record --use-tooling-api --sobject ApexLog --record-id ${logId} --target-org ${orgAlias} --json`;

      const output = execSync(command, {
        encoding: 'utf8',
        timeout: 30_000, // 30 second timeout per deletion
      });

      const result = JSON.parse(output) as { status: number };
      return result.status === 0;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`Failed to delete log ${logId}: ${errorMsg}`);
      return false;
    }
  }

} 