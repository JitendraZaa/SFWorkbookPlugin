import { Connection } from '@salesforce/core';
import * as XLSX from 'xlsx';

// Interfaces for permission set processing
export interface PermissionSetRecord {
  Name: string;
}

export interface ObjectPermissionRecord {
  SobjectType: string;
  PermissionsRead: boolean;
  PermissionsCreate: boolean;
  PermissionsEdit: boolean;
  PermissionsDelete: boolean;
  PermissionsViewAllRecords: boolean;
  PermissionsModifyAllRecords: boolean;
}

export interface FieldPermissionRecord {
  Field: string;
  SobjectType: string;
  PermissionsRead: boolean;
  PermissionsEdit: boolean;
}

export interface SystemPermissionRecord {
  SetupEntityId: string;
  SetupEntityType: string;
}

export interface EntityRecord {
  Id: string;
  Name?: string;
  MasterLabel?: string;
  QualifiedApiName?: string;
}

export type PermissionSetMetadata = {
  type: string;
  name: string;
  read?: string;
  create?: string;
  edit?: string;
  delete?: string;
  viewAll?: string;
  modifyAll?: string;
  permission?: string; // For system permissions
};

export class PermissionSetProcessor {
  private connection: Connection;
  private logger: (message: string) => void;

  public constructor(connection: Connection, logger: (message: string) => void) {
    this.connection = connection;
    this.logger = logger;
  }

  public async processPermissionSets(
    permissionSetsFlag: string | undefined,
    workbook: XLSX.WorkBook
  ): Promise<void> {
    this.logger('DEBUG: Checking permission-sets flag...');
    if (permissionSetsFlag !== undefined) {
      this.logger(`DEBUG: permission-sets flag is defined: '${permissionSetsFlag}'`);
      let permissionSetList: string[];

      if (permissionSetsFlag?.trim()) {
        this.logger(`DEBUG: permission-sets has content after trim: '${permissionSetsFlag.trim()}'`);
        permissionSetList = permissionSetsFlag.split(',').map(ps => ps.trim()).filter(ps => ps.length > 0);
        this.logger(`DEBUG: Parsed specific permission sets: [${permissionSetList.join(', ')}]`);
      } else {
        this.logger('DEBUG: permission-sets is empty/whitespace, querying all permission sets');
        // Query all permission sets
        const result = await this.connection.query<PermissionSetRecord>('SELECT Name FROM PermissionSet');
        permissionSetList = result.records.map(record => record.Name);
        this.logger(`DEBUG: Found ${permissionSetList.length} total permission sets`);
      }

      this.logger(`Processing ${permissionSetList.length} permission sets...`);

      // Process permission sets in parallel
      await Promise.all(permissionSetList.map(async (permSetName) => {
        try {
          await this.processIndividualPermissionSet(permSetName, workbook);
        } catch (error) {
          if (error instanceof Error) {
            this.logger(`Skipping permission set ${permSetName} due to error: ${error.message}`);
          } else {
            this.logger(`Skipping permission set ${permSetName} due to an unknown error`);
          }
        }
      }));
    } else {
      this.logger('DEBUG: permission-sets flag is undefined, skipping permission set export');
    }
  }

  private async processIndividualPermissionSet(
    permSetName: string,
    workbook: XLSX.WorkBook
  ): Promise<void> {
    const permissions: PermissionSetMetadata[] = [];
    const objectPermissionMap = new Map<string, PermissionSetMetadata>();
    const fieldPermissionMap = new Map<string, PermissionSetMetadata>();

    // Query object permissions
    const objectPerms = await this.connection.query<ObjectPermissionRecord>(
      `SELECT SobjectType, PermissionsRead, PermissionsCreate, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords 
       FROM ObjectPermissions 
       WHERE ParentId IN (SELECT Id FROM PermissionSet WHERE Name = '${permSetName}')
       AND SobjectType != null`
    );

    // this.logger(`Found ${objectPerms.records.length} object permissions for ${permSetName}`);

    objectPerms.records.forEach((record) => {
      if (!record.SobjectType) {
        this.logger(`Warning: Found object permission with undefined SobjectType in ${permSetName}`);
        return;
      }

      const permission: PermissionSetMetadata = {
        type: 'Object Permission',
        name: record.SobjectType,
        read: record.PermissionsRead ? 'Yes' : '',
        create: record.PermissionsCreate ? 'Yes' : '',
        edit: record.PermissionsEdit ? 'Yes' : '',
        delete: record.PermissionsDelete ? 'Yes' : '',
        viewAll: record.PermissionsViewAllRecords ? 'Yes' : '',
        modifyAll: record.PermissionsModifyAllRecords ? 'Yes' : '',
        permission: '', // Object permissions use specific columns, not Permission column
      };
      objectPermissionMap.set(record.SobjectType, permission);
    });

    // Query field permissions
    const fieldPerms = await this.connection.query<FieldPermissionRecord>(
      `SELECT Field, SobjectType, PermissionsRead, PermissionsEdit 
       FROM FieldPermissions 
       WHERE ParentId IN (SELECT Id FROM PermissionSet WHERE Name = '${permSetName}')`
    );

    // this.logger(`Found ${fieldPerms.records.length} field permissions for ${permSetName}`);

    fieldPerms.records.forEach((record) => {
      // this.logger(`Field permission: ${JSON.stringify(record)}`);
      // Handle cases where Field already includes the object name prefix
      const fieldNameOnly = record.Field.startsWith(`${record.SobjectType}.`)
        ? record.Field.substring(record.SobjectType.length + 1)
        : record.Field;
      const fieldName = `${record.SobjectType}.${fieldNameOnly}`;
      const permission: PermissionSetMetadata = {
        type: 'Field Permission',
        name: fieldName,
        read: record.PermissionsRead ? 'Yes' : '',
        edit: record.PermissionsEdit ? 'Yes' : '',
        create: '', // Fields don't have create permission
        delete: '', // Fields don't have delete permission
        viewAll: '', // Fields don't have view all permission
        modifyAll: '', // Fields don't have modify all permission
        permission: '', // Field permissions use Read/Edit columns, not Permission column
      };
      fieldPermissionMap.set(fieldName, permission);
    });

    // Add object and field permissions to the main array
    permissions.push(...Array.from(objectPermissionMap.values()));
    permissions.push(...Array.from(fieldPermissionMap.values()));

    // Process system permissions
    const systemPermissionResults = await this.processSystemPermissions(permSetName);
    permissions.push(...systemPermissionResults);

    // Only create worksheet if there are actual permissions (not just headers)
    if (permissions.length > 0) {
      // Create worksheet for this permission set
      const headerRow = ['Permission Type', 'Component Name', 'Read', 'Create', 'Edit', 'Delete', 'View All', 'Modify All', 'Permission'];
      const worksheet = XLSX.utils.aoa_to_sheet([headerRow]);

      // Convert permissions to array format with proper column mapping
      const permissionRows = permissions.map(perm => [
        perm.type,           // Permission Type
        perm.name,           // Component Name  
        perm.read ?? '',     // Read
        perm.create ?? '',   // Create
        perm.edit ?? '',     // Edit
        perm.delete ?? '',   // Delete
        perm.viewAll ?? '',  // View All
        perm.modifyAll ?? '', // Modify All
        perm.permission ?? '' // Permission
      ]);

      // Add the permission data as rows
      XLSX.utils.sheet_add_aoa(worksheet, permissionRows, { origin: 'A2' });

      // Apply formatting to the worksheet
      this.applyExcelFormatting(worksheet);

      XLSX.utils.book_append_sheet(workbook, worksheet, permSetName.substring(0, 31));
      this.logger(`Created worksheet for permission set: ${permSetName} with ${permissions.length} permissions`);
    } else {
      this.logger(`Skipped creating worksheet for permission set: ${permSetName} - no permissions found`);
    }
  }

  private async processSystemPermissions(permSetName: string): Promise<PermissionSetMetadata[]> {
    // Query system permissions (keep as separate rows since they only have enabled/disabled)
    const systemPerms = await this.connection.query<SystemPermissionRecord>(
      `SELECT SetupEntityId, SetupEntityType 
       FROM SetupEntityAccess 
       WHERE ParentId IN (SELECT Id FROM PermissionSet WHERE Name = '${permSetName}')`
    );

    // Group system permissions by entity type for bulk queries
    const permissionsByType = new Map<string, string[]>();
    systemPerms.records.forEach(record => {
      const entityType = record.SetupEntityType;
      if (!permissionsByType.has(entityType)) {
        permissionsByType.set(entityType, []);
      }
      permissionsByType.get(entityType)!.push(record.SetupEntityId);
    });

    // Bulk query all entities by type and create lookup maps
    const entityNameMaps = new Map<string, Map<string, string>>();

    const bulkQueryPromises = Array.from(permissionsByType.entries()).map(async ([entityType, entityIds]) => {
      if (entityIds.length === 0) return;

      const entityNameMap = new Map<string, string>();

      try {
        await this.queryEntitiesByType(entityType, entityIds, entityNameMap);
      } catch (error) {
        // If bulk query fails, use fallback naming for all IDs
        entityIds.forEach(id => {
          entityNameMap.set(id, `${entityType}|${id}`);
        });
      }

      entityNameMaps.set(entityType, entityNameMap);
    });

    // Wait for all bulk queries to complete
    await Promise.all(bulkQueryPromises);

    // Process system permissions using lookup maps
    const permissionResults = systemPerms.records.map(record => {
      const entityNameMap = entityNameMaps.get(record.SetupEntityType);
      const lookupResult = entityNameMap?.get(record.SetupEntityId) ?? `${record.SetupEntityType}|${record.SetupEntityId}`;

      // Split the type and name using the pipe delimiter
      const [permissionType, componentName] = lookupResult.split('|');

      return {
        type: permissionType,
        name: componentName,
        permission: 'Enabled',
        read: '',
        create: '',
        edit: '',
        delete: '',
        viewAll: '',
        modifyAll: ''
      };
    });

    return permissionResults;
  }

  private async queryEntitiesByType(
    entityType: string,
    entityIds: string[],
    entityNameMap: Map<string, string>
  ): Promise<void> {
    let queryResult;
    const idsFilter = entityIds.map(id => `'${id}'`).join(',');

    switch (entityType) {
      case 'ApexClass':
        queryResult = await this.connection.query<EntityRecord>(`SELECT Id, Name FROM ApexClass WHERE Id IN (${idsFilter})`);
        queryResult.records.forEach((record) => {
          if (record.Name) {
            entityNameMap.set(record.Id, `Apex Class|${record.Name}`);
          }
        });
        break;
      case 'ApexPage':
        queryResult = await this.connection.query<EntityRecord>(`SELECT Id, Name FROM ApexPage WHERE Id IN (${idsFilter})`);
        queryResult.records.forEach((record) => {
          if (record.Name) {
            entityNameMap.set(record.Id, `Visualforce Page|${record.Name}`);
          }
        });
        break;
      case 'CustomPermission':
        queryResult = await this.connection.query<EntityRecord>(`SELECT Id, MasterLabel FROM CustomPermission WHERE Id IN (${idsFilter})`);
        queryResult.records.forEach((record) => {
          if (record.MasterLabel) {
            entityNameMap.set(record.Id, `Custom Permission|${record.MasterLabel}`);
          }
        });
        break;
      case 'FlowDefinition':
        queryResult = await this.connection.query<EntityRecord>(`SELECT Id, MasterLabel FROM FlowDefinitionView WHERE Id IN (${idsFilter})`);
        queryResult.records.forEach((record) => {
          if (record.MasterLabel) {
            entityNameMap.set(record.Id, `Flow|${record.MasterLabel}`);
          }
        });
        break;
      case 'TabSet': {
        // Try TabDefinition first
        queryResult = await this.connection.query<EntityRecord>(`SELECT Id, Name FROM TabDefinition WHERE Id IN (${idsFilter})`);
        queryResult.records.forEach((record) => {
          if (record.Name) {
            entityNameMap.set(record.Id, `App|${record.Name}`);
          }
        });

        // For IDs not found in TabDefinition, try AppMenuItem
        let remainingIds = entityIds.filter(id => !entityNameMap.has(id));
        if (remainingIds.length > 0) {
          const remainingIdsFilter = remainingIds.map(id => `'${id}'`).join(',');
          const appMenuResult = await this.connection.query<EntityRecord>(`SELECT Id, Name FROM AppMenuItem WHERE Id IN (${remainingIdsFilter})`);
          appMenuResult.records.forEach((record) => {
            if (record.Name) {
              entityNameMap.set(record.Id, `App|${record.Name}`);
            }
          });
        }

        // For IDs still not found, try AppDefinition
        remainingIds = entityIds.filter(id => !entityNameMap.has(id));
        if (remainingIds.length > 0) {
          const remainingIdsFilter = remainingIds.map(id => `'${id}'`).join(',');
          const appDefResult = await this.connection.query<EntityRecord>(`SELECT Id, Name FROM AppDefinition WHERE Id IN (${remainingIdsFilter})`);
          appDefResult.records.forEach((record) => {
            if (record.Name) {
              entityNameMap.set(record.Id, `App|${record.Name}`);
            }
          });
        }
        break;
      }
      case 'CustomEntityDefinition':
        queryResult = await this.connection.query<EntityRecord>(`SELECT Id, QualifiedApiName FROM CustomEntityDefinition WHERE Id IN (${idsFilter})`);
        queryResult.records.forEach((record) => {
          if (record.QualifiedApiName) {
            entityNameMap.set(record.Id, `Custom Setting/Metadata|${record.QualifiedApiName}`);
          }
        });
        break;
      case 'ConnectedApp':
      case 'ConnectedApplication':
        queryResult = await this.connection.query<EntityRecord>(`SELECT Id, Name FROM ConnectedApplication WHERE Id IN (${idsFilter})`);
        queryResult.records.forEach((record) => {
          if (record.Name) {
            entityNameMap.set(record.Id, `Connected App|${record.Name}`);
          }
        });
        break;
      default:
        // For unknown types, use fallback naming
        entityIds.forEach(id => {
          entityNameMap.set(id, `${entityType}|${id}`);
        });
    }
  }

  private applyExcelFormatting(worksheet: XLSX.WorkSheet): void {
    // Set column widths for better readability
    const cols = [
      { wch: 20 }, // Permission Type
      { wch: 35 }, // Component Name
      { wch: 8 },  // Read
      { wch: 8 },  // Create
      { wch: 8 },  // Edit
      { wch: 8 },  // Delete
      { wch: 10 }, // View All
      { wch: 12 }, // Modify All
      { wch: 12 }  // Permission
    ];

    // Apply column widths
    Object.defineProperty(worksheet, '!cols', {
      value: cols,
      writable: true
    });

    this.logger('Applied Excel formatting: optimized column widths');
  }
} 