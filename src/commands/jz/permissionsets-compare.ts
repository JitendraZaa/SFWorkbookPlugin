/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/quotes */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-param-reassign */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Connection } from '@salesforce/core';
import * as XLSX from 'xlsx';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf_workbook', 'jz.permissionsets-compare');

export type PermissionSetsCompareResult = {
  totalPermissionSetsCompared: number;
  permissionSetsWithDifferences: number;
  permissionSetsSimilar: number;
  permissionSetsOnlyInSource: number;
  permissionSetsOnlyInTarget: number;
  exportPath: string;
  comparedPermissionSetNames: string[];
  permissionSetsWithDifferenceNames: string[];
  permissionSetsSimilarNames: string[];
  permissionSetsOnlyInSourceNames: string[];
  permissionSetsOnlyInTargetNames: string[];
};

type PermissionSetRecord = {
  Name: string;
  Id: string;
  Label?: string;
  IsCustom?: boolean;
};

type ObjectPermissionRecord = {
  SobjectType: string;
  PermissionsRead: boolean;
  PermissionsCreate: boolean;
  PermissionsEdit: boolean;
  PermissionsDelete: boolean;
  PermissionsViewAllRecords: boolean;
  PermissionsModifyAllRecords: boolean;
};

type FieldPermissionRecord = {
  Field: string;
  SobjectType: string;
  PermissionsRead: boolean;
  PermissionsEdit: boolean;
};

type SystemPermissionRecord = {
  SetupEntityId: string;
  SetupEntityType: string;
};

type PermissionData = {
  type: string;
  name: string;
  read?: string;
  create?: string;
  edit?: string;
  delete?: string;
  viewAll?: string;
  modifyAll?: string;
  permission?: string;
};

type PermissionSetComparison = {
  permissionSetName: string;
  differences: PermissionDifference[];
};

type PermissionDifference = {
  type: string;
  name: string;
  property: string;
  sourceValue: string;
  targetValue: string;
  differenceType: 'Added' | 'Removed' | 'Modified';
};

export default class PermissionSetsCompare extends SfCommand<PermissionSetsCompareResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'source-org': Flags.requiredOrg({
      char: 's',
      summary: messages.getMessage('flags.source-org.summary'),
      description: messages.getMessage('flags.source-org.description'),
    }),
    'target-org': Flags.requiredOrg({
      char: 't',
      summary: messages.getMessage('flags.target-org.summary'),
      description: messages.getMessage('flags.target-org.description'),
    }),
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
      char: 'i',
      summary: messages.getMessage('flags.include-standard.summary'),
      description: messages.getMessage('flags.include-standard.description'),
      default: false,
    }),
  };

  private static generateTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').split('.')[0];
  }

  private static setupExportDirectory(outputDir: string, sourceOrgId: string, targetOrgId: string): string {
    const exportPath = path.join(process.cwd(), outputDir, 'PermissionSets', 'Compare', `${sourceOrgId}_vs_${targetOrgId}`);

    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }

    return exportPath;
  }

  private static isLikelyId(componentName: string): boolean {
    // Check if the component name looks like a Salesforce ID (15 or 18 characters, alphanumeric)
    const idPattern = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;
    return idPattern.test(componentName);
  }

  private static shouldIgnoreComponent(permissionData: PermissionData): boolean {
    // Ignore components that look like IDs since they'll always be different between orgs
    if (PermissionSetsCompare.isLikelyId(permissionData.name)) {
      return true;
    }

    // For System Permissions, also check the SetupEntityId which is often an ID
    if (permissionData.type === 'System Permission' && PermissionSetsCompare.isLikelyId(permissionData.name)) {
      return true;
    }

    return false;
  }

  private static applyExcelFormatting(worksheet: XLSX.WorkSheet): void {
    const range = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1');

    // Set column widths  
    const columnWidths = [
      { width: 20 }, // Permission Type
      { width: 40 }, // Component Name
      { width: 15 }, // Property
      { width: 15 }, // Source Value
      { width: 15 }, // Target Value
      { width: 15 }, // Difference Type
    ];
    worksheet['!cols'] = columnWidths;

    // Apply header formatting
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddress]) continue;

      const cellStyle = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4472C4' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
      worksheet[cellAddress].s = cellStyle;
    }
  }

  public async run(): Promise<PermissionSetsCompareResult> {
    const { flags } = await this.parse(PermissionSetsCompare);
    const sourceConnection = flags['source-org'].getConnection();
    const targetConnection = flags['target-org'].getConnection();
    const sourceOrgAlias = flags['source-org'].getUsername() ?? 'source';
    const targetOrgAlias = flags['target-org'].getUsername() ?? 'target';
    const sourceOrgId = flags['source-org'].getOrgId();
    const targetOrgId = flags['target-org'].getOrgId();

    this.log('Comparing permission sets between orgs:');
    this.log(`  Source: ${sourceOrgAlias} (${String(sourceOrgId)})`);
    this.log(`  Target: ${targetOrgAlias} (${String(targetOrgId)})`);
    this.log(`  Include standard permission sets: ${flags['include-standard']}`);

    // Step 1: Get list of permission sets from both orgs
    this.log('================================');
    this.log('📋 Getting permission sets from both orgs...');

    const [sourcePermissionSets, targetPermissionSets] = await Promise.all([
      this.getPermissionSetsList(sourceConnection, flags['permission-sets'], flags['include-standard'], 'source'),
      this.getPermissionSetsList(targetConnection, flags['permission-sets'], flags['include-standard'], 'target')
    ]);

    this.log(`  Source org: ${sourcePermissionSets.length} permission sets`);
    this.log(`  Target org: ${targetPermissionSets.length} permission sets`);

    // Step 2: Find permission sets that exist in both orgs
    const sourceNames = new Set(sourcePermissionSets.map(ps => ps.Name));
    const targetNames = new Set(targetPermissionSets.map(ps => ps.Name));

    // Use a Map to ensure unique permission sets and avoid duplicates
    const commonPermissionSetsMap = new Map<string, PermissionSetRecord>();
    sourcePermissionSets.forEach(ps => {
      if (targetNames.has(ps.Name)) {
        commonPermissionSetsMap.set(ps.Name, ps);
      }
    });

    const commonPermissionSets = Array.from(commonPermissionSetsMap.values());
    const onlyInSource = sourcePermissionSets.filter(ps => !targetNames.has(ps.Name));
    const onlyInTarget = targetPermissionSets.filter(ps => !sourceNames.has(ps.Name));

    this.log('================================');
    this.log('🔍 Analysis Summary:');
    this.log(`  📊 Common permission sets: ${commonPermissionSets.length}`);
    this.log(`  📤 Only in source: ${onlyInSource.length}`);
    this.log(`  📥 Only in target: ${onlyInTarget.length}`);

    if (commonPermissionSets.length === 0) {
      this.log('⚠️  No common permission sets found to compare!');
      return {
        totalPermissionSetsCompared: 0,
        permissionSetsWithDifferences: 0,
        permissionSetsSimilar: 0,
        permissionSetsOnlyInSource: onlyInSource.length,
        permissionSetsOnlyInTarget: onlyInTarget.length,
        exportPath: '',
        comparedPermissionSetNames: [],
        permissionSetsWithDifferenceNames: [],
        permissionSetsSimilarNames: [],
        permissionSetsOnlyInSourceNames: onlyInSource.map(ps => ps.Name),
        permissionSetsOnlyInTargetNames: onlyInTarget.map(ps => ps.Name),
      };
    }

    // Step 3: Setup export directory
    const exportPath = PermissionSetsCompare.setupExportDirectory(
      flags['output-dir'],
      String(sourceOrgId),
      String(targetOrgId)
    );

    // Step 4: Compare permission sets
    this.log('================================');
    this.log('🔄 Comparing permission sets...');
    this.log('📝 Note: Components with ID-like names are automatically excluded from comparison');

    const comparisons: PermissionSetComparison[] = [];
    const workbook = XLSX.utils.book_new();

    // Process all permission sets in parallel
    const comparisonPromises = commonPermissionSets.map(async (permissionSet) => {
      this.log(`  Comparing: ${permissionSet.Name}`);

      const differences = await this.comparePermissionSet(
        permissionSet.Name,
        sourceConnection,
        targetConnection
      );

      return {
        permissionSet,
        differences
      };
    });

    const comparisonResults = await Promise.all(comparisonPromises);

    // Consolidate differences by permission set name to avoid duplicate worksheets
    const consolidatedComparisons = new Map<string, PermissionDifference[]>();

    // Process results and consolidate differences
    for (const { permissionSet, differences } of comparisonResults) {
      if (differences.length > 0) {
        const existingDifferences = consolidatedComparisons.get(permissionSet.Name) || [];
        consolidatedComparisons.set(permissionSet.Name, [...existingDifferences, ...differences]);
        this.log(`    ✅ Found ${differences.length} differences for ${permissionSet.Name}`);
      } else {
        this.log(`    ✅ No differences found for ${permissionSet.Name}`);
      }
    }

    // Create comparisons array from consolidated data
    for (const [permissionSetName, allDifferences] of consolidatedComparisons) {
      comparisons.push({
        permissionSetName,
        differences: allDifferences
      });
    }

    // Step 5: Create summary worksheet FIRST
    const currentSimilarCount = commonPermissionSets.length - comparisons.length;
    const currentSimilarNames = commonPermissionSets
      .filter(ps => !comparisons.some(c => c.permissionSetName === ps.Name))
      .map(ps => ps.Name);
    this.createSummaryWorksheet(workbook, comparisons, onlyInSource, onlyInTarget, sourceOrgAlias, targetOrgAlias, commonPermissionSets.length, currentSimilarCount, currentSimilarNames);

    // Create individual worksheets for each permission set with differences
    for (const [permissionSetName, allDifferences] of consolidatedComparisons) {
      // Create worksheet for this permission set differences (consolidated)
      this.createComparisonWorksheet(workbook, permissionSetName, allDifferences, sourceOrgAlias, targetOrgAlias);
      this.log(`    📋 Created worksheet for ${permissionSetName} with ${allDifferences.length} total differences`);
    }

    // Step 6: Save the workbook
    const timestamp = PermissionSetsCompare.generateTimestamp();
    const fileName = path.join(exportPath, `PermissionSets_Comparison_${timestamp}.xlsx`);
    XLSX.writeFile(workbook, fileName);

    // Step 7: Final summary
    this.log('================================');
    this.log('🎉 Comparison completed!');
    this.log(`📊 Results:`);
    this.log(`   📈 Total compared: ${commonPermissionSets.length}`);
    this.log(`   🔍 With differences: ${comparisons.length}`);
    this.log(`   ✅ Similar (no differences): ${currentSimilarCount}`);
    this.log(`   📤 Only in source: ${onlyInSource.length}`);
    this.log(`   📥 Only in target: ${onlyInTarget.length}`);
    this.log(`   📁 Export location: ${fileName}`);
    this.log('================================');

    const similarCount = commonPermissionSets.length - comparisons.length;
    const similarNames = commonPermissionSets
      .filter(ps => !comparisons.some(c => c.permissionSetName === ps.Name))
      .map(ps => ps.Name);

    return {
      totalPermissionSetsCompared: commonPermissionSets.length,
      permissionSetsWithDifferences: comparisons.length,
      permissionSetsSimilar: similarCount,
      permissionSetsOnlyInSource: onlyInSource.length,
      permissionSetsOnlyInTarget: onlyInTarget.length,
      exportPath: fileName,
      comparedPermissionSetNames: commonPermissionSets.map(ps => ps.Name),
      permissionSetsWithDifferenceNames: comparisons.map(c => c.permissionSetName),
      permissionSetsSimilarNames: similarNames,
      permissionSetsOnlyInSourceNames: onlyInSource.map(ps => ps.Name),
      permissionSetsOnlyInTargetNames: onlyInTarget.map(ps => ps.Name),
    };
  }

  private async getPermissionSetsList(
    connection: Connection,
    permissionSetsFlag: string | undefined,
    includeStandard: boolean,
    orgType: string
  ): Promise<PermissionSetRecord[]> {
    this.log(`Getting list of permission sets from ${orgType} org...`);

    let whereClause = '';
    if (!includeStandard) {
      whereClause = 'WHERE IsCustom = true';
    }

    if (permissionSetsFlag?.trim()) {
      const permissionSetNames = permissionSetsFlag.split(',').map(ps => ps.trim()).filter(ps => ps.length > 0);
      this.log(`Looking for specific permission sets: [${permissionSetNames.join(', ')}]`);

      const nameFilter = permissionSetNames.map(name => `'${name}'`).join(',');
      const additionalWhere = `Name IN (${nameFilter})`;

      whereClause = whereClause ? `${whereClause} AND ${additionalWhere}` : `WHERE ${additionalWhere}`;
    }

    const query = `SELECT Id, Name, Label, IsCustom FROM PermissionSet ${whereClause} ORDER BY Name`;
    this.log(`Executing query for ${orgType}: ${query}`);

    try {
      const result = await connection.query(query);
      const permissionSets = result.records as PermissionSetRecord[];

      this.log(`Found ${permissionSets.length} permission sets in ${orgType} org`);
      return permissionSets;
    } catch (error) {
      this.log(`Failed to query permission sets in ${orgType} org: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private async comparePermissionSet(
    permissionSetName: string,
    sourceConnection: Connection,
    targetConnection: Connection
  ): Promise<PermissionDifference[]> {
    const differences: PermissionDifference[] = [];

    // Get permissions from both orgs
    const [sourcePermissions, targetPermissions] = await Promise.all([
      this.getPermissionSetPermissions(sourceConnection, permissionSetName),
      this.getPermissionSetPermissions(targetConnection, permissionSetName)
    ]);

    // Create maps for easier comparison, filtering out ID-based components
    const sourceMap = new Map<string, PermissionData>();
    const targetMap = new Map<string, PermissionData>();

    sourcePermissions.forEach(perm => {
      if (!PermissionSetsCompare.shouldIgnoreComponent(perm)) {
        const key = `${perm.type}:${perm.name}`;
        sourceMap.set(key, perm);
      }
    });

    targetPermissions.forEach(perm => {
      if (!PermissionSetsCompare.shouldIgnoreComponent(perm)) {
        const key = `${perm.type}:${perm.name}`;
        targetMap.set(key, perm);
      }
    });

    // Find permissions only in source (removed in target)
    for (const [key, sourcePerm] of sourceMap) {
      if (!targetMap.has(key)) {
        differences.push({
          type: sourcePerm.type,
          name: sourcePerm.name,
          property: 'Entire Permission',
          sourceValue: 'Exists',
          targetValue: 'Missing',
          differenceType: 'Removed'
        });
      }
    }

    // Find permissions only in target (added in target)
    for (const [key, targetPerm] of targetMap) {
      if (!sourceMap.has(key)) {
        differences.push({
          type: targetPerm.type,
          name: targetPerm.name,
          property: 'Entire Permission',
          sourceValue: 'Missing',
          targetValue: 'Exists',
          differenceType: 'Added'
        });
      }
    }

    // Compare common permissions for differences
    for (const [key, sourcePerm] of sourceMap) {
      const targetPerm = targetMap.get(key);
      if (targetPerm) {
        this.comparePermissionProperties(sourcePerm, targetPerm, differences);
      }
    }

    return differences;
  }

  private comparePermissionProperties(
    sourcePerm: PermissionData,
    targetPerm: PermissionData,
    differences: PermissionDifference[]
  ): void {
    const properties = ['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll', 'permission'] as const;

    for (const property of properties) {
      const sourceValue = sourcePerm[property] || '';
      const targetValue = targetPerm[property] || '';

      if (sourceValue !== targetValue) {
        differences.push({
          type: sourcePerm.type,
          name: sourcePerm.name,
          property: property.charAt(0).toUpperCase() + property.slice(1),
          sourceValue,
          targetValue,
          differenceType: 'Modified'
        });
      }
    }
  }

  private async getPermissionSetPermissions(
    connection: Connection,
    permissionSetName: string
  ): Promise<PermissionData[]> {
    const permissions: PermissionData[] = [];

    // Get object permissions
    const objectPerms = await connection.query<ObjectPermissionRecord>(
      `SELECT SobjectType, PermissionsRead, PermissionsCreate, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords 
       FROM ObjectPermissions 
       WHERE ParentId IN (SELECT Id FROM PermissionSet WHERE Name = '${permissionSetName}')
       AND SobjectType != null`
    );

    objectPerms.records.forEach((record) => {
      if (record.SobjectType) {
        const permission: PermissionData = {
          type: 'Object Permission',
          name: record.SobjectType,
          read: record.PermissionsRead ? 'Yes' : '',
          create: record.PermissionsCreate ? 'Yes' : '',
          edit: record.PermissionsEdit ? 'Yes' : '',
          delete: record.PermissionsDelete ? 'Yes' : '',
          viewAll: record.PermissionsViewAllRecords ? 'Yes' : '',
          modifyAll: record.PermissionsModifyAllRecords ? 'Yes' : '',
          permission: '',
        };

        // Only include if it's not an ID-based component
        if (!PermissionSetsCompare.shouldIgnoreComponent(permission)) {
          permissions.push(permission);
        }
      }
    });

    // Get field permissions
    const fieldPerms = await connection.query<FieldPermissionRecord>(
      `SELECT Field, SobjectType, PermissionsRead, PermissionsEdit 
       FROM FieldPermissions 
       WHERE ParentId IN (SELECT Id FROM PermissionSet WHERE Name = '${permissionSetName}')`
    );

    fieldPerms.records.forEach((record) => {
      const fieldNameOnly = record.Field.startsWith(`${record.SobjectType}.`)
        ? record.Field.substring(record.SobjectType.length + 1)
        : record.Field;
      const fieldName = `${record.SobjectType}.${fieldNameOnly}`;

      const permission: PermissionData = {
        type: 'Field Permission',
        name: fieldName,
        read: record.PermissionsRead ? 'Yes' : '',
        edit: record.PermissionsEdit ? 'Yes' : '',
        create: '',
        delete: '',
        viewAll: '',
        modifyAll: '',
        permission: '',
      };

      // Only include if it's not an ID-based component
      if (!PermissionSetsCompare.shouldIgnoreComponent(permission)) {
        permissions.push(permission);
      }
    });

    // Get system permissions
    const systemPerms = await connection.query<SystemPermissionRecord>(
      `SELECT SetupEntityId, SetupEntityType 
       FROM SetupEntityAccess 
       WHERE ParentId IN (SELECT Id FROM PermissionSet WHERE Name = '${permissionSetName}')`
    );

    systemPerms.records.forEach((record) => {
      const permission: PermissionData = {
        type: 'System Permission',
        name: record.SetupEntityId,
        read: '',
        create: '',
        edit: '',
        delete: '',
        viewAll: '',
        modifyAll: '',
        permission: 'Yes',
      };

      // Only include if it's not an ID-based component
      if (!PermissionSetsCompare.shouldIgnoreComponent(permission)) {
        permissions.push(permission);
      }
    });

    return permissions;
  }

  private createComparisonWorksheet(
    workbook: XLSX.WorkBook,
    permissionSetName: string,
    differences: PermissionDifference[],
    sourceOrgAlias: string,
    targetOrgAlias: string
  ): void {
    const headerRow = ['Permission Type', 'Component Name', 'Property', `Source Value (${sourceOrgAlias})`, `Target Value (${targetOrgAlias})`, 'Difference Type'];
    const worksheet = XLSX.utils.aoa_to_sheet([headerRow]);

    const dataRows = differences.map(diff => [
      diff.type,
      diff.name,
      diff.property,
      diff.sourceValue,
      diff.targetValue,
      diff.differenceType
    ]);

    XLSX.utils.sheet_add_aoa(worksheet, dataRows, { origin: 'A2' });
    PermissionSetsCompare.applyExcelFormatting(worksheet);

    // Ensure worksheet name is unique and within Excel limits
    let sheetName = permissionSetName.substring(0, 31);
    let counter = 1;

    // Check if worksheet already exists and create unique name if needed
    while (workbook.SheetNames.includes(sheetName)) {
      const suffix = `_${counter}`;
      const maxLength = 31 - suffix.length;
      sheetName = `${permissionSetName.substring(0, maxLength)}${suffix}`;
      counter++;
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  private createSummaryWorksheet(
    workbook: XLSX.WorkBook,
    comparisons: PermissionSetComparison[],
    onlyInSource: PermissionSetRecord[],
    onlyInTarget: PermissionSetRecord[],
    sourceOrgAlias: string,
    targetOrgAlias: string,
    totalCompared: number,
    similarCount: number,
    similarNames: string[]
  ): void {
    const summaryData: string[][] = [
      ['Permission Sets Comparison Summary', '', '', '', ''],
      ['', '', '', '', ''],
      ['Source Org:', sourceOrgAlias, '', '', ''],
      ['Target Org:', targetOrgAlias, '', '', ''],
      ['Comparison Date:', new Date().toLocaleString(), '', '', ''],
      ['', '', '', '', ''],
      ['Note: Components with ID-like names are automatically excluded from comparison', '', '', '', ''],
      ['as IDs are expected to differ between orgs.', '', '', '', ''],
      ['', '', '', '', ''],
      ['📊 PERMISSION SETS WITH DIFFERENCES (Detailed tabs created)', '', '', '', ''],
      ['Permission Set Name', 'Differences Count', 'Status', '', '']
    ];

    if (comparisons.length > 0) {
      comparisons.forEach(comp => {
        summaryData.push([comp.permissionSetName, String(comp.differences.length), 'See detailed tab', '', '']);
      });
    } else {
      summaryData.push(['(No permission sets have differences)', '', '', '', '']);
    }

    summaryData.push(['', '', '', '', '']);
    summaryData.push(['✅ SIMILAR PERMISSION SETS (No Differences)', '', '', '', '']);
    summaryData.push(['Permission Set Name', 'Status', '', '', '']);

    if (similarCount > 0) {
      similarNames.forEach(name => {
        summaryData.push([name, 'Identical in both orgs', '', '', '']);
      });
    } else {
      summaryData.push(['(All compared permission sets have differences)', '', '', '', '']);
    }

    summaryData.push(['', '', '', '', '']);
    summaryData.push(['🚫 PERMISSION SETS MISSING IN TARGET ORG', '', '', '', '']);
    summaryData.push(['Permission Set Name', 'Missing From', 'Action Required', '', '']);

    if (onlyInSource.length > 0) {
      onlyInSource.forEach(ps => {
        summaryData.push([ps.Name, targetOrgAlias, 'Deploy to target or remove from source', '', '']);
      });
    } else {
      summaryData.push(['(All source permission sets exist in target)', '', '', '', '']);
    }

    summaryData.push(['', '', '', '', '']);
    summaryData.push(['➕ PERMISSION SETS MISSING IN SOURCE ORG', '', '', '', '']);
    summaryData.push(['Permission Set Name', 'Missing From', 'Action Required', '', '']);

    if (onlyInTarget.length > 0) {
      onlyInTarget.forEach(ps => {
        summaryData.push([ps.Name, sourceOrgAlias, 'Deploy to source or remove from target', '', '']);
      });
    } else {
      summaryData.push(['(All target permission sets exist in source)', '', '', '', '']);
    }

    summaryData.push(['', '', '', '', '']);
    summaryData.push(['📈 SUMMARY STATISTICS', '', '', '', '']);
    summaryData.push(['Total Permission Sets Compared:', String(totalCompared), '', '', '']);
    summaryData.push(['Permission Sets with Differences:', String(comparisons.length), '', '', '']);
    summaryData.push(['Similar Permission Sets (No Differences):', String(similarCount), '', '', '']);
    summaryData.push(['Permission Sets Only in Source:', String(onlyInSource.length), '', '', '']);
    summaryData.push(['Permission Sets Only in Target:', String(onlyInTarget.length), '', '', '']);

    const worksheet = XLSX.utils.aoa_to_sheet(summaryData);

    // Set column widths for better readability
    worksheet['!cols'] = [
      { width: 40 }, // Permission Set Name / Description
      { width: 20 }, // Count / Missing From
      { width: 35 }, // Status / Action Required
      { width: 10 }, // Empty
      { width: 10 }, // Empty
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Summary', true);
  }
} 