/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/member-ordering */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { LeadUIExtractor, LeadRecordData } from '../../import/wbook/ui/leadUIExtractor.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf_workbook', 'jz.uicompare');

export type UICompareResult = {
  recordId: string;
  recordUrl: string;
  sectionsFound: number;
  fieldsExtracted: number;
  exportPath: string;
  fileName: string;
  capturedAt: string;
};

export default class UICompare extends SfCommand<UICompareResult> {
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
    'wait-time': Flags.integer({
      char: 'w',
      summary: messages.getMessage('flags.wait-time.summary'),
      description: messages.getMessage('flags.wait-time.description'),
      default: 10,
      min: 5,
      max: 60,
    }),
    'dry-run': Flags.boolean({
      char: 'r',
      summary: messages.getMessage('flags.dry-run.summary'),
      description: messages.getMessage('flags.dry-run.description'),
      default: false,
    }),
    'headless': Flags.boolean({
      char: 'e',
      summary: messages.getMessage('flags.headless.summary'),
      description: messages.getMessage('flags.headless.description'),
      default: false,
    }),
  };

  public async run(): Promise<UICompareResult> {
    const { flags } = await this.parse(UICompare);
    const connection = flags['target-org'].getConnection();
    const orgAlias = flags['target-org'].getUsername() ?? 'default';
    const orgId = flags['target-org'].getOrgId();

    this.log(`🚀 Starting UI Compare for org: ${orgAlias} (${orgId})`);

    // Handle dry-run mode
    if (flags['dry-run']) {
      this.log('📋 DRY-RUN MODE: No browser automation will be performed');
      this.log('🎯 Target: First Lead record UI extraction');
      this.log(`📁 Export directory: ${flags['output-dir']}/UICompare/`);
      this.log(`⏱️  Wait time: ${flags['wait-time']} seconds`);
      this.log(`🖥️  Headless mode: ${flags.headless ? 'enabled' : 'disabled'}`);

      const mockResult: UICompareResult = {
        recordId: 'DRY_RUN_MODE',
        recordUrl: 'https://example.salesforce.com/00Q000000000000',
        sectionsFound: 0,
        fieldsExtracted: 0,
        exportPath: path.join(flags['output-dir'], 'UICompare', 'dry-run.json'),
        fileName: 'dry-run.json',
        capturedAt: new Date().toISOString(),
      };

      this.log('✅ Dry-run completed successfully');
      return mockResult;
    }

    // Setup export directory
    const exportDir = this.setupExportDirectory(flags['output-dir']);
    this.log(`📁 Export directory prepared: ${exportDir}`);

    // Get next incremental file number
    const { fileName, filePath } = UICompare.getNextFileName(exportDir);
    this.log(`📄 Target file: ${fileName}`);

    try {
      // Initialize UI extractor
      this.log('🔧 Initializing browser automation...');
      const extractor = new LeadUIExtractor(orgAlias, connection, {
        waitTime: flags['wait-time'],
        headless: flags.headless,
      });

      // Extract lead record data
      this.log('🌐 Starting Salesforce UI automation...');
      const leadData = await extractor.extractFirstLeadRecord();

      // Export to JSON
      this.log('💾 Exporting data to JSON...');
      const jsonContent = JSON.stringify(leadData, null, 2);
      fs.writeFileSync(filePath, jsonContent, 'utf8');

      this.log('✅ UI Compare completed successfully!');
      this.log(`📊 Data extracted: ${leadData.sections.length} sections, ${UICompare.countTotalFields(leadData)} fields`);
      this.log(`📁 Exported to: ${fileName}`);

      return {
        recordId: leadData.recordId,
        recordUrl: leadData.recordUrl,
        sectionsFound: leadData.sections.length,
        fieldsExtracted: UICompare.countTotalFields(leadData),
        exportPath: filePath,
        fileName,
        capturedAt: leadData.capturedAt,
      };
    } catch (error) {
      this.log(`❌ UI Compare failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private static getNextFileName(exportDir: string): { fileName: string; filePath: string } {
    let fileNumber = 1;
    let fileName = `${fileNumber}.json`;
    let filePath = path.join(exportDir, fileName);

    // Find next available incremental number
    while (fs.existsSync(filePath)) {
      fileNumber++;
      fileName = `${fileNumber}.json`;
      filePath = path.join(exportDir, fileName);
    }

    return { fileName, filePath };
  }

  private static countTotalFields(leadData: LeadRecordData): number {
    return leadData.sections.reduce((total, section) => total + section.fields.length, 0);
  }

  private setupExportDirectory(baseDir: string): string {
    const exportDir = path.join(baseDir, 'UICompare');

    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
      this.log(`📁 Created export directory: ${exportDir}`);
    }

    return exportDir;
  }
} 