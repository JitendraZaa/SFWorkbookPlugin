/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable @typescript-eslint/prefer-optional-chain */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

// Note: global.gc is available when Node.js is run with --expose-gc flag

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf_workbook', 'jz.log');

export type LogExportResult = {
  totalLogs: number;
  exportPath: string;
  htmlSummary: string;
};

interface ApexLogRecord {
  Id: string;
  LogUserId: string;
  LogUser: {
    Name: string;
    Username: string;
  };
  Operation: string;
  Status: string;
  DurationMilliseconds: number;
  LogLength: number;
  StartTime: string;
  Request: string;
}

interface LogSummaryData {
  user: string;
  username: string;
  operation: string;
  status: string;
  duration: number;
  logSize: number;
  time: string;
  fileName: string;
  filePath: string;
}

interface CliLogRecord {
  Id: string;
  LogUser?: {
    Name: string;
    attributes?: {
      type: string;
      url: string;
    };
  };
  Operation?: string;
  Status?: string;
  DurationMilliseconds?: number;
  LogLength?: number; // Changed from Size to LogLength to match actual response
  StartTime?: string;
}

export default class Log extends SfCommand<LogExportResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
  };

  private static generateHtmlContent(logData: LogSummaryData[], orgId: string): string {
    const tableRows = logData.map(log => {
      const logTime = new Date(log.time).toLocaleString();
      const logSizeKB = (log.logSize / 1024).toFixed(2);

      return `
        <tr>
          <td>${log.user}</td>
          <td>${log.operation}</td>
          <td>${log.status}</td>
          <td>${log.duration}</td>
          <td>${logSizeKB} KB</td>
          <td>${logTime}</td>
          <td><a href="${log.filePath}" target="_blank">${log.fileName}</a></td>
        </tr>
      `;
    }).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Salesforce Debug Logs Summary</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #f8f9fa;
            font-weight: bold;
            color: #333;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        tr:hover {
            background-color: #f5f5f5;
        }
        a {
            color: #0066cc;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .summary-info {
            background-color: #e9ecef;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .summary-info h3 {
            margin: 0 0 10px 0;
            color: #495057;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Salesforce Debug Logs Summary</h1>
        
        <div class="summary-info">
            <h3>Export Summary</h3>
            <p><strong>Total Logs:</strong> ${logData.length}</p>
            <p><strong>Export Date:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Total Size:</strong> ${(logData.reduce((sum, log) => sum + log.logSize, 0) / 1024).toFixed(2)} KB</p>
        </div>

        <div class="summary-info">
            <h3>🔍 Search Through Log Files</h3>
            <p>Use the following shell commands to search through all log files:</p>
            <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 10px; margin: 10px 0; font-family: 'Courier New', monospace;">
                <strong>Search for text:</strong><br>
                <code>grep -rn "search_term" Exports/Logs/${orgId}/ | sed '1s/^/\\n/; $!s/$/\\n/' </code>
            </div>
            <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 10px; margin: 10px 0; font-family: 'Courier New', monospace;">
                <strong>Case-insensitive search:</strong><br>
                <code>grep -rin "search_term" Exports/Logs/${orgId}/ | sed '1s/^/\\n/; $!s/$/\\n/' </code>
            </div>
            <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 10px; margin: 10px 0; font-family: 'Courier New', monospace;">
                <strong>Search with context (3 lines before/after):</strong><br>
                <code>grep -rnC 3 "search_term" Exports/Logs/${orgId}/ | sed '1s/^/\\n/; $!s/$/\\n/' </code>
            </div>
            <p><strong>Options explained:</strong></p>
            <ul>
                <li><code>-r</code>: Search recursively through all subdirectories</li>
                <li><code>-n</code>: Show line numbers in results</li>
                <li><code>-i</code>: Case-insensitive search</li>
                <li><code>-C 3</code>: Show 3 lines of context before and after matches</li>
            </ul>
        </div>

        <table>
            <thead>
                <tr>
                    <th>User</th>
                    <th>Operation</th>
                    <th>Status</th>
                    <th>Duration (ms)</th>
                    <th>Log Size</th>
                    <th>Time</th>
                    <th>Link</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    </div>
</body>
</html>
    `;
  }

  public async run(): Promise<LogExportResult> {
    const { flags } = await this.parse(Log);
    const orgAlias = flags['target-org'].getUsername() ?? 'default';
    const orgId = flags['target-org'].getOrgId();
    const orgIdString = String(orgId);

    this.log(`Fetching debug logs from org: ${orgAlias} (${orgIdString})`);

    // Step 1: Get list of logs using SF CLI
    const logListResult = this.getLogList(orgAlias);

    if (!logListResult || logListResult.length === 0) {
      this.log('No debug logs found in the org.');
      return { totalLogs: 0, exportPath: '', htmlSummary: '' };
    }

    this.log('================================');
    this.log(`Found ${logListResult.length} debug logs`);
    this.log('================================');

    // Setup export directory
    const exportBaseDir = Log.setupExportDirectory(orgIdString);

    // Create fail log file for tracking failed downloads
    const failLogPath = Log.createFailLogFile(orgIdString);
    this.log(`📝 Created fail log file: ${path.basename(failLogPath)}`);

    try {
      // Process all logs
      const { logSummaryData, successCount } = await this.processLogs(
        logListResult,
        orgAlias,
        exportBaseDir,
        flags['target-org'].getConnection(),
        failLogPath
      );

      // Retry failed logs
      const retryCount = await this.retryFailedLogs(
        logListResult,
        orgAlias,
        exportBaseDir,
        flags['target-org'].getConnection(),
        failLogPath,
        logSummaryData
      );

      const finalSuccessCount = successCount + retryCount;
      this.log('================================');
      this.log(`📊 Final Summary - Initial success: ${successCount}, Retry success: ${retryCount}, Total success: ${finalSuccessCount}`);
      this.log('================================');

      // Generate HTML summary
      const htmlSummaryPath = this.generateHtmlSummary(exportBaseDir, logSummaryData, orgIdString);

      this.log(`Successfully exported ${finalSuccessCount} debug logs to ${exportBaseDir}`);
      this.log(`HTML summary generated: ${htmlSummaryPath}`);

      return {
        totalLogs: finalSuccessCount,
        exportPath: exportBaseDir,
        htmlSummary: htmlSummaryPath
      };
    } finally {
      // Always clean up temporary directory, even if there are errors
      Log.cleanupTempDirectory();
      this.log('🧹 Cleaned up temporary files');

      // Clean up empty fail log file
      Log.cleanupFailLogFile(failLogPath);
    }
  }

  private static setupExportDirectory(orgId: string): string {
    const exportBaseDir = path.join(process.cwd(), 'Exports', 'Logs', String(orgId));

    if (!fs.existsSync(exportBaseDir)) {
      fs.mkdirSync(exportBaseDir, { recursive: true });
    }

    return exportBaseDir;
  }

  // eslint-disable-next-line complexity
  private async processLogs(
    logListResult: CliLogRecord[],
    orgAlias: string,
    exportBaseDir: string,
    connection: unknown,
    failLogPath: string
  ): Promise<{ logSummaryData: LogSummaryData[]; successCount: number }> {
    const logSummaryData: LogSummaryData[] = [];
    let successCount = 0;
    let failedCount = 0;
    let existingCount = 0;

    // Configuration for parallel processing
    const BATCH_SIZE = 5; // Process 5 logs concurrently

    this.log('================================');
    this.log(`Processing logs in parallel batches of ${BATCH_SIZE}...`);
    this.log('================================');
    const processingStartTime = Date.now();

    // Split logs into batches
    const batches = [];
    for (let i = 0; i < logListResult.length; i += BATCH_SIZE) {
      batches.push(logListResult.slice(i, i + BATCH_SIZE));
    }

    this.log(`Created ${batches.length} batches for ${logListResult.length} logs`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchStartTime = Date.now();

      this.log('================================');
      this.log(`🚀 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} logs)`);
      this.log('================================');

      // Process all logs in the current batch concurrently
      const batchPromises = batch.map(async (cliLogRecord, indexInBatch) => {
        const globalIndex = batchIndex * BATCH_SIZE + indexInBatch;
        return this.processSingleLog(
          cliLogRecord,
          globalIndex,
          logListResult.length,
          orgAlias,
          exportBaseDir,
          connection,
          failLogPath
        );
      });

      // Wait for all logs in this batch to complete
      // eslint-disable-next-line no-await-in-loop
      const batchResults = await Promise.allSettled(batchPromises);

      // Process results and update counters
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          const { summary, success, existing, failed } = result.value;
          if (summary) {
            logSummaryData.push(summary);
          }
          if (success) successCount++;
          if (existing) existingCount++;
          if (failed) failedCount++;
        } else {
          failedCount++;
          this.log(`💥 Batch processing error: ${result.reason}`);
        }
      }

      const batchDuration = Math.round((Date.now() - batchStartTime) / 1000);
      const totalElapsed = Math.round((Date.now() - processingStartTime) / 1000);
      const remaining = logListResult.length - ((batchIndex + 1) * BATCH_SIZE);

      this.log('================================');
      this.log(`📊 Batch ${batchIndex + 1}/${batches.length} completed in ${batchDuration}s`);
      this.log(`📈 Status: ✅ Existing: ${existingCount}, 🆕 Downloaded: ${successCount}, ❌ Failed: ${failedCount}, ⏳ Remaining: ${Math.max(0, remaining)}`);
      this.log(`⏱️  Total time elapsed: ${totalElapsed}s`);
      this.log('================================');

      // Trigger garbage collection if available (no pause between batches)
      if (batchIndex < batches.length - 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((global as any).gc) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (global as any).gc();
          this.log('🗑️ Garbage collection triggered');
        }

        // Log system resources periodically
        if ((batchIndex + 1) % 3 === 0) {
          Log.logSystemResources();
        }
      }
    }

    this.log('================================');
    this.log('🎉 Parallel processing completed!');
    this.log('📊 Final Results:');
    this.log(`   ✅ Files already existed: ${existingCount} (skipped download)`);
    this.log(`   🆕 Files downloaded: ${successCount}`);
    this.log(`   ❌ Files failed: ${failedCount}`);
    this.log(`   📁 Total files processed: ${existingCount + successCount + failedCount}`);
    this.log('================================');
    return { logSummaryData, successCount };
  }

  private async processSingleLog(
    cliLogRecord: CliLogRecord,
    globalIndex: number,
    totalLogs: number,
    orgAlias: string,
    exportBaseDir: string,
    connection: unknown,
    failLogPath: string
  ): Promise<{ summary?: LogSummaryData; success: boolean; existing: boolean; failed: boolean }> {
    try {
      const progressPercent = Math.round(((globalIndex + 1) / totalLogs) * 100);

      this.log(`Processing log ${globalIndex + 1}/${totalLogs} (${progressPercent}%): ${cliLogRecord.Id}`);

      // First do a quick check if file might already exist using basic info
      // This avoids unnecessary metadata fetches for existing files
      const basicUsername = String(cliLogRecord.LogUser?.Name ?? 'Unknown');
      const basicDate = new Date(cliLogRecord.StartTime ?? new Date());
      const basicDateStr = `${String(basicDate.getMonth() + 1).padStart(2, '0')}-${String(basicDate.getDate()).padStart(2, '0')}-${String(basicDate.getFullYear()).slice(-2)}`;
      const basicFileName = `${String(cliLogRecord.Id)}.log`;

      const basicFilePath = path.join(String(exportBaseDir), basicDateStr, basicUsername, basicFileName);

      // Quick existence check to avoid metadata fetch if file already exists
      if (fs.existsSync(basicFilePath)) {
        this.log(`✅ File already exists: ${basicFileName} - skipping metadata fetch`);

        // Still get metadata for complete summary data, but we know file exists
        const metadata = await this.getIndividualLogMetadata(connection, cliLogRecord.Id);
        const username = String(metadata?.LogUser?.Username ?? metadata?.LogUser?.Name ?? basicUsername);
        const logDate = new Date(metadata?.StartTime ?? cliLogRecord.StartTime ?? new Date());
        const dateStr = `${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}-${String(logDate.getFullYear()).slice(-2)}`;

        const summary: LogSummaryData = {
          user: String(metadata?.LogUser?.Name ?? basicUsername),
          username,
          operation: String(metadata?.Operation ?? cliLogRecord.Operation ?? 'Unknown'),
          status: String(metadata?.Status ?? cliLogRecord.Status ?? 'Unknown'),
          duration: Number(metadata?.DurationMilliseconds ?? cliLogRecord.DurationMilliseconds ?? 0),
          logSize: Number(metadata?.LogLength ?? cliLogRecord.LogLength ?? 0),
          time: String(metadata?.StartTime ?? cliLogRecord.StartTime ?? new Date().toISOString()),
          fileName: basicFileName,
          filePath: path.join(String(dateStr), String(username), String(basicFileName))
        };

        return { summary, success: false, existing: true, failed: false };
      }

      // File doesn't exist, proceed with full metadata fetch and download
      this.log(`📥 Downloading log ${globalIndex + 1}/${totalLogs} (${progressPercent}%): ${cliLogRecord.Id}`);

      // Fetch metadata
      let metadata: ApexLogRecord | null = null;
      try {
        metadata = await this.getIndividualLogMetadata(connection, cliLogRecord.Id);
        if (!metadata) {
          this.log(`⚠️ No metadata found for log ${cliLogRecord.Id} - using CLI data`);
        }
      } catch (metadataError) {
        this.log(`💥 Metadata fetch failed for ${cliLogRecord.Id}: ${metadataError instanceof Error ? metadataError.message : String(metadataError)}`);
        // Continue with CLI data only
      }

      // Small delay after metadata fetch to prevent overwhelming API
      // eslint-disable-next-line no-await-in-loop
      await Log.sleep(50); // Reduced from 100ms since we're doing parallel processing

      // Create date and user directory based on log's creation date
      const username = String(metadata?.LogUser?.Username ?? metadata?.LogUser?.Name ?? basicUsername);

      // Extract date from log's StartTime
      const logDate = new Date(metadata?.StartTime ?? cliLogRecord.StartTime ?? new Date());
      const dateStr = `${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}-${String(logDate.getFullYear()).slice(-2)}`;

      this.log(`📁 Creating directory structure: ${dateStr}/${username}`);
      const userDir = path.join(String(exportBaseDir), String(dateStr), String(username));

      try {
        if (!fs.existsSync(userDir)) {
          fs.mkdirSync(userDir, { recursive: true });
          this.log(`✅ Created directory: ${userDir}`);
        } else {
          this.log(`📁 Directory exists: ${userDir}`);
        }
      } catch (dirError) {
        this.log(`💥 Failed to create directory ${userDir}: ${dirError instanceof Error ? dirError.message : String(dirError)}`);
        throw dirError;
      }

      // Create filename with log ID
      const fileName = `${String(cliLogRecord.Id)}.log`;
      const filePath = path.join(userDir, fileName);
      this.log(`📄 Target file path: ${filePath}`);

      // Double-check if file exists with accurate path (in case username differs)
      if (fs.existsSync(filePath)) {
        this.log(`✅ File exists with accurate path: ${fileName} - skipping download`);

        const summary: LogSummaryData = {
          user: String(metadata?.LogUser?.Name ?? basicUsername),
          username,
          operation: String(metadata?.Operation ?? cliLogRecord.Operation ?? 'Unknown'),
          status: String(metadata?.Status ?? cliLogRecord.Status ?? 'Unknown'),
          duration: Number(metadata?.DurationMilliseconds ?? cliLogRecord.DurationMilliseconds ?? 0),
          logSize: Number(metadata?.LogLength ?? cliLogRecord.LogLength ?? 0),
          time: String(metadata?.StartTime ?? cliLogRecord.StartTime ?? new Date().toISOString()),
          fileName,
          filePath: path.join(dateStr, username, fileName)
        };

        return { summary, success: false, existing: true, failed: false };
      }

      // Log the size of large logs for visibility
      const isLargeLog = metadata?.LogLength && metadata.LogLength > 10_485_760; // 10MB
      if (isLargeLog && metadata?.LogLength) {
        const sizeMB = Math.round(metadata.LogLength / 1024 / 1024);
        this.log(`🔶 Processing LARGE log ${cliLogRecord.Id} (${sizeMB}MB)`);
      }

      // Get log body using SF CLI with retry logic
      let logBody: string;
      try {
        this.log(`🔽 Starting download for ${cliLogRecord.Id}...`);
        logBody = await this.getLogBodyWithRetry(orgAlias, cliLogRecord.Id, metadata?.LogLength, failLogPath);
        this.log(`✅ Download completed for ${cliLogRecord.Id}`);
      } catch (downloadError) {
        this.log(`💥 Download failed for ${cliLogRecord.Id}: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`);
        logBody = `ERROR: Unable to retrieve log content for ${cliLogRecord.Id}\nReason: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`;
      }

      // Write log file
      const logContent = logBody?.trim() ?? 'No log content available';
      try {
        this.log(`💾 Writing file: ${fileName} (${logContent.length} characters)`);
        fs.writeFileSync(filePath, logContent, 'utf8');
        this.log(`✅ File written successfully: ${fileName}`);
      } catch (writeError) {
        this.log(`💥 Failed to write file ${fileName}: ${writeError instanceof Error ? writeError.message : String(writeError)}`);
        throw writeError;
      }

      // Create summary data
      const summary: LogSummaryData = {
        user: String(metadata?.LogUser?.Name ?? cliLogRecord.LogUser?.Name ?? 'Unknown'),
        username,
        operation: String(metadata?.Operation ?? cliLogRecord.Operation ?? 'Unknown'),
        status: String(metadata?.Status ?? cliLogRecord.Status ?? 'Unknown'),
        duration: Number(metadata?.DurationMilliseconds ?? cliLogRecord.DurationMilliseconds ?? 0),
        logSize: Number(metadata?.LogLength ?? cliLogRecord.LogLength ?? 0),
        time: String(metadata?.StartTime ?? cliLogRecord.StartTime ?? new Date().toISOString()),
        fileName,
        filePath: path.join(String(dateStr), String(username), String(fileName))
      };

      // Check if export was successful
      if (!logContent.includes('ERROR: Unable to retrieve log content')) {
        this.log(`✅ Exported: ${fileName}`);
        return { summary, success: true, existing: false, failed: false };
      } else {
        this.log(`❌ Created error file: ${fileName}`);
        return { summary, success: false, existing: false, failed: true };
      }

    } catch (error) {
      this.log(`💥 Failed to export log ${cliLogRecord.Id}: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, existing: false, failed: true };
    }
  }

  private async retryFailedLogs(
    logListResult: CliLogRecord[],
    orgAlias: string,
    exportBaseDir: string,
    connection: unknown,
    failLogPath: string,
    logSummaryData: LogSummaryData[]
  ): Promise<number> {
    const failedLogIds = Log.getFailedLogs(failLogPath);

    if (failedLogIds.length === 0) {
      this.log('✅ No failed logs to retry');
      return 0;
    }

    this.log('================================');
    this.log(`🔄 Retrying ${failedLogIds.length} failed logs...`);
    this.log('================================');
    let retrySuccessCount = 0;

    for (let i = 0; i < failedLogIds.length; i++) {
      const logId = failedLogIds[i];

      // Find the original log record
      const originalLogRecord = logListResult.find(log => log.Id === logId);
      if (!originalLogRecord) {
        this.log(`⚠️ Original log record not found for ${logId}, skipping...`);
        continue;
      }

      try {
        this.log(`🔄 Retry ${i + 1}/${failedLogIds.length}: ${logId}`);

        // Get metadata for this log
        // eslint-disable-next-line no-await-in-loop
        const metadata = await this.getIndividualLogMetadata(connection, logId);



        // Create date and user directory based on log's creation date
        const username = String(metadata?.LogUser?.Username ?? metadata?.LogUser?.Name ?? originalLogRecord.LogUser?.Name ?? 'Unknown');

        // Extract date from log's StartTime
        const logDate = new Date(metadata?.StartTime ?? originalLogRecord.StartTime ?? new Date());
        const dateStr = `${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}-${String(logDate.getFullYear()).slice(-2)}`;

        const userDir = path.join(String(exportBaseDir), dateStr, username);

        if (!fs.existsSync(userDir)) {
          fs.mkdirSync(userDir, { recursive: true });
        }

        // Create filename with log ID
        const fileName = `${String(logId)}.log`;
        const filePath = path.join(userDir, fileName);

        // Skip if file already exists and is not an error file
        if (fs.existsSync(filePath)) {
          const existingContent = fs.readFileSync(filePath, 'utf8');
          if (!existingContent.includes('ERROR: Unable to retrieve log content')) {
            this.log(`✅ ${fileName} already exists and is valid, removing from fail log`);
            Log.removeFromFailLog(failLogPath, logId);
            retrySuccessCount++;
            continue;
          }
        }

        // Retry getting log body (without adding to fail log again)
        // eslint-disable-next-line no-await-in-loop
        const logBody = await this.getLogBodyWithRetry(orgAlias, logId, metadata?.LogLength);

        // Write log file
        const logContent = logBody?.trim() ?? 'No log content available';
        fs.writeFileSync(filePath, logContent, 'utf8');

        // Check if retry was successful
        if (!logContent.includes('ERROR: Unable to retrieve log content')) {
          this.log(`✅ Retry success: ${fileName}`);
          retrySuccessCount++;

          // Remove from fail log
          Log.removeFromFailLog(failLogPath, logId);

          // Add or update summary data
          const existingSummaryIndex = logSummaryData.findIndex(item => item.fileName === fileName);
          const summaryItem = {
            user: String(metadata?.LogUser?.Name ?? originalLogRecord.LogUser?.Name ?? 'Unknown'),
            username,
            operation: String(metadata?.Operation ?? originalLogRecord.Operation ?? 'Unknown'),
            status: String(metadata?.Status ?? originalLogRecord.Status ?? 'Unknown'),
            duration: Number(metadata?.DurationMilliseconds ?? originalLogRecord.DurationMilliseconds ?? 0),
            logSize: Number(metadata?.LogLength ?? originalLogRecord.LogLength ?? 0),
            time: String(metadata?.StartTime ?? originalLogRecord.StartTime ?? new Date().toISOString()),
            fileName,
            filePath: path.join(String(dateStr), String(username), String(fileName))
          };

          if (existingSummaryIndex >= 0) {
            logSummaryData[existingSummaryIndex] = summaryItem;
          } else {
            logSummaryData.push(summaryItem);
          }
        } else {
          this.log(`❌ Retry failed: ${fileName}`);
        }



      } catch (error) {
        this.log(`💥 Retry error for ${logId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.log('================================');
    this.log(`🔄 Retry phase completed: ${retrySuccessCount}/${failedLogIds.length} successful`);
    this.log('================================');
    return retrySuccessCount;
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

  private async getIndividualLogMetadata(connection: unknown, logId: string): Promise<ApexLogRecord | null> {
    try {
      const soqlQuery = `
        SELECT Id, LogUserId, LogUser.Name, LogUser.Username, Operation, Status, 
               DurationMilliseconds, LogLength, StartTime, Request
        FROM ApexLog 
        WHERE Id = '${logId}'
      `;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (connection as any).query(soqlQuery);

      if (result.records && result.records.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return result.records[0] as ApexLogRecord;
      } else {
        this.log(`No metadata found for log ${logId}`);
        return null;
      }

    } catch (error) {
      this.log(`Failed to get metadata for log ${logId}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private getLogBody(orgAlias: string, logId: string): string {
    this.log(`Getting log body for ${logId} using SF CLI`);

    // Use temporary directory approach to avoid stdout buffer issues
    const tempDir = path.join(process.cwd(), 'temp_logs');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Use SF CLI output-dir option to write directly to file (avoids stdout buffer issues)
    const command = `sf apex get log --log-id ${logId} --target-org ${orgAlias} --output-dir ${tempDir}`;
    this.log(`🔧 Executing: ${command}`);

    try {

      // Show current memory before executing command for large files
      const memBefore = process.memoryUsage();
      this.log(`🧠 Memory before execution: ${Math.round(memBefore.heapUsed / 1024 / 1024)}MB heap, ${Math.round(memBefore.rss / 1024 / 1024)}MB RSS`);

      // Execute command with proper error handling
      execSync(command, {
        encoding: 'utf8',
        maxBuffer: 100 * 1024 * 1024, // 100MB buffer (reduced from 500MB)
        timeout: 300000, // 5 minute timeout (reduced from 10 minutes)
        cwd: process.cwd(), // Explicitly set working directory
        env: {
          ...process.env,
          SF_LOG_LEVEL: 'warn', // Changed from 'error' to 'warn' for better debugging
          SF_DISABLE_TELEMETRY: 'true' // Disable telemetry for cleaner execution
        }
      });

      this.log(`✅ Command executed successfully for ${logId}`);

      // Show memory after execution
      const memAfter = process.memoryUsage();
      this.log(`🧠 Memory after execution: ${Math.round(memAfter.heapUsed / 1024 / 1024)}MB heap, ${Math.round(memAfter.rss / 1024 / 1024)}MB RSS`);

      // Find the generated file (SF CLI might use different naming conventions)
      const tempFiles = fs.readdirSync(tempDir);
      this.log(`📂 Files created in temp dir: ${tempFiles.join(', ')}`);

      // Look for the log file - try multiple naming patterns
      const possibleNames = [
        `${logId}.log`,           // Standard pattern
        `${logId}.txt`,           // Alternative extension
        logId,                    // Just the ID
        `log-${logId}.log`,       // Prefixed pattern
        tempFiles.find(f => f.includes(logId)) // Any file containing the logId
      ].filter(Boolean);

      let logFilePath: string | null = null;
      let actualFileName: string | null = null;

      for (const fileName of possibleNames) {
        const filePath = path.join(String(tempDir), String(fileName));
        if (fs.existsSync(filePath)) {
          logFilePath = filePath;
          actualFileName = String(fileName);
          break;
        }
      }

      if (logFilePath && actualFileName) {
        const fileStats = fs.statSync(logFilePath);
        this.log(`📁 File found: ${actualFileName}, size: ${Math.round(fileStats.size / 1024)}KB`);

        const logContent = fs.readFileSync(logFilePath, 'utf8');

        // Clean up temp file immediately
        fs.unlinkSync(logFilePath);

        if (logContent && logContent.trim()) {
          // Strip ANSI escape codes (terminal colors/formatting)
          const cleanedContent = Log.stripAnsiCodes(logContent);
          this.log(`✅ Retrieved log body for ${logId} (${cleanedContent.length} characters)`);
          return cleanedContent;
        } else {
          this.log(`⚠️ Empty log content for ${logId}`);
          return 'Log content is empty';
        }
      } else {
        this.log(`❌ No log file found for ${logId}. Available files: ${tempFiles.join(', ')}`);
        throw new Error(`No log file found for ${logId} in temp directory. Available files: ${tempFiles.join(', ')}`);
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Log more detailed error information for debugging
      this.log(`💥 Error retrieving log ${logId}:`);
      this.log(`   Command: ${command}`);
      this.log(`   Error: ${errorMsg}`);

      // Check if it's an execSync error with more details
      if (error && typeof error === 'object' && 'status' in error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const execError = error as any;
        this.log(`   Exit code: ${execError.status || 'unknown'}`);
        this.log(`   Signal: ${execError.signal || 'none'}`);
        if (execError.stderr) {
          this.log(`   Stderr: ${execError.stderr}`);
        }
        if (execError.stdout) {
          this.log(`   Stdout: ${execError.stdout}`);
        }
      }

      // Clean up temp directory on error
      try {
        if (fs.existsSync(tempDir)) {
          const files = fs.readdirSync(tempDir);
          this.log(`🧹 Cleaning up ${files.length} temp files after error`);
          for (const file of files) {
            fs.unlinkSync(path.join(String(tempDir), String(file)));
          }
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  private async getLogBodyWithRetry(orgAlias: string, logId: string, logSize?: number, failLogPath?: string): Promise<string> {
    const maxRetries = 10; // Increased from 5 to 10 attempts
    const baseDelay = 2000;

    // Increase retry delays for large logs (>5MB)
    const isLargeLog = logSize && logSize > 5_242_880; // 5MB
    const delayMultiplier = isLargeLog ? 2 : 1; // Double delays for large logs

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          this.log(`🔄 Retry attempt ${attempt}/${maxRetries} for log ${logId}${isLargeLog ? ' (large log)' : ''}`);
        }

        const result = this.getLogBody(orgAlias, logId);

        // Check if the result contains an error message (shouldn't happen now, but defensive)
        if (result.includes('ERROR: Unable to retrieve log content')) {
          throw new Error(`Log retrieval returned error: ${result}`);
        }

        if (attempt > 1) {
          this.log(`✅ Successfully retrieved log ${logId} on attempt ${attempt}`);
        }
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.log(`❌ Attempt ${attempt}/${maxRetries} failed for ${logId}: ${errorMsg}`);

        // Check for various error conditions that warrant retry
        const isRetryableError = errorMsg.includes('ENOBUFS') ||
          errorMsg.includes('EMFILE') ||
          errorMsg.includes('ENOMEM') ||
          errorMsg.includes('EAGAIN') ||
          errorMsg.includes('ENOTCONN') ||
          errorMsg.includes('EEXIT') ||
          errorMsg.includes('ExitError') ||
          errorMsg.includes('Command failed') ||
          errorMsg.includes('Unable to retrieve log content') ||
          errorMsg.includes('ETIMEDOUT') ||
          errorMsg.includes('ECONNRESET');

        if (attempt < maxRetries && isRetryableError) {
          // Special handling for ENOBUFS errors - much longer delays
          const isBufferError = errorMsg.includes('ENOBUFS') || errorMsg.includes('EMFILE') || errorMsg.includes('ENOMEM');
          let delay = (baseDelay * attempt * delayMultiplier) + Math.random() * 1000;

          if (isBufferError) {
            delay = delay * 3; // Triple the delay for buffer errors
            this.log(`🚨 Buffer error detected, using extended delay: ${Math.round(delay)}ms`);
          }

          this.log(`⏸️ Taking pause for ${Math.round(delay)}ms before retry attempt ${attempt + 1}...`);
          // eslint-disable-next-line no-await-in-loop
          await Log.sleep(delay);
          continue;
        }

        // If it's the last attempt or not a retryable error, create an error log file
        const errorContent = `ERROR: Unable to retrieve log content for ${logId}\nReason: ${errorMsg}\nAttempts: ${attempt}/${maxRetries}${logSize ? `\nLog Size: ${Math.round(logSize / 1024)}KB` : ''}`;
        this.log(`💀 Final failure for ${logId} after ${attempt} attempts: ${errorMsg}`);

        // Add to fail log for retry later
        if (failLogPath) {
          const sizeInfo = logSize ? ` (${Math.round(logSize / 1024 / 1024)}MB)` : '';
          Log.addToFailLog(failLogPath, logId, `${errorMsg}${sizeInfo}`);
          this.log(`📝 Added ${logId}${sizeInfo} to fail log for retry`);
        }

        return errorContent;
      }
    }

    // This should never be reached, but TypeScript needs it
    return `ERROR: Unable to retrieve log content for ${logId}\nReason: Maximum retry attempts exceeded`;
  }

  private static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static stripAnsiCodes(text: string): string {
    // Remove ANSI escape sequences (colors, formatting, etc.)
    // This regex matches ESC[ followed by any characters and ending with a letter
    // eslint-disable-next-line no-control-regex
    return text.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');
  }

  private static cleanupTempDirectory(): void {
    const tempDir = path.join(process.cwd(), 'temp_logs');
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          const filePath = path.join(String(tempDir), String(file));
          fs.unlinkSync(filePath);
        }
        fs.rmdirSync(tempDir);
      }
    } catch (error) {
      // Ignore cleanup errors - they're not critical
    }
  }

  private static createFailLogFile(orgId: string): string {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}_${String(now.getMinutes()).padStart(2, '0')}_${String(now.getSeconds()).padStart(2, '0')}`;

    // Create fail log file in the Logs directory organized by OrgId
    const logsDir = path.join(process.cwd(), 'Exports', 'Logs', String(orgId));
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const failLogPath = path.join(logsDir, `fail_${timeStr}.txt`);

    // Create empty fail log file
    fs.writeFileSync(failLogPath, '', 'utf8');
    return failLogPath;
  }

  private static addToFailLog(failLogPath: string, logId: string, errorMsg: string): void {
    try {
      const failEntry = `${logId}:${errorMsg}\n`;
      fs.appendFileSync(failLogPath, failEntry, 'utf8');
    } catch (error) {
      // Ignore fail log write errors
    }
  }

  private static getFailedLogs(failLogPath: string): string[] {
    try {
      if (!fs.existsSync(failLogPath)) {
        return [];
      }

      const content = fs.readFileSync(failLogPath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      return lines.map(line => line.split(':')[0]).filter(id => id.trim());
    } catch (error) {
      return [];
    }
  }

  private static removeFromFailLog(failLogPath: string, successfulLogId: string): void {
    try {
      if (!fs.existsSync(failLogPath)) {
        return;
      }

      const content = fs.readFileSync(failLogPath, 'utf8');
      const lines = content.split('\n');
      const filteredLines = lines.filter(line => {
        const logId = line.split(':')[0];
        return logId !== successfulLogId;
      });

      fs.writeFileSync(failLogPath, filteredLines.join('\n'), 'utf8');
    } catch (error) {
      // Ignore fail log update errors
    }
  }

  private static cleanupFailLogFile(failLogPath: string): void {
    try {
      if (!fs.existsSync(failLogPath)) {
        return;
      }

      const content = fs.readFileSync(failLogPath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      if (lines.length === 0) {
        // Delete empty fail log file
        fs.unlinkSync(failLogPath);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  private generateHtmlSummary(exportDir: string, logData: LogSummaryData[], orgId: string): string {
    // Find next available index for HTML file
    let htmlIndex = 1;
    let htmlFileName = `Index_${htmlIndex}.html`;
    let htmlPath = path.join(String(exportDir), String(htmlFileName));

    while (fs.existsSync(htmlPath)) {
      htmlIndex++;
      htmlFileName = `Index_${htmlIndex}.html`;
      htmlPath = path.join(String(exportDir), String(htmlFileName));
    }

    // Generate HTML content
    const htmlContent = Log.generateHtmlContent(logData, orgId);

    // Write HTML file
    fs.writeFileSync(htmlPath, htmlContent);

    this.log(`Generated HTML summary: ${htmlFileName}`);
    return htmlPath;
  }

  private static logSystemResources(): void {
    try {
      const memUsage = process.memoryUsage();
      const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const memLimitMB = Math.round(memUsage.rss / 1024 / 1024); // Resident set size

      // Use process.stdout.write to avoid linter console restrictions
      process.stdout.write(`📊 System Resources: Heap ${memUsedMB}MB used / ${memTotalMB}MB allocated, RSS: ${memLimitMB}MB\n`);

      // Check if memory usage is getting high (adjusted threshold for Node.js heap)
      if (memUsedMB > 500) { // More than 500MB heap usage
        process.stdout.write(`⚠️ High heap usage detected (${memUsedMB}MB) - approaching memory limits\n`);
      }

      // Also log if total allocated memory is low for large files
      if (memTotalMB < 200) { // Less than 200MB allocated 
        process.stdout.write(`💡 Low memory allocation (${memTotalMB}MB) - Node.js may need to expand heap for large files\n`);
      }
    } catch (error) {
      // Ignore resource logging errors
    }
  }

} 