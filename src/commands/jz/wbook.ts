import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf_workbook', 'jz.wbook');

export type SObjectField = {
  name: string;
  label: string;
  type: string;
  description?: string;
  helpText?: string;
  picklistValues?: string[];
  formula?: string;
  length?: number;
  required?: boolean;
};

export type SObjectMetadata = { name: string; fields: SObjectField[] };
export type ExportResult = void;

// Centralized Excel Styling Configuration
class ExcelStyleConfig {
  static headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 14 },
    fill: { fgColor: { rgb: '4F81BD' } },
    alignment: { horizontal: 'center' },
  };
}

export default class WBook extends SfCommand<ExportResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg(),
    'objects': Flags.string({
      char: 'e',
      description: 'Comma-separated list of objects to export. If empty, exports first 5 objects.',
      required: false,
    }),
  };

  public async run(): Promise<ExportResult> {
    const { flags } = await this.parse(WBook);
    const connection = flags['target-org'].getConnection();
    this.log(`Connected to ${flags['target-org'].getUsername()} with API version ${connection.version}`);

    // Fetch all objects
    const sObjectsMetadata = await connection.describeGlobal();
    let objectList: string[];

    if (flags.objects) {
      objectList = flags.objects.split(',').map(obj => obj.trim());
    } else {
      objectList = sObjectsMetadata.sobjects.slice(0, 5).map(obj => obj.name);
    }

    this.log(`Processing ${objectList.length} objects. Fetching field metadata...`);

    const workbook = XLSX.utils.book_new();

    for (const objectName of objectList) {
      try {
        const metadata = await connection.sobject(objectName).describe();
        const fields = metadata.fields.map(field => ({
          name: field.name,
          label: field.label,
          type: field.type,
          description: field.inlineHelpText || '',
          helpText: field.inlineHelpText || '',
          picklistValues: field.picklistValues ? field.picklistValues.map(pv => pv.label) : [],
          formula: field.calculatedFormula || '',
          length: field.length,
          required: field.nillable === false,
        }));

        // Create worksheet and add headers
        const headerRow = Object.keys(fields[0] || []);
        const worksheet = XLSX.utils.aoa_to_sheet([headerRow]); // Adds header row

        // Append the rest of the data
        XLSX.utils.sheet_add_json(worksheet, fields, { origin: 'A2', skipHeader: true });

        // Apply styling to headers
        headerRow.forEach((_, colIdx) => {
          const cellAddress = XLSX.utils.encode_cell({ r: 0, c: colIdx });
          if (!worksheet[cellAddress]) worksheet[cellAddress] = { t: 's', v: headerRow[colIdx] };
          worksheet[cellAddress].s = ExcelStyleConfig.headerStyle;
        });

        XLSX.utils.book_append_sheet(workbook, worksheet, objectName.substring(0, 31)); // Excel sheet names max 31 chars
      } catch (error) {
        if (error instanceof Error) {
          this.log(`Skipping ${objectName} due to error: ${error.message}`);
        } else {
          this.log(`Skipping ${objectName} due to an unknown error`);
        }
      }
    }

    // Ensure Exports directory exists
    const exportDir = path.join(process.cwd(), 'Exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Write to file
    const fileName = path.join(exportDir, `Salesforce_Metadata_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`);
    XLSX.writeFile(workbook, fileName);
    this.log(`Metadata exported to ${fileName}`);
  }
}
