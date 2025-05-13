import * as fs from 'node:fs';
import * as path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import * as XLSX from 'xlsx';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf_workbook', 'jz.wbook');

interface PicklistValue {
  label: string;
  value: string;
}

interface SalesforceField {
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
  picklistValues?: PicklistValue[];
  formula?: string;
  length?: number;
  required?: boolean;
};

export type SObjectMetadata = { name: string; fields: SObjectField[] };
export type ExportResult = void;

export type PermissionSetMetadata = {
  type: string;
  name: string;
  permission: string;
};

interface PermissionSetRecord {
  Name: string;
}

interface ObjectPermissionRecord {
  SObjectType: string;
  PermissionsRead: boolean;
  PermissionsCreate: boolean;
  PermissionsEdit: boolean;
  PermissionsDelete: boolean;
  PermissionsViewAllRecords: boolean;
  PermissionsModifyAllRecords: boolean;
}

interface FieldPermissionRecord {
  Field: string;
  SObjectType: string;
  PermissionsRead: boolean;
  PermissionsEdit: boolean;
}

interface SystemPermissionRecord {
  SetupEntityId: string;
  SetupEntityType: string;
}

// Centralized Excel Styling Configuration

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
    'permission-sets': Flags.string({
      char: 'p',
      description: 'Comma-separated list of permission sets to export. If empty, exports all permission sets.',
      required: false,
      summary: 'List of permission sets to export'
    }),
  };

  public async run(): Promise<ExportResult> {
    const { flags } = await this.parse(WBook);
    const connection = flags['target-org'].getConnection();
    this.log(`Connected to ${flags['target-org'].getUsername()} with API version ${connection.version}`);

    const workbook = XLSX.utils.book_new();

    // Handle object metadata export
    if (flags.objects) {
      // Fetch all objects
      const sObjectsMetadata = await connection.describeGlobal();
      let objectList: string[];

      if (flags.objects) {
        objectList = flags.objects.split(',').map(obj => obj.trim());
      } else {
        objectList = sObjectsMetadata.sobjects.slice(0, 5).map(obj => obj.name);
      }

      this.log(`Processing ${objectList.length} objects. Fetching field metadata...`);

      // Process objects in parallel
      await Promise.all(objectList.map(async (objectName) => {
        try {
          const metadata = await connection.sobject(objectName).describe();
          const fields = metadata.fields.map((field: SalesforceField) => ({
            name: field.name,
            label: field.label,
            type: field.type,
            description: field.inlineHelpText ?? '',
            helpText: field.inlineHelpText ?? '',
            picklistValues: field.picklistValues ? field.picklistValues.map((pv: PicklistValue) => ({
              label: pv.label,
              value: pv.value
            })) : [],
            formula: field.calculatedFormula ?? '',
            length: field.length,
            required: field.nillable === false,
          }));

          // Create worksheet and add headers
          const headerRow = Object.keys(fields[0] || []);
          const worksheet = XLSX.utils.aoa_to_sheet([headerRow]);

          // Append the rest of the data
          XLSX.utils.sheet_add_json(worksheet, fields, { origin: 'A2', skipHeader: true });
          XLSX.utils.book_append_sheet(workbook, worksheet, objectName.substring(0, 31));
        } catch (error) {
          if (error instanceof Error) {
            this.log(`Skipping ${objectName} due to error: ${error.message}`);
          } else {
            this.log(`Skipping ${objectName} due to an unknown error`);
          }
        }
      }));
    }

    // Handle permission set metadata export
    if (flags['permission-sets']) {
      let permissionSetList: string[];

      if (flags['permission-sets']) {
        permissionSetList = flags['permission-sets'].split(',').map(ps => ps.trim());
      } else {
        // Query all permission sets
        const result = await connection.query<PermissionSetRecord>('SELECT Name FROM PermissionSet');
        permissionSetList = result.records.map(record => record.Name);
      }

      this.log(`Processing ${permissionSetList.length} permission sets...`);

      // Process permission sets in parallel
      await Promise.all(permissionSetList.map(async (permSetName) => {
        try {
          const permissions: PermissionSetMetadata[] = [];

          // Query object permissions
          const objectPerms = await connection.query<ObjectPermissionRecord>(
            `SELECT SObjectType, PermissionsRead, PermissionsCreate, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords 
             FROM ObjectPermissions 
             WHERE ParentId IN (SELECT Id FROM PermissionSet WHERE Name = '${permSetName}')
             AND SObjectType != null`
          );

          this.log(`Found ${objectPerms.records.length} object permissions for ${permSetName}`);

          objectPerms.records.forEach((record) => {
            if (!record.SObjectType) {
              this.log(`Warning: Found object permission with undefined SObjectType in ${permSetName}`);
              return;
            }

            const objectName = record.SObjectType;
            if (record.PermissionsRead) permissions.push({ type: 'Object Permission', name: `Object: ${objectName}`, permission: 'Read' });
            if (record.PermissionsCreate) permissions.push({ type: 'Object Permission', name: `Object: ${objectName}`, permission: 'Create' });
            if (record.PermissionsEdit) permissions.push({ type: 'Object Permission', name: `Object: ${objectName}`, permission: 'Edit' });
            if (record.PermissionsDelete) permissions.push({ type: 'Object Permission', name: `Object: ${objectName}`, permission: 'Delete' });
            if (record.PermissionsViewAllRecords) permissions.push({ type: 'Object Permission', name: `Object: ${objectName}`, permission: 'View All Records' });
            if (record.PermissionsModifyAllRecords) permissions.push({ type: 'Object Permission', name: `Object: ${objectName}`, permission: 'Modify All Records' });
          });

          // Query field permissions
          const fieldPerms = await connection.query<FieldPermissionRecord>(
            `SELECT Field, SObjectType, PermissionsRead, PermissionsEdit 
             FROM FieldPermissions 
             WHERE ParentId IN (SELECT Id FROM PermissionSet WHERE Name = '${permSetName}')`
          );

          fieldPerms.records.forEach((record) => {
            if (record.PermissionsRead) permissions.push({ type: 'Field Permission', name: `${record.SObjectType}.${record.Field}`, permission: 'Read' });
            if (record.PermissionsEdit) permissions.push({ type: 'Field Permission', name: `${record.SObjectType}.${record.Field}`, permission: 'Edit' });
          });

          // Query system permissions
          const systemPerms = await connection.query<SystemPermissionRecord>(
            `SELECT SetupEntityId, SetupEntityType 
             FROM SetupEntityAccess 
             WHERE ParentId IN (SELECT Id FROM PermissionSet WHERE Name = '${permSetName}')`
          );

          // Process each permission based on its type
          const permissionPromises = systemPerms.records.map(async (record) => {
            let permissionName = record.SetupEntityId;

            try {
              let queryResult;
              switch (record.SetupEntityType) {
                case 'ApexClass':
                  queryResult = await connection.query(`SELECT Name FROM ApexClass WHERE Id = '${record.SetupEntityId}'`);
                  if (queryResult.records.length > 0) {
                    permissionName = `Apex Class: ${queryResult.records[0].Name}`;
                  }
                  break;
                case 'ApexPage':
                  queryResult = await connection.query(`SELECT Name FROM ApexPage WHERE Id = '${record.SetupEntityId}'`);
                  if (queryResult.records.length > 0) {
                    permissionName = `Visualforce Page: ${queryResult.records[0].Name}`;
                  }
                  break;
                case 'CustomPermission':
                  queryResult = await connection.query(`SELECT MasterLabel FROM CustomPermission WHERE Id = '${record.SetupEntityId}'`);
                  if (queryResult.records.length > 0) {
                    permissionName = `Custom Permission: ${queryResult.records[0].MasterLabel}`;
                  }
                  break;
                case 'FlowDefinition':
                  queryResult = await connection.query(`SELECT MasterLabel FROM FlowDefinitionView WHERE Id = '${record.SetupEntityId}'`);
                  if (queryResult.records.length > 0) {
                    permissionName = `Flow: ${queryResult.records[0].MasterLabel}`;
                  }
                  break;
                case 'TabSet':
                  queryResult = await connection.query(`SELECT Name FROM TabDefinition WHERE Id = '${record.SetupEntityId}'`);
                  if (queryResult.records.length > 0) {
                    permissionName = `App: ${queryResult.records[0].Name}`;
                  }
                  break;
                case 'CustomEntityDefinition':
                  queryResult = await connection.query(`SELECT QualifiedApiName FROM CustomEntityDefinition WHERE Id = '${record.SetupEntityId}'`);
                  if (queryResult.records.length > 0) {
                    permissionName = `Custom Setting/Metadata: ${queryResult.records[0].QualifiedApiName}`;
                  }
                  break;
                default:
                  // For other types, use the type name and ID
                  permissionName = `${record.SetupEntityType}: ${record.SetupEntityId}`;
              }
            } catch (error) {
              // If query fails, use the type and ID as fallback
              permissionName = `${record.SetupEntityType}: ${record.SetupEntityId}`;
            }

            return { type: 'System Permission', name: permissionName, permission: 'Enabled' };
          });

          // Wait for all permission queries to complete
          const permissionResults = await Promise.all(permissionPromises);
          permissions.push(...permissionResults);

          // Create worksheet for this permission set
          const headerRow = ['Type', 'Object/Field/System Permission', 'Permission'];
          const worksheet = XLSX.utils.aoa_to_sheet([headerRow]);
          XLSX.utils.sheet_add_json(worksheet, permissions, { origin: 'A2', skipHeader: true });
          XLSX.utils.book_append_sheet(workbook, worksheet, permSetName.substring(0, 31));

        } catch (error) {
          if (error instanceof Error) {
            this.log(`Skipping permission set ${permSetName} due to error: ${error.message}`);
          } else {
            this.log(`Skipping permission set ${permSetName} due to an unknown error`);
          }
        }
      }));
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
