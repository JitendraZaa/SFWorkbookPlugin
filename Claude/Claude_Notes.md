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
│           ├── health.ts                 # Org health check
│           ├── wbook.ts                  # Export objects metadata
│           └── emailtemplates.ts         # Generate package.xml for email templates
├── messages/                             # Command documentation
├── test/                                 # Unit and integration tests
├── lib/                                  # Compiled JavaScript output
└── Claude/                               # Development notes and tasks
    └── Task/
        └── todo_1.md                     # Enhancement plan for permission sets compare
```

## Available Commands

1. **jz log** - Export debug logs with HTML summary
2. **jz logdelete** - Safely delete debug logs with dry-run mode
3. **jz permissionsets** - Export permission sets to Excel
4. **jz permissionsets-compare** - Compare permission sets between orgs (ENHANCED)
5. **jz health** - Comprehensive org health analysis
6. **jz wbook** - Export object metadata to Excel
7. **jz emailtemplates** - Generate package.xml for email templates

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
- **Maintenance**: Keep dependencies updated, test with new Salesforce API versions

## References

- [Salesforce Object Reference](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/)
- [Salesforce Metadata API Guide](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/)
- [SF CLI Plugin Development](https://github.com/salesforcecli/cli)
- [SetupEntityAccess Documentation](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_setupentityaccess.htm)
- [PermissionSetTabSetting Documentation](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_permissionsettabsetting.htm)
