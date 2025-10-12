/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/quotes */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-param-reassign */

/**
 * User Permissions Analyzer Command
 *
 * This command analyzes all permission sources for a specific Salesforce user
 * and generates a comprehensive Excel report showing permissions from:
 * - Profile
 * - Direct Permission Set assignments
 * - Permission Set Groups (expanded to member permission sets)
 *
 * Author: JZ (Jitendra Zaa)
 * Date: October 2025
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Connection } from '@salesforce/core';
import * as XLSX from 'xlsx';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf_workbook', 'jz.user-permissions');

// Result type returned by the command
export type UserPermissionsResult = {
  userId: string;
  username: string;
  profileName: string;
  totalPermissionSets: number;
  totalPermissionSetGroups: number;
  totalExpandedPermissionSets: number;
  exportPath: string;
};

// User record from Salesforce
type UserRecord = {
  Id: string;
  Name: string;
  Username: string;
  Email: string;
  ProfileId: string;
  Profile: {
    Name: string;
  };
  IsActive: boolean;
};

// Permission source can be Profile, Permission Set, or Permission Set Group
type PermissionSourceType = 'Profile' | 'Permission Set' | 'Permission Set Group' | 'Permission Set (from Group)';

// Permission source information
type PermissionSource = {
  type: PermissionSourceType;
  id: string;
  name: string;
  label?: string;
  assignedDate?: string;
  parentGroup?: string; // For permission sets that come from groups
};

// Permission Set Assignment record
type PermissionSetAssignmentRecord = {
  Id: string;
  PermissionSetId: string;
  PermissionSetGroupId?: string;
  AssigneeId: string;
  PermissionSet?: {
    Id: string;
    Name: string;
    Label: string;
    IsOwnedByProfile: boolean;
    IsCustom: boolean;
  };
  PermissionSetGroup?: {
    Id: string;
    DeveloperName: string;
    MasterLabel: string;
  };
};

// Permission Set Group Component record
type PermissionSetGroupComponentRecord = {
  Id: string;
  PermissionSetGroupId: string;
  PermissionSetId: string;
  PermissionSet: {
    Id: string;
    Name: string;
    Label: string;
  };
};

// Permission Set record
type PermissionSetRecord = {
  Id: string;
  Name: string;
  Label: string;
  ProfileId?: string;
  IsOwnedByProfile: boolean;
};

// Individual permission data (reusing pattern from permissionsets-compare)
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
  visibility?: string;
  enabled?: string;
  category?: string;
};

// Permission matrix row for Excel output
type PermissionMatrixRow = {
  permissionType: string;
  componentName: string;
  property: string;
  sourceValues: Map<string, string>; // Map of source name to value ('Yes', '-', etc.)
};

// Grouped permissions by type
type GroupedPermissions = Map<string, PermissionMatrixRow[]>;

/**
 * Command class for analyzing user permissions
 */
export default class UserPermissions extends SfCommand<UserPermissionsResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      char: 'o',
      summary: messages.getMessage('flags.target-org.summary'),
      description: messages.getMessage('flags.target-org.description'),
    }),
    'user': Flags.string({
      char: 'u',
      summary: messages.getMessage('flags.user.summary'),
      description: messages.getMessage('flags.user.description'),
      required: true,
    }),
    'output-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.output-dir.summary'),
      description: messages.getMessage('flags.output-dir.description'),
      default: 'Exports',
    }),
  };

  /**
   * Generate timestamp for filename
   */
  private static generateTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').split('.')[0];
  }

  /**
   * Setup export directory for user permissions
   */
  private static setupExportDirectory(outputDir: string, orgId: string): string {
    const exportPath = path.join(process.cwd(), outputDir, 'UserPermissions', orgId);

    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }

    return exportPath;
  }

  /**
   * Sanitize worksheet name to be Excel-compliant
   * Excel worksheet names must be <= 31 characters and cannot contain: \ / ? * [ ]
   */
  private static sanitizeWorksheetName(name: string): string {
    let sanitized = name.replace(/[\\/?*[\]]/g, '_');

    if (sanitized.length > 31) {
      sanitized = sanitized.substring(0, 31);
    }

    return sanitized;
  }

  /**
   * Main command execution
   */
  public async run(): Promise<UserPermissionsResult> {
    const { flags } = await this.parse(UserPermissions);
    const connection = flags['target-org'].getConnection();
    const orgAlias = flags['target-org'].getUsername() ?? 'default';
    const orgId = flags['target-org'].getOrgId();
    const userIdentifier = flags.user;

    this.log('================================');
    this.log('🔍 User Permissions Analyzer');
    this.log('================================');
    this.log(`Target Org: ${orgAlias} (${String(orgId)})`);
    this.log(`User: ${userIdentifier}`);
    this.log('================================');

    // Step 1: Resolve user by ID or username
    this.log('📋 Step 1: Resolving user...');
    const user = await this.resolveUser(connection, userIdentifier);

    this.log(`✅ Found user: ${user.Name} (${user.Username})`);
    this.log(`   Profile: ${user.Profile.Name}`);
    this.log(`   Active: ${user.IsActive ? 'Yes' : 'No'}`);
    this.log('');

    // Step 2: Get all permission sources
    this.log('📋 Step 2: Discovering permission sources...');
    const permissionSources = await this.getAllPermissionSources(connection, user);

    this.log(`✅ Found ${permissionSources.length} permission sources:`);
    const profileCount = permissionSources.filter(ps => ps.type === 'Profile').length;
    const directPermSetCount = permissionSources.filter(ps => ps.type === 'Permission Set').length;
    const groupCount = permissionSources.filter(ps => ps.type === 'Permission Set Group').length;
    const expandedPermSetCount = permissionSources.filter(ps => ps.type === 'Permission Set (from Group)').length;

    this.log(`   Profile: ${profileCount}`);
    this.log(`   Direct Permission Sets: ${directPermSetCount}`);
    this.log(`   Permission Set Groups: ${groupCount}`);
    this.log(`   Expanded Permission Sets from Groups: ${expandedPermSetCount}`);
    this.log('');

    // Step 3: Collect permissions from all sources
    this.log('📋 Step 3: Collecting permissions from all sources...');
    const allPermissions = await this.collectAllPermissions(connection, permissionSources);

    this.log(`✅ Collected permissions from ${allPermissions.size} sources`);
    this.log('');

    // Step 4: Build permission matrix
    this.log('📋 Step 4: Building permission comparison matrix...');
    const permissionMatrix = this.buildPermissionMatrix(allPermissions);

    let totalPermissions = 0;
    permissionMatrix.forEach((rows) => {
      totalPermissions += rows.length;
    });
    this.log(`✅ Built matrix with ${totalPermissions} permission entries across ${permissionMatrix.size} categories`);
    this.log('');

    // Step 5: Generate Excel report
    this.log('📋 Step 5: Generating Excel report...');
    const exportPath = UserPermissions.setupExportDirectory(flags['output-dir'], String(orgId));
    const workbook = XLSX.utils.book_new();

    // Create Summary worksheet
    this.createSummaryWorksheet(workbook, user, permissionSources);

    // Create Permission Sources worksheet
    this.createPermissionSourcesWorksheet(workbook, permissionSources);

    // Create permission comparison worksheets
    this.createPermissionComparisonWorksheets(workbook, permissionMatrix, permissionSources);

    // Save workbook
    const sanitizedUsername = user.Username.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = UserPermissions.generateTimestamp();
    const fileName = path.join(exportPath, `UserPermissions_${sanitizedUsername}_${timestamp}.xlsx`);
    XLSX.writeFile(workbook, fileName);

    this.log(`✅ Excel report generated`);
    this.log('');

    // Final summary
    this.log('================================');
    this.log('🎉 Analysis Complete!');
    this.log('================================');
    this.log(`📊 Summary:`);
    this.log(`   User: ${user.Name} (${user.Username})`);
    this.log(`   Profile: ${user.Profile.Name}`);
    this.log(`   Permission Sets: ${directPermSetCount}`);
    this.log(`   Permission Set Groups: ${groupCount}`);
    this.log(`   Expanded Permission Sets: ${expandedPermSetCount}`);
    this.log(`   Total Permission Sources: ${permissionSources.length}`);
    this.log(`   📁 Report: ${fileName}`);
    this.log('================================');

    return {
      userId: user.Id,
      username: user.Username,
      profileName: user.Profile.Name,
      totalPermissionSets: directPermSetCount,
      totalPermissionSetGroups: groupCount,
      totalExpandedPermissionSets: expandedPermSetCount + directPermSetCount + profileCount,
      exportPath: fileName,
    };
  }

  /**
   * Resolve user by ID or username
   */
  private async resolveUser(connection: Connection, userIdentifier: string): Promise<UserRecord> {
    // Check if identifier looks like a Salesforce ID (15 or 18 characters)
    const isId = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(userIdentifier);

    const whereClause = isId ? `Id = '${userIdentifier}'` : `Username = '${userIdentifier}'`;

    const query = `
      SELECT Id, Name, Username, Email, ProfileId, Profile.Name, IsActive
      FROM User
      WHERE ${whereClause}
    `;

    this.log(`Querying user: ${query}`);

    try {
      const result = await connection.query<UserRecord>(query);

      if (result.records.length === 0) {
        throw new Error(`User not found: ${userIdentifier}`);
      }

      return result.records[0];
    } catch (error) {
      throw new Error(`Failed to resolve user: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all permission sources for a user (profile, permission sets, permission set groups)
   */
  private async getAllPermissionSources(
    connection: Connection,
    user: UserRecord
  ): Promise<PermissionSource[]> {
    const sources: PermissionSource[] = [];

    // 1. Get profile as a permission source
    // Use the actual Profile.Name from User record instead of PermissionSet label (which is often just the ID)
    const profileSource = await this.getProfileAsPermissionSet(connection, user.ProfileId);
    if (profileSource) {
      sources.push({
        type: 'Profile',
        id: profileSource.Id,
        name: profileSource.Name,
        label: user.Profile.Name,  // Use actual profile name from user record
      });
    }

    // 2. Get direct permission set assignments
    const directPermissionSets = await this.getDirectPermissionSets(connection, user.Id);
    sources.push(...directPermissionSets);

    // 3. Get permission set group assignments
    const groupAssignments = await this.getPermissionSetGroupAssignments(connection, user.Id);
    sources.push(...groupAssignments);

    // 4. Expand permission set groups to their member permission sets
    const groupExpansionPromises = groupAssignments.map(async (group) =>
      this.expandPermissionSetGroup(connection, group.id, group.name)
    );
    const expandedGroups = await Promise.all(groupExpansionPromises);
    expandedGroups.forEach((memberPermSets) => {
      sources.push(...memberPermSets);
    });

    return sources;
  }

  /**
   * Get profile as a permission set (profiles are represented as permission sets)
   */
  private async getProfileAsPermissionSet(
    connection: Connection,
    profileId: string
  ): Promise<PermissionSetRecord | null> {
    const query = `
      SELECT Id, Name, Label, ProfileId, IsOwnedByProfile
      FROM PermissionSet
      WHERE ProfileId = '${profileId}'
      AND IsOwnedByProfile = true
    `;

    this.log(`Querying profile permission set...`);

    try {
      const result = await connection.query<PermissionSetRecord>(query);

      if (result.records.length > 0) {
        this.log(`   Found profile permission set: ${result.records[0].Name}`);
        return result.records[0];
      }

      return null;
    } catch (error) {
      this.log(`   Warning: Could not query profile permission set: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Get direct permission set assignments (not from groups, not profile-based)
   */
  private async getDirectPermissionSets(
    connection: Connection,
    userId: string
  ): Promise<PermissionSource[]> {
    const query = `
      SELECT Id, PermissionSetId, PermissionSet.Name, PermissionSet.Label,
             PermissionSet.IsOwnedByProfile
      FROM PermissionSetAssignment
      WHERE AssigneeId = '${userId}'
      AND PermissionSet.IsOwnedByProfile = false
      AND PermissionSetGroupId = null
    `;

    this.log(`Querying direct permission sets...`);

    try {
      const result = await connection.query<PermissionSetAssignmentRecord>(query);

      this.log(`   Found ${result.records.length} direct permission sets`);

      return result.records.map(record => ({
        type: 'Permission Set' as PermissionSourceType,
        id: record.PermissionSetId,
        name: record.PermissionSet?.Name || record.PermissionSetId,
        label: record.PermissionSet?.Label,
      }));
    } catch (error) {
      this.log(`   Warning: Could not query direct permission sets: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Get permission set group assignments
   */
  private async getPermissionSetGroupAssignments(
    connection: Connection,
    userId: string
  ): Promise<PermissionSource[]> {
    const query = `
      SELECT Id, PermissionSetGroupId, PermissionSetGroup.DeveloperName,
             PermissionSetGroup.MasterLabel
      FROM PermissionSetAssignment
      WHERE AssigneeId = '${userId}'
      AND PermissionSetGroupId != null
    `;

    this.log(`Querying permission set groups...`);

    try {
      const result = await connection.query<PermissionSetAssignmentRecord>(query);

      this.log(`   Found ${result.records.length} permission set groups`);

      return result.records.map(record => ({
        type: 'Permission Set Group' as PermissionSourceType,
        id: record.PermissionSetGroupId || '',
        name: record.PermissionSetGroup?.DeveloperName || record.PermissionSetGroupId || '',
        label: record.PermissionSetGroup?.MasterLabel,
      }));
    } catch (error) {
      this.log(`   Note: Could not query permission set groups (may not be available in this org): ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Expand a permission set group to its member permission sets
   */
  private async expandPermissionSetGroup(
    connection: Connection,
    groupId: string,
    groupName: string
  ): Promise<PermissionSource[]> {
    const query = `
      SELECT Id, PermissionSetGroupId, PermissionSetId,
             PermissionSet.Name, PermissionSet.Label
      FROM PermissionSetGroupComponent
      WHERE PermissionSetGroupId = '${groupId}'
    `;

    this.log(`   Expanding group: ${groupName}`);

    try {
      const result = await connection.query<PermissionSetGroupComponentRecord>(query);

      this.log(`      Found ${result.records.length} member permission sets`);

      return result.records.map(record => ({
        type: 'Permission Set (from Group)' as PermissionSourceType,
        id: record.PermissionSetId,
        name: record.PermissionSet.Name,
        label: record.PermissionSet.Label,
        parentGroup: groupName,
      }));
    } catch (error) {
      this.log(`      Warning: Could not expand group: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Collect all permissions from all sources
   * Queries permissions for each permission source (profile, permission sets, etc.)
   */
  private async collectAllPermissions(
    connection: Connection,
    sources: PermissionSource[]
  ): Promise<Map<string, PermissionData[]>> {
    const allPermissions = new Map<string, PermissionData[]>();

    // Collect permissions for each source in parallel
    const collectionPromises = sources.map(async (source) => {
      this.log(`   Collecting permissions from: ${source.type} - ${source.name}`);

      try {
        const permissions = await this.getPermissionsForSource(connection, source.id);
        this.log(`      Found ${permissions.length} permissions`);
        return { source, permissions };
      } catch (error) {
        this.log(`      Warning: Could not get permissions for ${source.name}: ${error instanceof Error ? error.message : String(error)}`);
        return { source, permissions: [] };
      }
    });

    const results = await Promise.all(collectionPromises);

    // Store permissions in map keyed by source label (or name as fallback)
    results.forEach(({ source, permissions }) => {
      const sourceName = `${source.type}: ${source.label || source.name}`;
      allPermissions.set(sourceName, permissions);
    });

    return allPermissions;
  }

  /**
   * Get all permissions for a specific permission set/profile by ID
   * This method reuses query logic from permissionsets-compare command
   */
  private async getPermissionsForSource(
    connection: Connection,
    permissionSetId: string
  ): Promise<PermissionData[]> {
    const permissions: PermissionData[] = [];

    // Need to add type definitions for query records
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

    type TabSettingRecord = {
      Name: string;
      Visibility: string;
    };

    type UserPermissionFields = {
      PermissionsApiEnabled?: boolean;
      PermissionsViewSetup?: boolean;
      PermissionsModifyAllData?: boolean;
      PermissionsManageUsers?: boolean;
      PermissionsViewAllData?: boolean;
      PermissionsEditTask?: boolean;
      PermissionsEditEvent?: boolean;
      PermissionsExportReport?: boolean;
      PermissionsImportPersonal?: boolean;
      PermissionsDataExport?: boolean;
      PermissionsManageCases?: boolean;
      PermissionsEditPublicTemplates?: boolean;
      PermissionsEditReadonlyFields?: boolean;
      PermissionsRunReports?: boolean;
      PermissionsTransferAnyEntity?: boolean;
      PermissionsNewReportBuilder?: boolean;
      PermissionsActivateContract?: boolean;
      PermissionsCustomizeApplication?: boolean;
      PermissionsEditKnowledge?: boolean;
      PermissionsManageKnowledge?: boolean;
    };

    // Query by ID instead of name
    // Get object permissions
    const objectPerms = await connection.query<ObjectPermissionRecord>(
      `SELECT SobjectType, PermissionsRead, PermissionsCreate, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords
       FROM ObjectPermissions
       WHERE ParentId = '${permissionSetId}'
       AND SobjectType != null`
    );

    objectPerms.records.forEach((record) => {
      if (record.SobjectType) {
        permissions.push({
          type: 'Object Permission',
          name: record.SobjectType,
          read: record.PermissionsRead ? 'Yes' : '',
          create: record.PermissionsCreate ? 'Yes' : '',
          edit: record.PermissionsEdit ? 'Yes' : '',
          delete: record.PermissionsDelete ? 'Yes' : '',
          viewAll: record.PermissionsViewAllRecords ? 'Yes' : '',
          modifyAll: record.PermissionsModifyAllRecords ? 'Yes' : '',
          permission: '',
        });
      }
    });

    // Get field permissions
    const fieldPerms = await connection.query<FieldPermissionRecord>(
      `SELECT Field, SobjectType, PermissionsRead, PermissionsEdit
       FROM FieldPermissions
       WHERE ParentId = '${permissionSetId}'`
    );

    fieldPerms.records.forEach((record) => {
      const fieldNameOnly = record.Field.startsWith(`${record.SobjectType}.`)
        ? record.Field.substring(record.SobjectType.length + 1)
        : record.Field;
      const fieldName = `${record.SobjectType}.${fieldNameOnly}`;

      permissions.push({
        type: 'Field Permission',
        name: fieldName,
        read: record.PermissionsRead ? 'Yes' : '',
        edit: record.PermissionsEdit ? 'Yes' : '',
        create: '',
        delete: '',
        viewAll: '',
        modifyAll: '',
        permission: '',
      });
    });

    // Get system permissions with categorization
    const systemPerms = await connection.query<SystemPermissionRecord>(
      `SELECT SetupEntityId, SetupEntityType
       FROM SetupEntityAccess
       WHERE ParentId = '${permissionSetId}'`
    );

    systemPerms.records.forEach((record) => {
      let permissionType = 'System Permission';

      if (record.SetupEntityType === 'ApexClass') {
        permissionType = 'Apex Class Access';
      } else if (record.SetupEntityType === 'ApexPage') {
        permissionType = 'Visualforce Page Access';
      } else if (record.SetupEntityType === 'CustomPermission') {
        permissionType = 'Custom Permission';
      } else if (record.SetupEntityType === 'TabSet') {
        permissionType = 'Application Visibility';
      } else if (record.SetupEntityType === 'Flow') {
        permissionType = 'Flow Access';
      } else if (record.SetupEntityType === 'ExternalDataSource') {
        permissionType = 'External Data Source Access';
      } else if (record.SetupEntityType === 'CustomMetadata') {
        permissionType = 'Custom Metadata Type Access';
      }

      permissions.push({
        type: permissionType,
        name: record.SetupEntityId,
        read: '',
        create: '',
        edit: '',
        delete: '',
        viewAll: '',
        modifyAll: '',
        permission: 'Yes',
        category: record.SetupEntityType,
      });
    });

    // Get tab settings
    try {
      const tabSettings = await connection.query<TabSettingRecord>(
        `SELECT Name, Visibility
         FROM PermissionSetTabSetting
         WHERE ParentId = '${permissionSetId}'`
      );

      tabSettings.records.forEach((record) => {
        permissions.push({
          type: 'Tab Setting',
          name: record.Name,
          read: '',
          create: '',
          edit: '',
          delete: '',
          viewAll: '',
          modifyAll: '',
          permission: '',
          visibility: record.Visibility,
        });
      });
    } catch (error) {
      // Tab settings may not be available in all API versions
    }

    // Get user permissions
    try {
      const userPermsQuery = `
        SELECT
          PermissionsApiEnabled, PermissionsViewSetup, PermissionsModifyAllData,
          PermissionsManageUsers, PermissionsViewAllData, PermissionsEditTask,
          PermissionsEditEvent, PermissionsExportReport, PermissionsImportPersonal,
          PermissionsDataExport, PermissionsManageCases, PermissionsEditPublicTemplates,
          PermissionsEditReadonlyFields, PermissionsRunReports, PermissionsTransferAnyEntity,
          PermissionsNewReportBuilder, PermissionsActivateContract, PermissionsCustomizeApplication,
          PermissionsEditKnowledge, PermissionsManageKnowledge
        FROM PermissionSet
        WHERE Id = '${permissionSetId}'
      `;

      const userPermsResult = await connection.query<UserPermissionFields>(userPermsQuery);

      if (userPermsResult.records.length > 0) {
        const userPerms = userPermsResult.records[0];

        const userPermissionMappings: Array<{field: keyof UserPermissionFields; label: string}> = [
          { field: 'PermissionsApiEnabled', label: 'API Enabled' },
          { field: 'PermissionsViewSetup', label: 'View Setup and Configuration' },
          { field: 'PermissionsModifyAllData', label: 'Modify All Data' },
          { field: 'PermissionsManageUsers', label: 'Manage Users' },
          { field: 'PermissionsViewAllData', label: 'View All Data' },
          { field: 'PermissionsEditTask', label: 'Edit Tasks' },
          { field: 'PermissionsEditEvent', label: 'Edit Events' },
          { field: 'PermissionsExportReport', label: 'Export Reports' },
          { field: 'PermissionsImportPersonal', label: 'Import Personal Contacts' },
          { field: 'PermissionsDataExport', label: 'Weekly Data Export' },
          { field: 'PermissionsManageCases', label: 'Manage Cases' },
          { field: 'PermissionsEditPublicTemplates', label: 'Edit Public Templates' },
          { field: 'PermissionsEditReadonlyFields', label: 'Edit Read Only Fields' },
          { field: 'PermissionsRunReports', label: 'Run Reports' },
          { field: 'PermissionsTransferAnyEntity', label: 'Transfer Record' },
          { field: 'PermissionsNewReportBuilder', label: 'Report Builder' },
          { field: 'PermissionsActivateContract', label: 'Activate Contracts' },
          { field: 'PermissionsCustomizeApplication', label: 'Customize Application' },
          { field: 'PermissionsEditKnowledge', label: 'Edit Knowledge Articles' },
          { field: 'PermissionsManageKnowledge', label: 'Manage Knowledge' },
        ];

        userPermissionMappings.forEach(({ field, label }) => {
          if (userPerms[field] === true) {
            permissions.push({
              type: 'User Permission',
              name: label,
              read: '',
              create: '',
              edit: '',
              delete: '',
              viewAll: '',
              modifyAll: '',
              permission: '',
              enabled: 'Yes',
            });
          }
        });
      }
    } catch (error) {
      // User permissions query may fail in some cases
    }

    return permissions;
  }

  /**
   * Build permission comparison matrix
   * Groups permissions by type and creates matrix rows showing which source grants each permission
   */
  private buildPermissionMatrix(
    allPermissions: Map<string, PermissionData[]>
  ): GroupedPermissions {
    const groupedPermissions = new Map<string, PermissionMatrixRow[]>();

    // Collect all unique permissions across all sources
    const allUniquePermissions = new Map<string, Set<string>>();

    // First pass: collect all unique permissions by type
    allPermissions.forEach((permissions) => {
      permissions.forEach((perm) => {
        // Create a unique key for this permission
        const permKey = `${perm.type}|${perm.name}`;

        if (!allUniquePermissions.has(permKey)) {
          allUniquePermissions.set(permKey, new Set());
        }

        // Add all properties for this permission
        if (perm.read) allUniquePermissions.get(permKey)?.add('Read');
        if (perm.create) allUniquePermissions.get(permKey)?.add('Create');
        if (perm.edit) allUniquePermissions.get(permKey)?.add('Edit');
        if (perm.delete) allUniquePermissions.get(permKey)?.add('Delete');
        if (perm.viewAll) allUniquePermissions.get(permKey)?.add('View All');
        if (perm.modifyAll) allUniquePermissions.get(permKey)?.add('Modify All');
        if (perm.permission) allUniquePermissions.get(permKey)?.add('Permission');
        if (perm.visibility) allUniquePermissions.get(permKey)?.add('Visibility');
        if (perm.enabled) allUniquePermissions.get(permKey)?.add('Enabled');
      });
    });

    // Second pass: build matrix rows for each unique permission
    allUniquePermissions.forEach((properties, permKey) => {
      const [permType, permName] = permKey.split('|');

      // For each property of this permission, create a matrix row
      properties.forEach((property) => {
        const sourceValues = new Map<string, string>();

        // Check each source for this permission + property combination
        allPermissions.forEach((permissions, sourceName) => {
          const perm = permissions.find((p) => p.type === permType && p.name === permName);

          if (perm) {
            let value = '-';

            // Get the value for this property
            switch (property) {
              case 'Read':
                value = perm.read || '-';
                break;
              case 'Create':
                value = perm.create || '-';
                break;
              case 'Edit':
                value = perm.edit || '-';
                break;
              case 'Delete':
                value = perm.delete || '-';
                break;
              case 'View All':
                value = perm.viewAll || '-';
                break;
              case 'Modify All':
                value = perm.modifyAll || '-';
                break;
              case 'Permission':
                value = perm.permission || '-';
                break;
              case 'Visibility':
                value = perm.visibility || '-';
                break;
              case 'Enabled':
                value = perm.enabled || '-';
                break;
              default:
                value = '-';
            }

            sourceValues.set(sourceName, value);
          } else {
            sourceValues.set(sourceName, '-');
          }
        });

        // Create matrix row
        const matrixRow: PermissionMatrixRow = {
          permissionType: permType,
          componentName: permName,
          property,
          sourceValues,
        };

        // Add to grouped permissions
        if (!groupedPermissions.has(permType)) {
          groupedPermissions.set(permType, []);
        }

        groupedPermissions.get(permType)?.push(matrixRow);
      });
    });

    // Sort matrix rows within each group for better readability
    groupedPermissions.forEach((rows) => {
      rows.sort((a, b) => {
        // Sort by component name first, then by property
        if (a.componentName !== b.componentName) {
          return a.componentName.localeCompare(b.componentName);
        }
        return a.property.localeCompare(b.property);
      });
    });

    return groupedPermissions;
  }

  /**
   * Create Summary worksheet
   */
  private createSummaryWorksheet(
    workbook: XLSX.WorkBook,
    user: UserRecord,
    sources: PermissionSource[]
  ): void {
    const profileCount = sources.filter(ps => ps.type === 'Profile').length;
    const directPermSetCount = sources.filter(ps => ps.type === 'Permission Set').length;
    const groupCount = sources.filter(ps => ps.type === 'Permission Set Group').length;
    const expandedPermSetCount = sources.filter(ps => ps.type === 'Permission Set (from Group)').length;

    // Get permission source lists
    const profileSources = sources.filter(ps => ps.type === 'Profile');
    const directPermSets = sources.filter(ps => ps.type === 'Permission Set');
    const groups = sources.filter(ps => ps.type === 'Permission Set Group');
    const expandedPermSets = sources.filter(ps => ps.type === 'Permission Set (from Group)');

    const summaryData: string[][] = [
      ['User Permissions Analysis Summary', '', ''],
      ['', '', ''],
      ['USER INFORMATION', '', ''],
      ['Name:', user.Name, ''],
      ['Username:', user.Username, ''],
      ['Email:', user.Email, ''],
      ['Profile:', user.Profile.Name, ''],
      ['Active:', user.IsActive ? 'Yes' : 'No', ''],
      ['User ID:', user.Id, ''],
      ['', '', ''],
      ['PERMISSION SOURCES SUMMARY', '', ''],
      ['Profile:', String(profileCount), ''],
      ['Direct Permission Sets:', String(directPermSetCount), ''],
      ['Permission Set Groups:', String(groupCount), ''],
      ['Permission Sets from Groups:', String(expandedPermSetCount), ''],
      ['Total Permission Sources:', String(sources.length), ''],
      ['', '', ''],
      ['PERMISSION SOURCES DETAILS', '', ''],
    ];

    // Add Profile
    if (profileSources.length > 0) {
      summaryData.push(['Profile:', profileSources[0].label || profileSources[0].name, '']);
    }

    // Add Direct Permission Sets
    if (directPermSets.length > 0) {
      summaryData.push(['', '', '']);
      summaryData.push(['Direct Permission Sets:', '', '']);
      directPermSets.forEach(ps => {
        summaryData.push(['  -', ps.label || ps.name, '']);
      });
    }

    // Add Permission Set Groups
    if (groups.length > 0) {
      summaryData.push(['', '', '']);
      summaryData.push(['Permission Set Groups:', '', '']);
      groups.forEach(grp => {
        summaryData.push(['  -', grp.label || grp.name, '']);
      });
    }

    // Add Expanded Permission Sets from Groups
    if (expandedPermSets.length > 0) {
      summaryData.push(['', '', '']);
      summaryData.push(['Permission Sets from Groups:', '', '']);
      expandedPermSets.forEach(ps => {
        summaryData.push(['  -', `${ps.label || ps.name} (from ${ps.parentGroup})`, '']);
      });
    }

    // Add Report Information
    summaryData.push(['', '', '']);
    summaryData.push(['REPORT INFORMATION', '', '']);
    summaryData.push(['Generated:', new Date().toLocaleString(), '']);
    summaryData.push(['Generated By:', 'Salesforce CLI - jz user-permissions', '']);

    const worksheet = XLSX.utils.aoa_to_sheet(summaryData);

    // Set column widths
    worksheet['!cols'] = [
      { width: 30 },
      { width: 40 },
      { width: 20 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Summary', true);
  }

  /**
   * Create Permission Sources worksheet
   */
  private createPermissionSourcesWorksheet(
    workbook: XLSX.WorkBook,
    sources: PermissionSource[]
  ): void {
    const headerRow = ['Source Type', 'Name', 'Label', 'Assigned Date', 'Parent Group'];
    const worksheet = XLSX.utils.aoa_to_sheet([headerRow]);

    const dataRows = sources.map(source => [
      source.type,
      source.name,
      source.label || '',
      source.assignedDate || '',
      source.parentGroup || '',
    ]);

    XLSX.utils.sheet_add_aoa(worksheet, dataRows, { origin: 'A2' });

    // Set column widths
    worksheet['!cols'] = [
      { width: 25 }, // Source Type
      { width: 30 }, // Name
      { width: 30 }, // Label
      { width: 20 }, // Assigned Date
      { width: 30 }, // Parent Group
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Permission Sources');
  }

  /**
   * Create permission comparison worksheets
   * One worksheet per permission type showing matrix of permissions across all sources
   */
  private createPermissionComparisonWorksheets(
    workbook: XLSX.WorkBook,
    permissionMatrix: GroupedPermissions,
    sources: PermissionSource[]
  ): void {
    // Get source names in order (use label or fallback to name)
    const sourceNames = sources.map((s) => `${s.type}: ${s.label || s.name}`);

    // Create a worksheet for each permission type
    permissionMatrix.forEach((matrixRows, permissionType) => {
      if (matrixRows.length === 0) return;

      // Build header row
      const headerRow = ['Permission Type', 'Component Name', 'Property', ...sourceNames];

      // Build data rows
      const dataRows = matrixRows.map((row) => {
        const sourceValuesList = sourceNames.map((sourceName) => row.sourceValues.get(sourceName) || '-');

        return [
          row.permissionType,
          row.componentName,
          row.property,
          ...sourceValuesList,
        ];
      });

      // Create worksheet
      const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

      // Set column widths
      const columnWidths = [
        { width: 25 }, // Permission Type
        { width: 40 }, // Component Name
        { width: 15 }, // Property
        ...sourceNames.map(() => ({ width: 15 })), // One column per source
      ];
      worksheet['!cols'] = columnWidths;

      // Apply basic formatting to header row
      this.applyHeaderFormatting(worksheet, headerRow.length);

      // Sanitize worksheet name and add to workbook
      const sheetName = UserPermissions.sanitizeWorksheetName(permissionType);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      this.log(`      Created worksheet: ${sheetName} (${matrixRows.length} rows)`);
    });
  }

  /**
   * Apply header formatting to a worksheet
   */
  private applyHeaderFormatting(worksheet: XLSX.WorkSheet, columnCount: number): void {
    // Basic header formatting
    // Note: xlsx library has limited styling support in free version
    // This sets column widths and basic structure
    const range = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1');

    for (let col = range.s.c; col < columnCount; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (worksheet[cellAddress]) {
        // Mark as header (actual styling may require xlsx-style or similar)
        worksheet[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: '4472C4' } },
          alignment: { horizontal: 'center' },
        };
      }
    }
  }
}
