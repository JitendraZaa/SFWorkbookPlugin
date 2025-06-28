/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import * as XLSX from 'xlsx';
import { PermissionSetProcessor } from '../../import/wbook/permissionsets/permissionSetProcessor.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf_workbook', 'jz.permissionsets');

export type PermissionSetsExportResult = {
  totalPermissionSets: number;
  exportedPermissionSets: number;
  failedPermissionSets: number;
  exportPath: string;
  exportedPermissionSetNames: string[];
  failedPermissionSetNames: string[];
};

type PermissionSetRecord = {
  Name: string;
  Id: string;
  Label?: string;
  Description?: string;
};

export default class PermissionSets extends SfCommand<PermissionSetsExportResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'permission-sets': Flags.string({
      char: 'p',
      summary: messages.getMessage('flags.permission-sets.summary'),
      description: messages.getMessage('flags.permission-sets.description'),
      required: false,
    }),
    'output-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.output-dir.summary'),
      description: messages.getMessage('flags.output-dir.description'),
      default: 'Exports',
    }),
    'include-standard': Flags.boolean({
      char: 's',
      summary: messages.getMessage('flags.include-standard.summary'),
      description: messages.getMessage('flags.include-standard.description'),
      default: false,
    }),
  };

  private static isStandardPermissionSet(name: string): boolean {
    // Common standard permission set patterns
    const standardPatterns = [
      'Standard',
      'System',
      'Guest',
      'Portal',
      'Partner',
      'Customer',
      'Force.com',
      'Salesforce',
      'Identity',
      'Chatter',
      'Marketing',
      'Service',
      'Sales',
    ];

    return standardPatterns.some(pattern => name.includes(pattern));
  }

  private static generateFileName(exportPath: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
    return path.join(exportPath, `PermissionSets_Export_${timestamp}.xlsx`);
  }

  public async run(): Promise<PermissionSetsExportResult> {
    const { flags } = await this.parse(PermissionSets);
    const connection = flags['target-org'].getConnection();
    const orgAlias = flags['target-org'].getUsername() ?? 'default';
    const orgId = flags['target-org'].getOrgId();

    this.log(`Exporting permission sets from org: ${orgAlias} (${String(orgId)})`);
    this.log(`Connected with API version: ${connection.version}`);

    // Step 1: Get list of permission sets
    const permissionSets = await this.getPermissionSetsList(
      connection,
      flags['permission-sets'],
      flags['include-standard']
    );

    if (permissionSets.length === 0) {
      this.log('No permission sets found to export.');
      return {
        totalPermissionSets: 0,
        exportedPermissionSets: 0,
        failedPermissionSets: 0,
        exportPath: '',
        exportedPermissionSetNames: [],
        failedPermissionSetNames: [],
      };
    }

    this.log('================================');
    this.log(`Found ${permissionSets.length} permission sets to export`);
    this.displayPermissionSetsSummary(permissionSets);
    this.log('================================');

    // Step 2: Setup export directory
    const exportPath = this.setupExportDirectory(flags['output-dir'], String(orgId));

    // Step 3: Create workbook and process permission sets
    const workbook = XLSX.utils.book_new();
    const processor = new PermissionSetProcessor(connection, this.log.bind(this));

    const result = await this.processPermissionSets(
      permissionSets,
      processor,
      workbook
    );

    // Step 4: Save the workbook
    const fileName = PermissionSets.generateFileName(exportPath);
    XLSX.writeFile(workbook, fileName);

    this.log('================================');
    this.log('🎉 Export completed!');
    this.log('📊 Results:');
    this.log(`   ✅ Successfully exported: ${result.exportedPermissionSets}`);
    this.log(`   ❌ Failed to export: ${result.failedPermissionSets}`);
    this.log(`   📈 Total processed: ${result.totalPermissionSets}`);
    this.log(`   📁 Export location: ${fileName}`);

    if (result.failedPermissionSetNames.length > 0) {
      this.log(`   🔴 Failed permission sets: ${result.failedPermissionSetNames.join(', ')}`);
    }

    this.log('================================');

    return {
      ...result,
      exportPath: fileName,
    };
  }

  private async getPermissionSetsList(
    connection: unknown,
    permissionSetsFlag: string | undefined,
    includeStandard: boolean
  ): Promise<PermissionSetRecord[]> {
    this.log('Getting list of permission sets...');

    let whereClause = '';
    if (!includeStandard) {
      whereClause = 'WHERE IsCustom = true';
    }

    if (permissionSetsFlag?.trim()) {
      // Specific permission sets requested
      const permissionSetNames = permissionSetsFlag.split(',').map(ps => ps.trim()).filter(ps => ps.length > 0);
      this.log(`Looking for specific permission sets: [${permissionSetNames.join(', ')}]`);

      const nameFilter = permissionSetNames.map(name => `'${name}'`).join(',');
      const additionalWhere = `Name IN (${nameFilter})`;

      whereClause = whereClause ? `${whereClause} AND ${additionalWhere}` : `WHERE ${additionalWhere}`;
    }

    const query = `SELECT Id, Name, Label, Description FROM PermissionSet ${whereClause} ORDER BY Name`;
    this.log(`Executing query: ${query}`);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (connection as any).query(query);
      const permissionSets = result.records as PermissionSetRecord[];

      this.log(`Found ${permissionSets.length} permission sets`);
      return permissionSets;
    } catch (error) {
      this.log(`Failed to query permission sets: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private displayPermissionSetsSummary(permissionSets: PermissionSetRecord[]): void {
    this.log('📋 Permission Sets Summary:');
    this.log(`   📊 Total permission sets: ${permissionSets.length}`);

    // Group by custom vs standard
    const customPermSets = permissionSets.filter(ps => !PermissionSets.isStandardPermissionSet(ps.Name));
    const standardPermSets = permissionSets.filter(ps => PermissionSets.isStandardPermissionSet(ps.Name));

    if (customPermSets.length > 0) {
      this.log(`   🔧 Custom permission sets: ${customPermSets.length}`);
    }
    if (standardPermSets.length > 0) {
      this.log(`   🏭 Standard permission sets: ${standardPermSets.length}`);
    }

    // Show first few permission set names
    const displayCount = Math.min(5, permissionSets.length);
    this.log('   📝 Permission sets to export:');
    for (let i = 0; i < displayCount; i++) {
      this.log(`      ${i + 1}. ${permissionSets[i].Name}`);
    }
    if (permissionSets.length > displayCount) {
      this.log(`      ... and ${permissionSets.length - displayCount} more`);
    }
  }

  private setupExportDirectory(outputDir: string, orgId: string): string {
    const exportPath = path.join(process.cwd(), outputDir, 'PermissionSets', orgId);

    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
      this.log(`Created export directory: ${exportPath}`);
    }

    return exportPath;
  }

  private async processPermissionSets(
    permissionSets: PermissionSetRecord[],
    processor: PermissionSetProcessor,
    workbook: XLSX.WorkBook
  ): Promise<{
    totalPermissionSets: number;
    exportedPermissionSets: number;
    failedPermissionSets: number;
    exportedPermissionSetNames: string[];
    failedPermissionSetNames: string[];
  }> {
    const exportedPermissionSetNames: string[] = [];
    const failedPermissionSetNames: string[] = [];

    this.log(`Processing ${permissionSets.length} permission sets...`);

    // Process permission sets sequentially to avoid overwhelming the API
    const processingPromises = permissionSets.map(async (permissionSet, index) => {
      const progressPercent = Math.round(((index + 1) / permissionSets.length) * 100);

      try {
        this.log(`Processing ${index + 1}/${permissionSets.length} (${progressPercent}%): ${permissionSet.Name}`);

        // Process individual permission set
        await this.processIndividualPermissionSet(
          permissionSet.Name,
          processor,
          workbook
        );

        exportedPermissionSetNames.push(permissionSet.Name);
        this.log(`✅ Exported: ${permissionSet.Name}`);
        return { success: true, name: permissionSet.Name };

      } catch (error) {
        failedPermissionSetNames.push(permissionSet.Name);
        this.log(`❌ Failed: ${permissionSet.Name} - ${error instanceof Error ? error.message : String(error)}`);
        return { success: false, name: permissionSet.Name };
      }
    });

    // Wait for all processing to complete
    await Promise.allSettled(processingPromises);

    return {
      totalPermissionSets: permissionSets.length,
      exportedPermissionSets: exportedPermissionSetNames.length,
      failedPermissionSets: failedPermissionSetNames.length,
      exportedPermissionSetNames,
      failedPermissionSetNames,
    };
  }

  private async processIndividualPermissionSet(
    permissionSetName: string,
    processor: PermissionSetProcessor,
    workbook: XLSX.WorkBook
  ): Promise<void> {
    // Use the existing processor method
    this.log(`Processing permission set: ${permissionSetName}`);
    await processor.processPermissionSets(permissionSetName, workbook);
  }
} 