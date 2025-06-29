/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf_workbook', 'jz.emailtemplates');

export type EmailTemplatesResult = {
  totalTemplates: number;
  packageXmlPath: string;
  templatesFound: Array<{
    id: string;
    developerName: string;
    name: string;
    templateType: string;
    folderName?: string;
    fullyQualifiedName: string;
  }>;
};

type EmailTemplateRecord = {
  Id: string;
  DeveloperName: string;
  Name: string;
  TemplateType: string;
  IsActive: boolean;
  Subject?: string;
  FolderId?: string;
  Folder?: {
    DeveloperName?: string;
    Name?: string;
  };
};

export default class EmailTemplates extends SfCommand<EmailTemplatesResult> {
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
    'include-inactive': Flags.boolean({
      char: 'i',
      summary: messages.getMessage('flags.include-inactive.summary'),
      description: messages.getMessage('flags.include-inactive.description'),
      default: false,
    }),
    'template-types': Flags.string({
      char: 't',
      summary: messages.getMessage('flags.template-types.summary'),
      description: messages.getMessage('flags.template-types.description'),
      required: false,
    }),
    'dry-run': Flags.boolean({
      char: 'r',
      summary: messages.getMessage('flags.dry-run.summary'),
      description: messages.getMessage('flags.dry-run.description'),
      default: false,
    }),
  };

  private static generatePackageXml(templates: EmailTemplateRecord[]): string {
    const templateEntries = templates
      .map(template => {
        // Create fully qualified name with folder
        const folderName = template.Folder?.DeveloperName ?? template.Folder?.Name ?? 'unfiled$public';
        const fullyQualifiedName = `${folderName}/${template.DeveloperName}`;
        return `        <members>${fullyQualifiedName}</members>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
${templateEntries}
        <name>EmailTemplate</name>
    </types>
    <version>58.0</version>
</Package>`;
  }

  public async run(): Promise<EmailTemplatesResult> {
    const { flags } = await this.parse(EmailTemplates);
    const connection = flags['target-org'].getConnection();
    const orgAlias = flags['target-org'].getUsername() ?? 'default';
    const orgId = flags['target-org'].getOrgId();

    this.log(`📡 Connected to org: ${orgAlias} (${String(orgId)})`);

    // Get all email templates
    const templates = await this.getEmailTemplates(
      connection,
      flags['include-inactive'],
      flags['template-types']
    );

    if (templates.length === 0) {
      this.log('⚠️ No email templates found matching the criteria.');
      return {
        totalTemplates: 0,
        packageXmlPath: '',
        templatesFound: []
      };
    }

    this.log(`✅ Found ${templates.length} email templates`);

    // Log sample of fully qualified names for user awareness
    if (templates.length > 0) {
      this.log('📋 Sample fully qualified names (folder/template):');
      const sampleTemplates = templates.slice(0, 5);
      sampleTemplates.forEach(template => {
        const folderName = template.Folder?.DeveloperName ?? template.Folder?.Name ?? 'unfiled$public';
        const fullyQualifiedName = `${folderName}/${template.DeveloperName}`;
        this.log(`   ${fullyQualifiedName}`);
      });
      if (templates.length > 5) {
        this.log(`   ... and ${templates.length - 5} more templates`);
      }
    }

    // Generate package.xml content
    const packageXmlContent = EmailTemplates.generatePackageXml(templates);

    if (flags['dry-run']) {
      this.log('🔍 DRY-RUN MODE - Package.xml content:');
      this.log('================================');
      this.log(packageXmlContent);
      this.log('================================');

      return {
        totalTemplates: templates.length,
        packageXmlPath: '[DRY-RUN] - No file created',
        templatesFound: templates.map(t => {
          const folderName = t.Folder?.DeveloperName ?? t.Folder?.Name ?? 'unfiled$public';
          return {
            id: t.Id,
            developerName: t.DeveloperName,
            name: t.Name,
            templateType: t.TemplateType,
            folderName,
            fullyQualifiedName: `${folderName}/${t.DeveloperName}`
          };
        })
      };
    }

    // Setup export directory
    const exportBaseDir = path.join(flags['output-dir'], 'EmailTemplates', String(orgId));
    if (!fs.existsSync(exportBaseDir)) {
      fs.mkdirSync(exportBaseDir, { recursive: true });
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
    const packageXmlFileName = `package_EmailTemplates_${timestamp}.xml`;
    const packageXmlPath = path.join(exportBaseDir, packageXmlFileName);

    // Write package.xml file
    fs.writeFileSync(packageXmlPath, packageXmlContent, 'utf8');
    this.log(`✅ Package.xml generated: ${packageXmlPath}`);

    return {
      totalTemplates: templates.length,
      packageXmlPath,
      templatesFound: templates.map(t => {
        const folderName = t.Folder?.DeveloperName ?? t.Folder?.Name ?? 'unfiled$public';
        return {
          id: t.Id,
          developerName: t.DeveloperName,
          name: t.Name,
          templateType: t.TemplateType,
          folderName,
          fullyQualifiedName: `${folderName}/${t.DeveloperName}`
        };
      })
    };
  }

  private async getEmailTemplates(
    connection: unknown,
    includeInactive: boolean,
    templateTypes?: string
  ): Promise<EmailTemplateRecord[]> {
    this.log('🔍 Querying email templates from the org...');

    let whereClause = '';
    if (!includeInactive) {
      whereClause = 'WHERE IsActive = true';
    }

    if (templateTypes?.trim()) {
      const types = templateTypes.split(',').map(type => `'${type.trim()}'`).join(',');
      const typeFilter = `TemplateType IN (${types})`;
      whereClause = whereClause ? `${whereClause} AND ${typeFilter}` : `WHERE ${typeFilter}`;
    }

    const query = `SELECT Id, DeveloperName, Name, TemplateType, IsActive, Subject, FolderId, Folder.DeveloperName, Folder.Name FROM EmailTemplate ${whereClause} ORDER BY TemplateType, DeveloperName`;
    this.log(`📝 SOQL Query: ${query}`);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (connection as any).query(query);
      const templates = result.records as EmailTemplateRecord[];

      this.log(`Found ${templates.length} email templates`);
      return templates.filter(t => t.DeveloperName && t.TemplateType);
    } catch (error) {
      this.log(`❌ Failed to query email templates: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

} 