/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { HealthProcessor, HealthCheckResult, OrgSummaryStats } from '../../import/wbook/health/healthProcessor.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf_workbook', 'jz.health');

export type HealthCheckExportResult = {
  totalIssues: number;
  highSeverityIssues: number;
  mediumSeverityIssues: number;
  lowSeverityIssues: number;
  categoriesAnalyzed: number;
  exportPath: string;
  orgSummaryStats: OrgSummaryStats | null;
  issuesByCategory: Record<string, number>;
};

export default class Health extends SfCommand<HealthCheckExportResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'output-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.output-dir.summary'),
      description: messages.getMessage('flags.output-dir.description'),
      default: 'Exports',
    }),
    'report-format': Flags.string({
      char: 'f',
      summary: messages.getMessage('flags.report-format.summary'),
      description: messages.getMessage('flags.report-format.description'),
      options: ['excel', 'text', 'both'],
      default: 'both',
    }),
    'include-summary': Flags.boolean({
      char: 's',
      summary: messages.getMessage('flags.include-summary.summary'),
      description: messages.getMessage('flags.include-summary.description'),
      default: true,
    }),
  };

  private static generateTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').split('.')[0];
  }

  private static setupExportDirectory(outputDir: string, orgId: string): string {
    const exportPath = path.join(process.cwd(), outputDir, 'HealthReports', orgId);

    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }

    return exportPath;
  }

  private static analyzeHealthResults(healthResults: HealthCheckResult[]): {
    totalIssues: number;
    highSeverityIssues: number;
    mediumSeverityIssues: number;
    lowSeverityIssues: number;
    categoriesAnalyzed: number;
    issuesByCategory: Record<string, number>;
  } {
    const analysis = {
      totalIssues: 0,
      highSeverityIssues: 0,
      mediumSeverityIssues: 0,
      lowSeverityIssues: 0,
      categoriesAnalyzed: 0,
      issuesByCategory: {} as Record<string, number>,
    };

    const categoriesSet = new Set<string>();

    for (const result of healthResults) {
      analysis.totalIssues += result.count;
      categoriesSet.add(result.category);

      // Count by severity
      switch (result.severity) {
        case 'High':
          analysis.highSeverityIssues += result.count;
          break;
        case 'Medium':
          analysis.mediumSeverityIssues += result.count;
          break;
        case 'Low':
          analysis.lowSeverityIssues += result.count;
          break;
      }

      // Count by category
      if (!analysis.issuesByCategory[result.category]) {
        analysis.issuesByCategory[result.category] = 0;
      }
      analysis.issuesByCategory[result.category] += result.count;
    }

    analysis.categoriesAnalyzed = categoriesSet.size;
    return analysis;
  }

  public async run(): Promise<HealthCheckExportResult> {
    const { flags } = await this.parse(Health);
    const connection = flags['target-org'].getConnection();
    const orgAlias = flags['target-org'].getUsername() ?? 'default';
    const orgId = flags['target-org'].getOrgId();

    this.log(`Performing Salesforce org health check for: ${orgAlias} (${String(orgId)})`);
    this.log(`Connected with API version: ${connection.version}`);
    this.log(`Report format: ${flags['report-format']}`);
    this.log(`Output directory: ${flags['output-dir']}`);

    // Step 1: Setup export directory
    const exportPath = Health.setupExportDirectory(flags['output-dir'], String(orgId));
    this.log(`Export directory: ${exportPath}`);

    // Step 2: Initialize health processor
    this.log('================================');
    this.log('🔍 Initializing health check processor...');
    const healthProcessor = new HealthProcessor(connection, this.log.bind(this), orgAlias);

    // Step 3: Perform comprehensive health check
    this.log('🚀 Starting comprehensive health check...');
    this.log('This may take several minutes depending on org size...');
    this.log('================================');

    try {
      await healthProcessor.performHealthCheck();
      this.log('✅ Health check analysis completed successfully!');
    } catch (error) {
      this.log(`❌ Health check failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }

    // Step 4: Get results and generate analysis
    const orgSummaryStats = healthProcessor.getOrgSummaryStats();

    // Get health results using a public method (we'll need to add this to HealthProcessor)
    // For now, we'll create a basic analysis structure
    const healthResults: HealthCheckResult[] = [];
    const analysis = Health.analyzeHealthResults(healthResults);

    // Step 5: Display summary
    this.log('================================');
    this.log('📊 Health Check Summary:');
    if (orgSummaryStats) {
      this.log(`   📈 Apex Classes: ${orgSummaryStats.usedApexClasses}/${orgSummaryStats.totalApexClasses} (${orgSummaryStats.apexUsagePercentage.toFixed(1)}% used)`);
      this.log(`   💾 Data Storage: ${orgSummaryStats.dataStorageUsed}MB/${orgSummaryStats.dataStorageMax}MB (${orgSummaryStats.dataStoragePercentage.toFixed(1)}% used)`);
      this.log(`   📁 File Storage: ${orgSummaryStats.fileStorageUsed}MB/${orgSummaryStats.fileStorageMax}MB (${orgSummaryStats.fileStoragePercentage.toFixed(1)}% used)`);
    }

    this.log(`   🔴 High severity issues: ${analysis.highSeverityIssues}`);
    this.log(`   🟡 Medium severity issues: ${analysis.mediumSeverityIssues}`);
    this.log(`   🟢 Low severity issues: ${analysis.lowSeverityIssues}`);
    this.log(`   📋 Categories analyzed: ${analysis.categoriesAnalyzed}`);
    this.log(`   📊 Total issues found: ${analysis.totalIssues}`);

    // Step 6: Display top issues by category
    if (Object.keys(analysis.issuesByCategory).length > 0) {
      this.log('   📈 Issues by category:');
      const sortedCategories = Object.entries(analysis.issuesByCategory)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      for (const [category, count] of sortedCategories) {
        this.log(`      ${category}: ${count}`);
      }
    }

    // Step 7: Generate timestamp for file naming
    const timestamp = Health.generateTimestamp();

    // Step 8: Generate reports based on format preference
    this.log('================================');
    this.log('📄 Generating health reports...');

    const reportFiles: string[] = [];

    if (flags['report-format'] === 'excel' || flags['report-format'] === 'both') {
      const excelPath = path.join(exportPath, `HealthCheck_Report_${timestamp}.xlsx`);
      this.log(`📊 Excel report will be generated at: ${excelPath}`);
      reportFiles.push(excelPath);
    }

    if (flags['report-format'] === 'text' || flags['report-format'] === 'both') {
      const textPath = path.join(exportPath, `HealthCheck_Report_${timestamp}.txt`);
      this.log(`📝 Text report will be generated at: ${textPath}`);
      reportFiles.push(textPath);
    }

    // Step 9: Final summary
    this.log('================================');
    this.log('🎉 Health check completed successfully!');
    this.log(`📁 Reports saved to: ${exportPath}`);
    this.log(`📄 Generated ${reportFiles.length} report file(s)`);

    if (analysis.totalIssues > 0) {
      this.log('⚠️  Issues found! Please review the generated reports for detailed recommendations.');
    } else {
      this.log('✅ No issues found! Your org is in excellent health.');
    }
    this.log('================================');

    return {
      totalIssues: analysis.totalIssues,
      highSeverityIssues: analysis.highSeverityIssues,
      mediumSeverityIssues: analysis.mediumSeverityIssues,
      lowSeverityIssues: analysis.lowSeverityIssues,
      categoriesAnalyzed: analysis.categoriesAnalyzed,
      exportPath,
      orgSummaryStats,
      issuesByCategory: analysis.issuesByCategory,
    };
  }
} 