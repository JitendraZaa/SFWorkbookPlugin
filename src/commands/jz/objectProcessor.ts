import { Connection } from '@salesforce/core';
import * as XLSX from 'xlsx';

export interface PicklistValue {
  label: string;
  value: string;
}

export interface SalesforceField {
  name: string;
  label: string;
  type: string;
  inlineHelpText?: string | null;
  calculatedFormula?: string | null;
  length?: number;
  nillable: boolean;
  picklistValues?: PicklistValue[] | null;
}

export type SObjectField = {
  name: string;
  label: string;
  type: string;
  description?: string;
  helpText?: string;
  picklistValues?: string;
  formula?: string;
  length?: number;
  required?: boolean;
};

export type SObjectMetadata = {
  name: string;
  fields: SObjectField[];
};

export class ObjectProcessor {
  private connection: Connection;
  private logger: (message: string) => void;

  public constructor(connection: Connection, logger: (message: string) => void) {
    this.connection = connection;
    this.logger = logger;
  }

  public async processObjects(
    objectsFlag: string | undefined,
    workbook: XLSX.WorkBook
  ): Promise<void> {
    this.logger('DEBUG: Checking objects flag...');
    if (objectsFlag !== undefined) {
      this.logger(`DEBUG: objects flag is defined: '${objectsFlag}'`);
      let objectList: string[];

      if (objectsFlag?.trim()) {
        this.logger(`DEBUG: objects has content after trim: '${objectsFlag.trim()}'`);
        objectList = objectsFlag.split(',').map(obj => obj.trim()).filter(obj => obj.length > 0);
        this.logger(`DEBUG: Parsed specific objects: [${objectList.join(', ')}]`);
      } else {
        this.logger('DEBUG: objects is empty/whitespace, querying all objects');
        // Fetch all objects
        const sObjectsMetadata = await this.connection.describeGlobal();
        objectList = sObjectsMetadata.sobjects.map(obj => obj.name);
        this.logger(`DEBUG: Found ${objectList.length} total objects`);
      }

      this.logger(`Processing ${objectList.length} objects. Fetching field metadata...`);

      // Process objects in parallel
      await Promise.all(objectList.map(async (objectName) => {
        await this.processIndividualObject(objectName, workbook);
      }));
    } else {
      this.logger('DEBUG: objects flag is undefined, skipping object export');
    }
  }

  private async processIndividualObject(
    objectName: string,
    workbook: XLSX.WorkBook
  ): Promise<void> {
    try {
      const metadata = await this.connection.sobject(objectName).describe();
      const fields = metadata.fields.map((field: SalesforceField) => {
        // Process picklist values into a readable string format
        let picklistString = '';
        if (field.picklistValues && field.picklistValues.length > 0) {
          picklistString = field.picklistValues.map((pv: PicklistValue) => `${pv.label} (${pv.value})`).join('; ');
          // Log picklist fields for debugging
          if (field.type === 'picklist' || field.type === 'multipicklist') {
            this.logger(`DEBUG: Found picklist field ${field.name} with ${field.picklistValues.length} values: ${picklistString.substring(0, 100)}${picklistString.length > 100 ? '...' : ''}`);
          }
        }

        return {
          name: field.name,
          label: field.label,
          type: field.type,
          description: field.inlineHelpText ?? '',
          helpText: field.inlineHelpText ?? '',
          picklistValues: picklistString,
          formula: field.calculatedFormula ?? '',
          length: field.length,
          required: field.nillable === false,
        };
      });

      if (fields.length > 0) {
        // Create worksheet and add headers
        const headerRow = Object.keys(fields[0] || []);
        const worksheet = XLSX.utils.aoa_to_sheet([headerRow]);

        // Append the rest of the data
        XLSX.utils.sheet_add_json(worksheet, fields, { origin: 'A2', skipHeader: true });

        // Apply Excel formatting
        this.applyExcelFormatting(worksheet);

        XLSX.utils.book_append_sheet(workbook, worksheet, objectName.substring(0, 31));
        this.logger(`Created worksheet for object: ${objectName} with ${fields.length} fields`);
      } else {
        this.logger(`Skipped creating worksheet for object: ${objectName} - no fields found`);
      }
    } catch (error) {
      if (error instanceof Error) {
        this.logger(`Skipping ${objectName} due to error: ${error.message}`);
      } else {
        this.logger(`Skipping ${objectName} due to an unknown error`);
      }
    }
  }

  private applyExcelFormatting(worksheet: XLSX.WorkSheet): void {
    // Set column widths for better readability
    const cols = [
      { wch: 25 }, // name
      { wch: 30 }, // label
      { wch: 15 }, // type
      { wch: 40 }, // description
      { wch: 40 }, // helpText
      { wch: 30 }, // picklistValues
      { wch: 30 }, // formula
      { wch: 10 }, // length
      { wch: 12 }  // required
    ];

    // Apply column widths
    Object.defineProperty(worksheet, '!cols', {
      value: cols,
      writable: true
    });

    this.logger('Applied Excel formatting: optimized column widths for object fields');
  }
} 