import { OrgStatsWebScraper, ScrapedOrgStats } from './orgStatsWebScraper.js';
import { ExcelHealthReportGenerator } from './excelHealthReportGenerator.js';
import { HealthCheckResult, OrgSummaryStats } from './healthProcessor.js';

/* eslint-disable no-console */

export class OrgStatsIntegration {
  private orgAlias: string;

  public constructor(orgAlias: string) {
    this.orgAlias = orgAlias;
  }

  /**
   * Get accurate org stats using web scraping
   */
  public async getAccurateOrgStats(): Promise<OrgSummaryStats> {
    console.log(`Getting accurate org stats for: ${this.orgAlias}`);

    const scraper = new OrgStatsWebScraper(this.orgAlias);
    const scrapedStats: ScrapedOrgStats = await scraper.scrapeOrgStats();

    // Convert scraped stats to the format expected by the health report generator
    const orgSummaryStats: OrgSummaryStats = {
      apexUsagePercentage: scrapedStats.apexUsagePercentage,
      usedApexClasses: scrapedStats.usedApexClasses,
      totalApexClasses: scrapedStats.totalApexClasses,
      dataStoragePercentage: scrapedStats.dataStoragePercentage,
      dataStorageUsed: scrapedStats.dataStorageUsed,
      dataStorageMax: scrapedStats.dataStorageMax,
      fileStoragePercentage: scrapedStats.fileStoragePercentage,
      fileStorageUsed: scrapedStats.fileStorageUsed,
      fileStorageMax: scrapedStats.fileStorageMax
    };

    console.log('Converted org stats:', orgSummaryStats);
    return orgSummaryStats;
  }

  /**
   * Generate health report with accurate org stats
   */
  public async generateHealthReportWithAccurateStats(
    healthResults: HealthCheckResult[],
    outputFileName: string
  ): Promise<void> {
    try {
      console.log('Generating health report with accurate org stats...');

      // Get accurate stats using web scraping
      const accurateOrgStats = await this.getAccurateOrgStats();

      // Create health report generator with accurate stats
      const reportGenerator = new ExcelHealthReportGenerator(
        this.orgAlias,
        healthResults,
        accurateOrgStats
      );

      // Generate the report
      reportGenerator.generateReport(outputFileName);

      console.log(`Health report generated successfully: ${outputFileName}`);
      console.log('Org Stats Used:');
      console.log(`- Apex Usage: ${accurateOrgStats.apexUsagePercentage}% (${accurateOrgStats.usedApexClasses}/${accurateOrgStats.totalApexClasses} classes)`);
      console.log(`- Data Storage: ${accurateOrgStats.dataStoragePercentage}% (${accurateOrgStats.dataStorageUsed}MB / ${accurateOrgStats.dataStorageMax}MB)`);
      console.log(`- File Storage: ${accurateOrgStats.fileStoragePercentage}% (${accurateOrgStats.fileStorageUsed}MB / ${accurateOrgStats.fileStorageMax}MB)`);

    } catch (error) {
      console.error('Error generating health report with accurate stats:', error);

      // Fallback: generate report without accurate stats
      console.log('Falling back to generating report without accurate org stats...');
      const reportGenerator = new ExcelHealthReportGenerator(
        this.orgAlias,
        healthResults,
        null
      );
      reportGenerator.generateReport(outputFileName);
      console.log(`Health report generated with fallback: ${outputFileName}`);

      throw error;
    }
  }

  /**
   * Test method to verify web scraping functionality
   */
  public async testWebScraping(): Promise<void> {
    try {
      console.log(`Testing web scraping for org: ${this.orgAlias}`);

      const scraper = new OrgStatsWebScraper(this.orgAlias);
      const stats = await scraper.scrapeOrgStats();

      console.log('Web scraping test successful!');
      console.log('Scraped Stats:', {
        apexUsage: `${stats.apexUsagePercentage}%`,
        apexClasses: `${stats.usedApexClasses}/${stats.totalApexClasses}`,
        dataStorage: `${stats.dataStoragePercentage}% (${stats.dataStorageUsed}MB/${stats.dataStorageMax}MB)`,
        fileStorage: `${stats.fileStoragePercentage}% (${stats.fileStorageUsed}MB/${stats.fileStorageMax}MB)`,
        scrapedAt: stats.scrapedAt.toISOString()
      });

    } catch (error) {
      console.error('Web scraping test failed:', error);
      throw error;
    }
  }
} 