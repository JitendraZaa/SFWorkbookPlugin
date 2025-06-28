import * as fs from 'node:fs';
import * as path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import * as XLSX from 'xlsx';

import { ObjectProcessor } from '../../import/wbook/objects/objectProcessor.js';


Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf_workbook', 'jz.wbook');

export type ExportResult = void;

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
      summary: 'List of objects to export'
    }),


  };

  public async run(): Promise<ExportResult> {
    const { flags } = await this.parse(WBook);
    const connection = flags['target-org'].getConnection();
    this.log(`Connected to ${flags['target-org'].getUsername()} with API version ${connection.version}`);

    // Debug logging for flags
    this.log(`DEBUG: flags.objects = ${flags.objects ? `'${flags.objects}'` : 'undefined'}`);

    const workbook = XLSX.utils.book_new();

    // Handle object metadata export
    const objectProcessor = new ObjectProcessor(connection, this.log.bind(this));
    await objectProcessor.processObjects(flags.objects, workbook);



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
