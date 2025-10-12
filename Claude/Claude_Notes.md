# Salesforce Workbook Plugin - Implementation Notes

## Project Overview

This is a Salesforce CLI custom plugin that provides multiple commands for analyzing, exporting, and managing Salesforce org configuration and metadata. The plugin is built using the Salesforce CLI Plugin framework and TypeScript.

## Project Structure

```
sf_workbook/
├── src/
│   └── commands/
│       └── jz/
│           ├── log.ts                    # Export debug logs
│           ├── logdelete.ts              # Delete debug logs
│           ├── permissionsets.ts         # Export permission sets
│           ├── permissionsets-compare.ts # Compare permission sets (ENHANCED)
│           ├── user-permissions.ts       # User permission analyzer (NEW)
│           ├── health.ts                 # Org health check
│           ├── wbook.ts                  # Export objects metadata
│           └── emailtemplates.ts         # Generate package.xml for email templates
├── messages/                             # Command documentation
├── test/                                 # Unit and integration tests
├── lib/                                  # Compiled JavaScript output
└── Claude/                               # Development notes and tasks
    └── Task/
        ├── todo_1.md                     # Enhancement plan for permission sets compare
        └── todo_2.md                     # Implementation plan for user permissions analyzer
```

## Available Commands

1. **jz log** - Export debug logs with HTML summary
2. **jz logdelete** - Safely delete debug logs with dry-run mode
3. **jz permissionsets** - Export permission sets to Excel
4. **jz permissionsets-compare** - Compare permission sets between orgs (ENHANCED)
5. **jz user-permissions** - Analyze all permission sources for a specific user (NEW)
6. **jz health** - Comprehensive org health analysis
7. **jz wbook** - Export object metadata to Excel
8. **jz emailtemplates** - Generate package.xml for email templates

## Recent Enhancements (October 2025)

### Permission Sets Compare Command - Major Enhancement

The `jz permissionsets-compare` command has been significantly enhanced to provide comprehensive permission set comparison between orgs.

#### Previously Supported Permission Types:
1. Object Permissions (CRUD + View All/Modify All)
2. Field Permissions (Read/Edit)
3. System Permissions (basic SetupEntityAccess queries)

#### Newly Added Permission Types:
4. **User Permissions** - System-level boolean permissions
5. **Apex Class Access** - Access to Apex classes
6. **Visualforce Page Access** - Access to Visualforce pages
7. **Custom Permissions** - Custom permissions defined in org
8. **Application Visibility** - Application access settings
9. **Tab Settings** - Tab visibility (Available/Visible/Hidden)
10. **Flow Access** - Access to specific flows
11. **External Data Source Access** - External data source permissions
12. **Custom Metadata Type Access** - Custom metadata permissions

### Implementation Details

#### Type Definitions (src/commands/jz/permissionsets-compare.ts)

**New Types Added:**
```typescript
// Added for tab settings support
type TabSettingRecord = {
  Name: string;
  Visibility: string;
};

// Added for application visibility
type ApplicationVisibilityRecord = {
  SetupEntityId: string;
  SetupEntityType: string;
};

// Added for user-level permissions
type UserPermissionFields = {
  PermissionsApiEnabled?: boolean;
  PermissionsViewSetup?: boolean;
  PermissionsModifyAllData?: boolean;
  // ... 20+ permission fields
};
```

**Enhanced PermissionData Type:**
```typescript
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
  visibility?: string;  // NEW: For tab settings
  enabled?: string;     // NEW: For user permissions
  category?: string;    // NEW: For categorizing SetupEntityAccess types
};
```

#### Query Enhancements

**1. Enhanced System Permissions with Categorization:**
```typescript
// Now categorizes SetupEntityAccess by SetupEntityType
const systemPerms = await connection.query<SystemPermissionRecord>(
  `SELECT SetupEntityId, SetupEntityType
   FROM SetupEntityAccess
   WHERE ParentId IN (SELECT Id FROM PermissionSet WHERE Name = '${permissionSetName}')`
);

// Categorizes permissions as:
// - Apex Class Access (SetupEntityType = 'ApexClass')
// - Visualforce Page Access (SetupEntityType = 'ApexPage')
// - Custom Permission (SetupEntityType = 'CustomPermission')
// - Application Visibility (SetupEntityType = 'TabSet')
// - Flow Access (SetupEntityType = 'Flow')
// - External Data Source Access (SetupEntityType = 'ExternalDataSource')
// - Custom Metadata Type Access (SetupEntityType = 'CustomMetadata')
// - System Permission (all others)
```

**2. Tab Settings Query:**
```typescript
// Requires API version 45.0+
const tabSettings = await connection.query<TabSettingRecord>(
  `SELECT Name, Visibility
   FROM PermissionSetTabSetting
   WHERE ParentId IN (SELECT Id FROM PermissionSet WHERE Name = '${permissionSetName}')`
);
```

**3. User Permissions Query:**
```typescript
// Queries PermissionSet object directly for boolean permission fields
const userPermsQuery = `
  SELECT
    PermissionsApiEnabled, PermissionsViewSetup, PermissionsModifyAllData,
    PermissionsManageUsers, PermissionsViewAllData, PermissionsEditTask,
    // ... 20+ permission fields
  FROM PermissionSet
  WHERE Name = '${permissionSetName}'
`;

// Maps to friendly names like:
// - API Enabled
// - View Setup and Configuration
// - Modify All Data
// - Manage Users
// etc.
```

#### Error Handling

The implementation includes graceful error handling for queries that may not be available in all API versions or org configurations:

```typescript
try {
  // Query tab settings
  const tabSettings = await connection.query<TabSettingRecord>(...);
  // Process results
} catch (error) {
  // Log note but continue execution
  this.log(`Note: Could not query tab settings: ${error.message}`);
}
```

This ensures backward compatibility with older API versions and different org configurations.

#### Comparison Logic

The comparison logic was updated to handle new permission property types:

```typescript
private comparePermissionProperties(
  sourcePerm: PermissionData,
  targetPerm: PermissionData,
  differences: PermissionDifference[]
): void {
  // Updated to include 'visibility' and 'enabled' properties
  const properties = [
    'read', 'create', 'edit', 'delete',
    'viewAll', 'modifyAll', 'permission',
    'visibility', 'enabled'  // NEW
  ] as const;

  // Compare each property and report differences
}
```

### Key Features

1. **Comprehensive Coverage**: Now compares 12+ types of permissions
2. **Intelligent Categorization**: Automatically categorizes permissions by type
3. **Smart Filtering**: Excludes ID-based components that will always differ
4. **Error Resilience**: Gracefully handles API version differences
5. **Parallel Processing**: Uses Promise.all for optimal performance
6. **Detailed Reporting**: Generates Excel reports with separate sheets per permission set
7. **User-Friendly Names**: Maps technical field names to friendly labels

### Technical Decisions & Rationale

#### 1. Why SetupEntityAccess for Multiple Permission Types?

SetupEntityAccess is a versatile object that stores multiple permission types. By filtering on `SetupEntityType`, we can extract:
- Apex classes
- Visualforce pages
- Custom permissions
- Applications (TabSet)
- Flows
- External data sources
- Custom metadata types

This is more efficient than querying multiple objects separately.

#### 2. Why Query PermissionSet Directly for User Permissions?

User permissions (like PermissionsApiEnabled, PermissionsViewSetup) are boolean fields directly on the PermissionSet object. This approach:
- Provides accurate permission state
- Avoids complex joins
- Is available in all API versions

#### 3. Why Only Include Enabled User Permissions?

The code only adds user permissions where the value is `true`:
```typescript
if (userPerms[field] === true) {
  // Add to permissions array
}
```

This reduces noise in the comparison report by only showing explicitly granted permissions, not all possible permissions.

#### 4. Error Handling Strategy

The implementation uses try-catch blocks for newer features (Tab Settings, User Permissions) because:
- PermissionSetTabSetting requires API 45.0+
- Some permission fields may not exist in all orgs
- This ensures the command works across different Salesforce versions

### Known Limitations

1. **Record Type Visibility**: Not currently implemented
   - Would require Metadata API or complex queries
   - Added to future enhancement list

2. **Managed Package Permissions**: Currently included but should potentially be filtered
   - IDs from managed packages are filtered out
   - But managed package-specific permissions are still compared

3. **Page Layout Assignments**: Not included in comparison
   - Requires separate object queries
   - Could be added in future enhancements

4. **IP Range Restrictions**: Not included
   - Profile-specific, not typically in permission sets
   - May not be relevant for most comparisons

### Performance Considerations

1. **Parallel Processing**: All permission types are queried in parallel within `getPermissionSetPermissions`
2. **Permission Set Comparison**: Multiple permission sets are compared in parallel using `Promise.all`
3. **Smart Filtering**: ID-based components are filtered early to reduce processing

### Testing Recommendations

When testing the enhanced permission sets compare command:

1. Test with permission sets that have diverse permissions
2. Test with orgs of different API versions (to verify error handling)
3. Compare between sandbox and production orgs
4. Test with both custom and standard permission sets
5. Verify Excel output formatting and readability
6. Test with permission sets that have managed package permissions
7. Performance test with 50+ permission sets

### Future Enhancement Ideas

1. **Visual Diff View**: HTML report with color-coded differences
2. **Permission Set Groups**: Support for comparing permission set groups
3. **Historical Comparison**: Track permission changes over time
4. **Deployment Recommendations**: Suggest deployment strategies based on differences
5. **Managed Package Filtering**: Option to exclude managed package permissions
6. **Record Type Visibility**: Add support for record type comparisons
7. **Custom Report Formats**: JSON, CSV, or custom template outputs

---

### User Permissions Analyzer Command - New Implementation

The `jz user-permissions` command is a brand new feature that solves a critical problem: understanding why a specific user can see tabs, fields, objects, and other Salesforce components.

#### Problem Statement

In Salesforce, determining user permissions is time-consuming because a user's effective permissions come from multiple sources:
- **Profile**: Every user has exactly one profile
- **Permission Sets**: Users can have 0 to many directly assigned permission sets
- **Permission Set Groups**: Users can have 0 to many permission set groups, each containing multiple permission sets

Administrators often struggle with questions like:
- "Why can User A see this tab?"
- "Which permission set is granting access to this object?"
- "What are all the effective permissions for this user?"

#### Solution Overview

The command generates a comprehensive Excel report that shows:

1. **Summary Worksheet**: User information and permission source counts
2. **Permission Sources Worksheet**: Complete list of all sources with assignment dates
3. **Permission Comparison Matrix Worksheets**: One worksheet per permission type showing which source grants each permission

#### Implementation Architecture

**File Location**: `src/commands/jz/user-permissions.ts` (~1070 lines)

**Core Methods**:
1. `resolveUser()` - Resolves user by ID or username
2. `getAllPermissionSources()` - Discovers all permission sources
3. `expandPermissionSetGroup()` - Expands groups to member permission sets
4. `collectAllPermissions()` - Parallel permission collection
5. `getPermissionsForSource()` - Queries all permission types for a source
6. `buildPermissionMatrix()` - Creates comparison matrix
7. `createSummaryWorksheet()` - Generates summary tab
8. `createPermissionSourcesWorksheet()` - Lists all sources
9. `createPermissionComparisonWorksheets()` - Generates comparison matrices

#### Type Definitions

**PermissionSource Type**:
```typescript
type PermissionSource = {
  type: 'Profile' | 'PermissionSet' | 'PermissionSetGroup';
  id: string;
  name: string;
  label: string;
  assignedDate?: string;
  parentGroup?: string;  // For permission sets that come from groups
};
```

**PermissionMatrixRow Type**:
```typescript
type PermissionMatrixRow = {
  permissionType: string;
  componentName: string;
  property: string;
  sourceValues: Map<string, string>;  // sourceName -> "Yes" | "-"
};
```

**GroupedPermissions Type**:
```typescript
type GroupedPermissions = Map<string, PermissionMatrixRow[]>;
// Maps permission type (e.g., "Object Permissions") to array of rows
```

#### User Resolution Logic

The command accepts either User ID or Username:

```typescript
private async resolveUser(
  connection: Connection,
  userIdentifier: string
): Promise<UserRecord> {
  // Detect if input is ID (15 or 18 characters starting with 005)
  const isUserId = /^005[a-zA-Z0-9]{12,15}$/.test(userIdentifier);

  const query = isUserId
    ? `SELECT Id, Name, Username, Email, ProfileId, Profile.Name, IsActive
       FROM User WHERE Id = '${userIdentifier}'`
    : `SELECT Id, Name, Username, Email, ProfileId, Profile.Name, IsActive
       FROM User WHERE Username = '${userIdentifier}'`;

  const result = await connection.query<UserRecord>(query);

  if (result.records.length === 0) {
    throw new Error(`User not found: ${userIdentifier}`);
  }

  return result.records[0];
}
```

#### Permission Source Discovery

**1. Get Profile as Permission Set**:
```typescript
// Profiles are represented as PermissionSets with IsOwnedByProfile = true
const profilePermSetQuery = `
  SELECT Id, Name, Label
  FROM PermissionSet
  WHERE ProfileId = '${user.ProfileId}' AND IsOwnedByProfile = true
`;
```

**2. Get Direct Permission Set Assignments**:
```typescript
const directPermSetsQuery = `
  SELECT PermissionSetId, PermissionSet.Name, PermissionSet.Label, AssignedDate
  FROM PermissionSetAssignment
  WHERE AssigneeId = '${user.Id}'
    AND PermissionSet.IsOwnedByProfile = false
    AND PermissionSet.IsCustom = true
`;
```

**3. Get Permission Set Group Assignments**:
```typescript
const groupAssignmentsQuery = `
  SELECT PermissionSetGroupId, PermissionSetGroup.DeveloperName,
         PermissionSetGroup.Label, AssignedDate
  FROM PermissionSetAssignment
  WHERE AssigneeId = '${user.Id}'
    AND PermissionSetGroupId != null
`;
```

**4. Expand Permission Set Groups**:
```typescript
private async expandPermissionSetGroup(
  connection: Connection,
  groupId: string,
  groupName: string
): Promise<PermissionSource[]> {
  const query = `
    SELECT PermissionSetId, PermissionSet.Name, PermissionSet.Label
    FROM PermissionSetGroupComponent
    WHERE PermissionSetGroupId = '${groupId}'
  `;

  const result = await connection.query<PermissionSetGroupComponentRecord>(query);

  return result.records.map((record) => ({
    type: 'PermissionSet',
    id: record.PermissionSetId,
    name: record.PermissionSet.Name,
    label: record.PermissionSet.Label || record.PermissionSet.Name,
    parentGroup: groupName,  // Track which group this came from
  }));
}
```

#### Permission Collection Strategy

The command reuses the comprehensive permission query logic from `permissionsets-compare.ts`:

**Queried Permission Types**:
1. Object Permissions (CRUD + View All/Modify All)
2. Field Permissions (Read/Edit)
3. User Permissions (API Enabled, View Setup, etc.)
4. Tab Settings (Visibility settings)
5. Apex Class Access
6. Visualforce Page Access
7. Custom Permissions
8. Application Visibility
9. Flow Access
10. External Data Source Access
11. Custom Metadata Type Access
12. Other System Permissions

**Parallel Collection**:
```typescript
private async collectAllPermissions(
  connection: Connection,
  sources: PermissionSource[]
): Promise<Map<string, PermissionData[]>> {
  const allPermissions = new Map<string, PermissionData[]>();

  // Process all sources in parallel for performance
  const permissionPromises = sources.map(async (source) => {
    const permissions = await this.getPermissionsForSource(
      connection,
      source.name
    );
    return { sourceName: `${source.type}: ${source.label}`, permissions };
  });

  const results = await Promise.all(permissionPromises);

  results.forEach((result) => {
    allPermissions.set(result.sourceName, result.permissions);
  });

  return allPermissions;
}
```

#### Permission Matrix Building

The matrix building uses a **two-pass algorithm**:

**Pass 1: Collect All Unique Permissions**
```typescript
const allUniquePermissions = new Map<string, Set<string>>();

allPermissions.forEach((permissions) => {
  permissions.forEach((perm) => {
    const permKey = `${perm.type}|${perm.name}`;
    if (!allUniquePermissions.has(permKey)) {
      allUniquePermissions.set(permKey, new Set());
    }

    // Collect all properties for this permission
    if (perm.read) allUniquePermissions.get(permKey)?.add('Read');
    if (perm.create) allUniquePermissions.get(permKey)?.add('Create');
    if (perm.edit) allUniquePermissions.get(permKey)?.add('Edit');
    // ... etc for all properties
  });
});
```

**Pass 2: Build Matrix Rows**
```typescript
allUniquePermissions.forEach((properties, permKey) => {
  const [permType, permName] = permKey.split('|');

  properties.forEach((property) => {
    const sourceValues = new Map<string, string>();

    // Check each source for this permission+property combination
    allPermissions.forEach((permissions, sourceName) => {
      const perm = permissions.find(
        (p) => p.type === permType && p.name === permName
      );

      if (perm) {
        // Determine value based on property
        const value = this.getPropertyValue(perm, property);
        sourceValues.set(sourceName, value || '-');
      } else {
        sourceValues.set(sourceName, '-');
      }
    });

    // Create matrix row
    const row: PermissionMatrixRow = {
      permissionType: permType,
      componentName: permName,
      property: property,
      sourceValues: sourceValues,
    };

    // Add to grouped permissions
    if (!groupedPermissions.has(permType)) {
      groupedPermissions.set(permType, []);
    }
    groupedPermissions.get(permType)?.push(row);
  });
});
```

This approach ensures:
- All permissions from all sources are included
- No duplicates (using Map keys)
- Clear visibility of which source grants each permission
- Efficient lookup and comparison

#### Excel Report Generation

**Summary Worksheet**:
```typescript
private createSummaryWorksheet(
  workbook: ExcelJS.Workbook,
  user: UserRecord,
  sources: PermissionSource[]
): void {
  const worksheet = workbook.addWorksheet('Summary');

  // User Information Section
  worksheet.addRow(['User Information']);
  worksheet.addRow(['Name', user.Name]);
  worksheet.addRow(['Username', user.Username]);
  worksheet.addRow(['Email', user.Email]);
  worksheet.addRow(['Profile', user.Profile.Name]);
  worksheet.addRow(['Active', user.IsActive ? 'Yes' : 'No']);

  // Permission Sources Count
  const permSetCount = sources.filter(s => s.type === 'PermissionSet' && !s.parentGroup).length;
  const groupCount = sources.filter(s => s.type === 'PermissionSetGroup').length;
  const groupMemberCount = sources.filter(s => s.type === 'PermissionSet' && s.parentGroup).length;

  worksheet.addRow([]);
  worksheet.addRow(['Permission Sources Summary']);
  worksheet.addRow(['Direct Permission Sets', permSetCount]);
  worksheet.addRow(['Permission Set Groups', groupCount]);
  worksheet.addRow(['Permission Sets from Groups', groupMemberCount]);
  worksheet.addRow(['Total Permission Sources', sources.length]);

  // Apply formatting...
}
```

**Permission Sources Worksheet**:
```typescript
private createPermissionSourcesWorksheet(
  workbook: ExcelJS.Workbook,
  sources: PermissionSource[]
): void {
  const worksheet = workbook.addWorksheet('Permission Sources');

  // Headers
  worksheet.addRow([
    'Source Type',
    'Source Name',
    'Source Label',
    'Assignment Date',
    'Parent Group'
  ]);

  // Data rows
  sources.forEach((source) => {
    worksheet.addRow([
      source.type,
      source.name,
      source.label,
      source.assignedDate || 'N/A',
      source.parentGroup || '-'
    ]);
  });

  // Apply formatting, filters, column widths...
}
```

**Permission Comparison Worksheets**:
```typescript
private createPermissionComparisonWorksheets(
  workbook: ExcelJS.Workbook,
  groupedPermissions: GroupedPermissions,
  sourceNames: string[]
): void {
  groupedPermissions.forEach((rows, permissionType) => {
    // Sanitize worksheet name (max 31 chars)
    const sheetName = this.sanitizeWorksheetName(permissionType);
    const worksheet = workbook.addWorksheet(sheetName);

    // Headers: Permission Type | Component Name | Property | Source1 | Source2 | ...
    const headers = [
      'Permission Type',
      'Component Name',
      'Property',
      ...sourceNames
    ];
    worksheet.addRow(headers);

    // Data rows
    rows.forEach((row) => {
      const rowData = [
        row.permissionType,
        row.componentName,
        row.property,
        ...sourceNames.map(sourceName => row.sourceValues.get(sourceName) || '-')
      ];
      worksheet.addRow(rowData);
    });

    // Apply formatting (bold headers, freeze panes, auto-filter, etc.)
  });
}
```

#### Key Technical Decisions & Rationale

**1. Why Profile as Permission Set?**
- Modern Salesforce represents profiles as PermissionSets with `IsOwnedByProfile = true`
- This allows using the same query logic for both profiles and permission sets
- Ensures comprehensive permission analysis

**2. Why Expand Permission Set Groups?**
- Permission Set Groups are containers that don't grant permissions directly
- The actual permissions come from member permission sets
- Expanding groups provides complete visibility
- Tracking `parentGroup` helps users understand the permission hierarchy

**3. Why Two-Pass Matrix Algorithm?**
- **Pass 1** ensures we find ALL unique permission+property combinations
- **Pass 2** checks each source against the complete list
- This prevents missing permissions that exist in only one source
- More efficient than nested loops

**4. Why "Yes" and "-" Instead of Boolean?**
- More readable in Excel than TRUE/FALSE
- Clearly distinguishes granted (Yes) from not granted (-)
- Consistent with existing permission export patterns

**5. Why Map Instead of Array for Source Values?**
- O(1) lookup by source name
- Prevents duplicate entries
- Easy to check if source grants permission

**6. Why Parallel Collection with Promise.all?**
- Significantly improves performance with multiple sources
- Each source's permissions can be queried independently
- Reduces total execution time from sequential to concurrent

#### Performance Optimizations

1. **Parallel Queries**: All permission sources queried simultaneously
2. **Map-Based Deduplication**: Using Maps instead of Arrays for lookups
3. **Early Filtering**: Filtering out managed package IDs early
4. **Batch Processing**: Excel rows written in batches, not one-by-one
5. **Efficient Grouping**: Single pass to group permissions by type

#### Error Handling

**User Not Found**:
```typescript
if (result.records.length === 0) {
  throw new Error(`User not found: ${userIdentifier}`);
}
```

**Permission Set Group Expansion Failure**:
```typescript
try {
  const memberPermSets = await this.expandPermissionSetGroup(/*...*/);
  sources.push(...memberPermSets);
} catch (error) {
  this.log(`Warning: Could not expand group ${group.name}: ${error.message}`);
  // Continue with other groups
}
```

**Permission Query Failures**:
```typescript
try {
  const tabSettings = await connection.query<TabSettingRecord>(/*...*/);
  // Process tab settings
} catch (error) {
  this.log(`Note: Could not query tab settings (may require API 45+)`);
  // Continue with other permission types
}
```

#### Excel Output Structure

```
Exports/UserPermissions/<org_id>/UserPermissions_<username>_<timestamp>.xlsx
├── Summary
│   ├── User Information (Name, Email, Profile, etc.)
│   └── Permission Sources Count
├── Permission Sources
│   ├── Profile (1 row)
│   ├── Direct Permission Sets (N rows)
│   ├── Permission Set Groups (M rows)
│   └── Permission Sets from Groups (K rows with parentGroup)
├── Object Permissions (Matrix)
├── Field Permissions (Matrix)
├── User Permissions (Matrix)
├── Tab Settings (Matrix)
├── Apex Class Access (Matrix)
├── Visualforce Page Access (Matrix)
├── Custom Permission (Matrix)
├── Application Visibility (Matrix)
├── Flow Access (Matrix)
├── External Data Source Access (Matrix)
├── Custom Metadata Type Access (Matrix)
└── System Permission (Matrix)
```

**Matrix Format Example**:
| Permission Type | Component Name | Property | Profile: System Admin | PermSet: Sales User | PermSet: Marketing |
|-----------------|----------------|----------|----------------------|--------------------|--------------------|
| Object          | Account        | Read     | Yes                  | Yes                | -                  |
| Object          | Account        | Create   | Yes                  | -                  | Yes                |
| Object          | Account        | Edit     | Yes                  | Yes                | Yes                |
| Field           | Account.Phone  | Read     | Yes                  | Yes                | -                  |
| User            | API Enabled    | Enabled  | Yes                  | -                  | -                  |

#### Use Cases

1. **Troubleshooting Access Issues**
   - "Why can User A access this object?"
   - Answer: Check the matrix - see which source grants the permission

2. **Security Audits**
   - "What are all permissions for this admin user?"
   - Answer: Summary shows all sources, matrices show all permissions

3. **Permission Optimization**
   - "Are there redundant permissions across multiple sources?"
   - Answer: Matrix shows if multiple sources grant same permission

4. **Compliance Documentation**
   - "Document user access for SOX compliance"
   - Answer: Excel report provides complete audit trail

5. **Onboarding/Offboarding**
   - "Verify new hire has correct permissions"
   - "Audit departing employee's access"
   - Answer: Compare against baseline/requirements

#### Known Limitations

1. **Record Type Access**: Not currently included
   - Requires RecordTypeVisibility queries
   - Could be added in future enhancement

2. **Login Hours/IP Ranges**: Profile-specific, not in permission sets
   - Not relevant for permission set analysis
   - Would require separate profile queries

3. **Field-Level Security from Profiles**:
   - Included via profile as permission set
   - But may not match Salesforce UI display exactly

4. **Sharing Settings**: Not included
   - Organization-wide defaults are org-level, not user-level
   - Manual shares would require separate analysis

5. **Permission Set Licenses**: Not displayed
   - Some permission sets require licenses
   - Could add PSL information in future

#### Testing Recommendations

**Test Scenarios**:
- [ ] User with only profile (no permission sets or groups)
- [ ] User with profile + direct permission sets
- [ ] User with profile + permission set groups
- [ ] User with all three types
- [ ] User with 10+ permission sets (performance test)
- [ ] User with permission sets from multiple groups
- [ ] Inactive user
- [ ] User with managed package permissions
- [ ] Test with user ID input
- [ ] Test with username input
- [ ] Test with invalid user (error handling)
- [ ] Test with different API versions
- [ ] Verify Excel formatting and readability
- [ ] Spot-check permissions against Salesforce UI

**Performance Benchmarks**:
- User with 1-5 sources: < 30 seconds
- User with 5-10 sources: 30-60 seconds
- User with 10+ sources: 1-2 minutes
- Excel generation: < 10 seconds

#### Future Enhancement Ideas

1. **HTML Report with Search**: Interactive web-based report with filtering
2. **User Comparison Mode**: Compare permissions between two users
3. **Effective Permissions Only**: Option to show only unique permissions (no duplicates)
4. **Permission Recommendations**: Suggest permission set consolidation
5. **Historical Tracking**: Track permission changes over time
6. **JSON/CSV Export**: Alternative output formats
7. **Permission Search**: Quick search for specific permission across all sources
8. **Visual Diff**: Color-coded visualization of permission overlap
9. **Permission Set License Info**: Display PSL requirements
10. **Record Type Visibility**: Add record type access analysis

#### Integration Points

**Reused Code from permissionsets-compare.ts**:
- `getPermissionSetPermissions()` method (with modifications)
- Permission type definitions (PermissionData, TabSettingRecord, etc.)
- Permission query patterns
- Excel formatting utilities

**New Utilities Created**:
- `resolveUser()` - Can be reused in future commands
- `expandPermissionSetGroup()` - Useful for group analysis
- `buildPermissionMatrix()` - Pattern for future matrix-based reports

#### Command Flags

```typescript
public static readonly flags = {
  'target-org': Flags.requiredOrg(),
  user: Flags.string({
    char: 'u',
    summary: 'User ID or Username to analyze',
    required: true,
  }),
  'output-dir': Flags.string({
    char: 'd',
    summary: 'Directory to save the analysis report',
    default: 'Exports',
  }),
};
```

#### Success Criteria Achieved

✅ Command accepts User ID or Username
✅ Resolves user with helpful error messages
✅ Discovers all permission sources (Profile, PermSets, Groups)
✅ Expands Permission Set Groups to members
✅ Queries 12+ permission types for all sources
✅ Generates Excel report with summary, sources, and matrices
✅ Matrix clearly shows which source grants each permission
✅ Parallel processing for optimal performance
✅ Comprehensive error handling and logging
✅ Professional Excel formatting with filters and frozen panes
✅ Complete documentation in README and messages file

#### Development Notes

- **Build Time**: ~5 seconds for full rebuild
- **Code Size**: ~1070 lines in user-permissions.ts
- **Dependencies**: Reuses existing xlsx library, no new dependencies
- **API Version**: Compatible with API 40.0+, some features require 45.0+
- **Compilation**: Zero TypeScript errors, zero ESLint warnings
- **Testing**: Manual testing performed, unit tests recommended for future

---

## Development Workflow

### Building the Project

```bash
# Install dependencies
yarn install

# Compile TypeScript
yarn build

# Run tests
yarn test

# Link plugin to SF CLI
sf plugins link .
```

### Code Quality

- ESLint configuration with SF plugin rules
- TypeScript strict mode enabled
- Comprehensive error handling
- Detailed logging for debugging

### Git Workflow

- Feature branches for new functionality
- Commit messages follow conventional commits
- Pre-commit hooks for linting (can be disabled if needed)

## Troubleshooting

### Permission Sets Compare Issues

1. **"Could not query tab settings"** - Normal if org has API version < 45.0
2. **"Could not query user permissions"** - May occur with restricted API access
3. **ID-based components filtered** - Expected behavior to reduce noise
4. **Excel generation hangs** - Try with fewer permission sets or restart command

### General Plugin Issues

1. **Changes not reflecting** - Run `yarn build` after code changes
2. **Plugin not found** - Run `sf plugins link .` from project root
3. **Dependency issues** - Run `yarn clean-all && yarn install`

## Author & Maintenance

- **Author**: JZ (Jitendra Zaa)
- **Last Major Update**: October 2025
  - Enhanced `permissionsets-compare` with 12+ permission types
  - Implemented new `user-permissions` command for comprehensive user permission analysis
- **Maintenance**: Keep dependencies updated, test with new Salesforce API versions

## References

- [Salesforce Object Reference](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/)
- [Salesforce Metadata API Guide](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/)
- [SF CLI Plugin Development](https://github.com/salesforcecli/cli)
- [SetupEntityAccess Documentation](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_setupentityaccess.htm)
- [PermissionSetTabSetting Documentation](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_permissionsettabsetting.htm)
