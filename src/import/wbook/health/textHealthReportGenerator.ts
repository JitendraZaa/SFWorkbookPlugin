import * as fs from 'node:fs';
import { HealthCheckResult, OrgSummaryStats } from './healthProcessor.js';

export class TextHealthReportGenerator {
  private orgAlias: string;
  private healthResults: HealthCheckResult[];
  private orgSummaryStats: OrgSummaryStats | null;

  public constructor(orgAlias: string, healthResults: HealthCheckResult[], orgSummaryStats: OrgSummaryStats | null = null) {
    this.orgAlias = orgAlias;
    this.healthResults = healthResults;
    this.orgSummaryStats = orgSummaryStats;
  }

  public generateReport(fileName: string): void {
    let reportContent = '';

    // Title
    reportContent += '='.repeat(60) + '\n';
    reportContent += '           SALESFORCE ORG HEALTH CHECK REPORT\n';
    reportContent += '='.repeat(60) + '\n';
    reportContent += `Generated on: ${new Date().toLocaleDateString()}\n`;
    reportContent += `Org Alias: ${this.orgAlias}\n\n`;

    // Executive Summary
    reportContent += 'EXECUTIVE SUMMARY\n';
    reportContent += '-'.repeat(20) + '\n';
    const categories = [...new Set(this.healthResults.map(r => r.category))];
    reportContent += `Total Technical Debt Categories Found: ${categories.length}\n`;

    const highSeverityCount = this.healthResults.filter(r => r.severity === 'High').length;
    const mediumSeverityCount = this.healthResults.filter(r => r.severity === 'Medium').length;
    const lowSeverityCount = this.healthResults.filter(r => r.severity === 'Low').length;

    reportContent += `High Severity Issues: ${highSeverityCount}\n`;
    reportContent += `Medium Severity Issues: ${mediumSeverityCount}\n`;
    reportContent += `Low Severity Issues: ${lowSeverityCount}\n\n`;

    // Add Category Overview section to match Excel report
    reportContent += 'CATEGORY OVERVIEW\n';
    reportContent += '-'.repeat(18) + '\n';
    reportContent += 'Category'.padEnd(25) + 'Issues'.padEnd(8) + 'High'.padEnd(6) + 'Medium'.padEnd(8) + 'Low\n';
    reportContent += '='.repeat(55) + '\n';

    categories.forEach(category => {
      const categoryResults = this.healthResults.filter(r => r.category === category);
      const highCount = categoryResults.filter(r => r.severity === 'High').length;
      const mediumCount = categoryResults.filter(r => r.severity === 'Medium').length;
      const lowCount = categoryResults.filter(r => r.severity === 'Low').length;

      reportContent += category.padEnd(25) +
        categoryResults.length.toString().padEnd(8) +
        highCount.toString().padEnd(6) +
        mediumCount.toString().padEnd(8) +
        lowCount.toString() + '\n';
    });
    reportContent += '\n';

    // Org Statistics Section
    if (this.orgSummaryStats) {
      reportContent += 'ORG STATISTICS\n';
      reportContent += '-'.repeat(15) + '\n';

      // Always show Apex usage
      reportContent += `Apex Usage: ${this.orgSummaryStats.apexUsagePercentage}% (${this.orgSummaryStats.usedApexClasses}/${this.orgSummaryStats.totalApexClasses} classes)\n`;

      // Show storage information if available (not -1)
      if (this.orgSummaryStats.dataStoragePercentage >= 0) {
        reportContent += `Data Storage: ${this.orgSummaryStats.dataStoragePercentage}% (${this.orgSummaryStats.dataStorageUsed}MB / ${this.orgSummaryStats.dataStorageMax}MB)\n`;
      } else {
        reportContent += 'Data Storage: Not available via API (check Setup > Storage Usage)\n';
      }

      if (this.orgSummaryStats.fileStoragePercentage >= 0) {
        reportContent += `File Storage: ${this.orgSummaryStats.fileStoragePercentage}% (${this.orgSummaryStats.fileStorageUsed}MB / ${this.orgSummaryStats.fileStorageMax}MB)\n`;
      } else {
        reportContent += 'File Storage: Not available via API (check Setup > Storage Usage)\n';
      }

      // Add Big Object Storage if available
      if (this.orgSummaryStats.bigObjectStorageMax && this.orgSummaryStats.bigObjectStorageMax > 0) {
        reportContent += `Big Object Storage: ${this.orgSummaryStats.bigObjectStoragePercentage}% (${this.orgSummaryStats.bigObjectStorageUsed} / ${this.orgSummaryStats.bigObjectStorageMax} records)\n`;
      }

      // Add Top Storage Objects summary
      if (this.orgSummaryStats.topStorageObjects.length > 0) {
        reportContent += `Top Storage Objects: ${this.orgSummaryStats.topStorageObjects.length} items found\n`;
      }

      reportContent += '\n';
    }

    // Add Detailed Issue Summary section to match Excel report
    reportContent += 'DETAILED ISSUE SUMMARY BY CATEGORY\n';
    reportContent += '-'.repeat(38) + '\n';
    reportContent += 'Category'.padEnd(20) + 'Issue Title'.padEnd(35) + 'Severity'.padEnd(10) + 'Count\n';
    reportContent += '='.repeat(80) + '\n';

    categories.forEach(category => {
      const categoryResults = this.healthResults.filter(r => r.category === category);
      categoryResults.forEach(result => {
        // Truncate title if too long to match Excel format
        const truncatedTitle = result.title.length > 32 ? result.title.substring(0, 29) + '...' : result.title;
        reportContent += category.padEnd(20) +
          truncatedTitle.padEnd(35) +
          result.severity.padEnd(10) +
          result.count.toString() + '\n';
      });
    });
    reportContent += '\n';

    // Technical Debt Details by Category
    reportContent += 'TECHNICAL DEBT ANALYSIS BY CATEGORY\n';
    reportContent += '-'.repeat(40) + '\n\n';

    categories.forEach(category => {
      const categoryResults = this.healthResults.filter(r => r.category === category);

      reportContent += `${category.toUpperCase()}\n`;
      reportContent += '='.repeat(category.length) + '\n\n';

      categoryResults.forEach(result => {
        reportContent += `${result.title}\n`;
        reportContent += `Severity: ${result.severity} | Count: ${result.count}\n\n`;

        reportContent += `Description: ${result.description}\n\n`;
        reportContent += `Recommendation: ${result.recommendation}\n\n`;

        if (result.items.length > 0 && result.count > 0) {
          reportContent += 'Items Found:\n';
          result.items.forEach(item => {
            reportContent += `• ${item}\n`;
          });
          reportContent += '\n';
        }

        reportContent += '-'.repeat(50) + '\n\n';
      });
    });

    // Top Storage Objects Section
    if (this.orgSummaryStats && this.orgSummaryStats.topStorageObjects.length > 0) {
      reportContent += 'TOP 20 HIGH STORAGE OBJECTS\n';
      reportContent += '-'.repeat(30) + '\n\n';

      reportContent += 'Record Type'.padEnd(35) + 'Record Count'.padEnd(15) + 'Storage'.padEnd(15) + 'Percent\n';
      reportContent += '='.repeat(80) + '\n';

      this.orgSummaryStats.topStorageObjects.forEach(obj => {
        reportContent += obj.recordType.padEnd(35) +
          obj.recordCount.toString().padEnd(15) +
          obj.storage.padEnd(15) +
          `${obj.percent}%\n`;
      });

      // Add summary statistics to match Excel report exactly
      const totalRecords = this.orgSummaryStats.topStorageObjects.reduce((sum, obj) => sum + obj.recordCount, 0);
      const totalStorageMB = this.orgSummaryStats.topStorageObjects.reduce((sum, obj) => sum + obj.storageInMB, 0);
      const totalPercent = this.orgSummaryStats.topStorageObjects.reduce((sum, obj) => sum + obj.percent, 0);

      reportContent += '-'.repeat(80) + '\n';
      reportContent += 'SUMMARY STATISTICS\n';
      reportContent += `Total Records: ${totalRecords.toLocaleString()}\n`;
      reportContent += `Total Storage: ${totalStorageMB.toFixed(2)} MB\n`;
      reportContent += `Total Percentage: ${totalPercent.toFixed(1)}%\n`;
      reportContent += `Average per Object: ${Math.round(totalRecords / this.orgSummaryStats.topStorageObjects.length).toLocaleString()} records, ${(totalStorageMB / this.orgSummaryStats.topStorageObjects.length).toFixed(2)} MB, ${(totalPercent / this.orgSummaryStats.topStorageObjects.length).toFixed(1)}%\n\n`;
    }

    // Priority Recommendations
    reportContent += 'PRIORITY RECOMMENDATIONS\n';
    reportContent += '-'.repeat(25) + '\n\n';

    const highPriorityItems = this.healthResults.filter(r => r.severity === 'High');
    if (highPriorityItems.length > 0) {
      reportContent += 'HIGH PRIORITY (Address Immediately):\n\n';
      highPriorityItems.forEach((item, index) => {
        reportContent += `${index + 1}. ${item.title}\n`;
        reportContent += `   ${item.recommendation}\n\n`;
      });
    }

    const mediumPriorityItems = this.healthResults.filter(r => r.severity === 'Medium');
    if (mediumPriorityItems.length > 0) {
      reportContent += 'MEDIUM PRIORITY (Address Soon):\n\n';
      mediumPriorityItems.forEach((item, index) => {
        reportContent += `${index + 1}. ${item.title}\n`;
        reportContent += `   ${item.recommendation}\n\n`;
      });
    }

    // Footer
    reportContent += '='.repeat(60) + '\n';
    reportContent += 'Generated by Salesforce Health Check Tool\n';
    reportContent += '='.repeat(60) + '\n';

    fs.writeFileSync(fileName, reportContent);
  }
} 