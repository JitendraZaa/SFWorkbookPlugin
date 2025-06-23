import * as XLSX from 'xlsx';
import { HealthCheckResult, OrgSummaryStats } from './healthProcessor.js';

export class ExcelHealthReportGenerator {
  private orgAlias: string;
  private healthResults: HealthCheckResult[];
  private orgSummaryStats: OrgSummaryStats | null;

  public constructor(orgAlias: string, healthResults: HealthCheckResult[], orgSummaryStats: OrgSummaryStats | null = null) {
    this.orgAlias = orgAlias;
    this.healthResults = healthResults;
    this.orgSummaryStats = orgSummaryStats;
  }

  private static parseItemWithBrackets(item: string, category: string): { name: string; additionalInfo: string; suggestion: string } {
    // Look for patterns like "ItemName (additional info)" or "ItemName (API v50)" etc.
    const bracketMatch = item.match(/^(.+?)\s*\(([^)]+)\)(.*)$/);

    if (bracketMatch) {
      const name = bracketMatch[1].trim();
      const bracketContent = bracketMatch[2].trim();
      const remaining = bracketMatch[3] ? bracketMatch[3].trim() : '';

      // For PB and WF, treat bracket content as suggestion/status
      if (category === 'PB and WF') {
        return {
          name,
          additionalInfo: remaining,
          suggestion: bracketContent
        };
      } else {
        // For other categories, treat bracket content as additional info
        return {
          name,
          additionalInfo: bracketContent + (remaining ? ' ' + remaining : ''),
          suggestion: ''
        };
      }
    }

    // If no brackets found, return the whole item as name
    return {
      name: item,
      additionalInfo: '',
      suggestion: ''
    };
  }

  private static truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  public generateReport(fileName: string): void {
    const workbook = XLSX.utils.book_new();
    const categories = [...new Set(this.healthResults.map(r => r.category))];

    // Create main summary sheet with all category summaries
    this.createSummarySheet(workbook, categories);

    // Create a sheet for each category with only detailed data
    categories.forEach(category => {
      this.createCategorySheet(workbook, category);
    });

    // Create Top Storage Objects sheet if data is available
    if (this.orgSummaryStats && this.orgSummaryStats.topStorageObjects.length > 0) {
      this.createTopStorageObjectsSheet(workbook);
    }

    XLSX.writeFile(workbook, fileName);
  }

  private createSummarySheet(workbook: XLSX.WorkBook, categories: string[]): void {
    const summaryData = [
      ['Salesforce Org Health Check Report'],
      [`Org Alias: ${this.orgAlias}`],
      [`Generated on: ${new Date().toLocaleDateString()}`],
      [''],
      ['Executive Summary'],
      ['Total Categories Found', categories.length.toString()],
      ['High Severity Issues', this.healthResults.filter(r => r.severity === 'High').length.toString()],
      ['Medium Severity Issues', this.healthResults.filter(r => r.severity === 'Medium').length.toString()],
      ['Low Severity Issues', this.healthResults.filter(r => r.severity === 'Low').length.toString()],
      ['']
    ];

    // Add org statistics if available
    if (this.orgSummaryStats) {
      summaryData.push(['Org Statistics']);

      // Always show Apex usage
      summaryData.push(['Apex Usage', `${this.orgSummaryStats.apexUsagePercentage}% (${this.orgSummaryStats.usedApexClasses}/${this.orgSummaryStats.totalApexClasses} classes)`]);

      // Show storage information if available (not -1)
      if (this.orgSummaryStats.dataStoragePercentage >= 0) {
        summaryData.push(['Data Storage', `${this.orgSummaryStats.dataStoragePercentage}% (${this.orgSummaryStats.dataStorageUsed}MB / ${this.orgSummaryStats.dataStorageMax}MB)`]);
      } else {
        summaryData.push(['Data Storage', 'Not available via API (check Setup > Storage Usage)']);
      }

      if (this.orgSummaryStats.fileStoragePercentage >= 0) {
        summaryData.push(['File Storage', `${this.orgSummaryStats.fileStoragePercentage}% (${this.orgSummaryStats.fileStorageUsed}MB / ${this.orgSummaryStats.fileStorageMax}MB)`]);
      } else {
        summaryData.push(['File Storage', 'Not available via API (check Setup > Storage Usage)']);
      }

      // Add Big Object Storage if available
      if (this.orgSummaryStats.bigObjectStorageMax && this.orgSummaryStats.bigObjectStorageMax > 0) {
        summaryData.push(['Big Object Storage', `${this.orgSummaryStats.bigObjectStoragePercentage}% (${this.orgSummaryStats.bigObjectStorageUsed} / ${this.orgSummaryStats.bigObjectStorageMax} records)`]);
      }

      summaryData.push(['']);
    }

    summaryData.push(
      ['Category Overview'],
      ['Category', 'Issues Count', 'High', 'Medium', 'Low']
    );

    // Add category overview
    categories.forEach(category => {
      const categoryResults = this.healthResults.filter(r => r.category === category);
      const highCount = categoryResults.filter(r => r.severity === 'High').length;
      const mediumCount = categoryResults.filter(r => r.severity === 'Medium').length;
      const lowCount = categoryResults.filter(r => r.severity === 'Low').length;

      summaryData.push([category, categoryResults.length.toString(), highCount.toString(), mediumCount.toString(), lowCount.toString()]);
    });

    // Add detailed summary for each category
    summaryData.push([''], ['Detailed Issue Summary by Category']);
    summaryData.push(['Category', 'Issue Title', 'Severity', 'Count', 'Description', 'Recommendation']);

    categories.forEach(category => {
      const categoryResults = this.healthResults.filter(r => r.category === category);
      categoryResults.forEach(result => {
        summaryData.push([
          category,
          result.title,
          result.severity,
          result.count.toString(),
          ExcelHealthReportGenerator.truncateText(result.description, 1000),
          ExcelHealthReportGenerator.truncateText(result.recommendation, 1000)
        ]);
      });
    });

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  }

  private createCategorySheet(workbook: XLSX.WorkBook, category: string): void {
    const categoryResults = this.healthResults.filter(r => r.category === category);

    // Only include detailed items data - no summary section
    const categoryData = [];

    // Special handling for PB and WF to include suggestion column
    if (category === 'PB and WF') {
      categoryData.push(['Issue Title', 'Severity', 'Item Name', 'Status/Suggestion', 'Additional Info']);
    } else {
      categoryData.push(['Issue Title', 'Severity', 'Item Name', 'Additional Info']);
    }

    // Add each item as a separate row
    categoryResults.forEach(result => {
      if (result.items.length > 0) {
        result.items.forEach(item => {
          // Parse item to extract additional info if it contains brackets
          const parsedItem = ExcelHealthReportGenerator.parseItemWithBrackets(item, category);

          if (category === 'PB and WF') {
            categoryData.push([
              result.title,
              result.severity,
              parsedItem.name,
              parsedItem.suggestion,
              parsedItem.additionalInfo
            ]);
          } else {
            categoryData.push([
              result.title,
              result.severity,
              parsedItem.name,
              parsedItem.additionalInfo
            ]);
          }
        });
      } else if (category === 'PB and WF') {
        categoryData.push([result.title, result.severity, 'No specific items found', '', '']);
      } else {
        categoryData.push([result.title, result.severity, 'No specific items found', '']);
      }
    });

    const categorySheet = XLSX.utils.aoa_to_sheet(categoryData);
    // Create safe sheet name (max 31 chars, no special characters)
    const sheetName = category.substring(0, 31).replace(/[\\/:?*[\]]/g, '_');
    XLSX.utils.book_append_sheet(workbook, categorySheet, sheetName);
  }

  private createTopStorageObjectsSheet(workbook: XLSX.WorkBook): void {
    if (!this.orgSummaryStats?.topStorageObjects.length) {
      return;
    }

    const storageData = [
      ['Top 20 High Storage Objects'],
      [`Org Alias: ${this.orgAlias}`],
      [`Generated on: ${new Date().toLocaleDateString()}`],
      [''],
      ['Record Type', 'Record Count', 'Storage', 'Storage (MB)', 'Percent']
    ];

    // Add storage objects data
    this.orgSummaryStats.topStorageObjects.forEach(obj => {
      storageData.push([
        obj.recordType,
        obj.recordCount.toString(),
        obj.storage,
        obj.storageInMB.toFixed(2),
        `${obj.percent}%`
      ]);
    });

    // Add summary statistics
    storageData.push(['']);
    storageData.push(['Summary Statistics']);
    const totalRecords = this.orgSummaryStats.topStorageObjects.reduce((sum, obj) => sum + obj.recordCount, 0);
    const totalStorageMB = this.orgSummaryStats.topStorageObjects.reduce((sum, obj) => sum + obj.storageInMB, 0);
    const totalPercent = this.orgSummaryStats.topStorageObjects.reduce((sum, obj) => sum + obj.percent, 0);

    storageData.push(['Total Records', totalRecords.toString(), '', totalStorageMB.toFixed(2), `${totalPercent.toFixed(1)}%`]);
    storageData.push(['Average per Object', Math.round(totalRecords / this.orgSummaryStats.topStorageObjects.length).toString(), '', (totalStorageMB / this.orgSummaryStats.topStorageObjects.length).toFixed(2), `${(totalPercent / this.orgSummaryStats.topStorageObjects.length).toFixed(1)}%`]);

    const storageSheet = XLSX.utils.aoa_to_sheet(storageData);
    XLSX.utils.book_append_sheet(workbook, storageSheet, 'Top Storage Objects');
  }

} 