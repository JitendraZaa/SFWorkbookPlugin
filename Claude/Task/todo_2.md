# User Permissions Analyzer - Implementation Plan

## Problem Statement

It's time-consuming to understand why a specific user can see tabs, fields, objects, etc. in Salesforce. Users can have permissions from:
- Profile (1 profile per user)
- Permission Sets (0 to many)
- Permission Set Groups (0 to many, which themselves contain multiple permission sets)

This command will create a comprehensive Excel report showing all permissions from all sources for a specific user.

## Command Overview

**Command Name**: `jz user-permissions`

**Purpose**: Analyze and export all permission sources for a specific Salesforce user

**Input**:
- User ID or Username (required)
- Target Org (required)
- Output directory (optional, default: "Exports")

**Output**: Excel file with multiple worksheets showing consolidated permission analysis

## Excel Report Structure

### Worksheet 1: Summary
- User information (Name, Username, Email, Profile, Active status)
- Profile Name
- Number of Permission Sets assigned
- Number of Permission Set Groups assigned
- Total Permission Sets from groups (expanded count)
- Quick statistics

### Worksheet 2: Permission Sources
- List all permission sources
- Columns: Source Type | Source Name | Source Label | Assignment Date
- Rows:
  - Profile (1 row)
  - Direct Permission Sets (N rows)
  - Permission Set Groups (M rows)
  - Permission Sets from Groups (expanded, K rows)

### Worksheet 3-N: Permissions Comparison Matrix
One worksheet for each permission type:
- **Object Permissions**: Compare CRUD + View/Modify All across all sources
- **Field Permissions**: Compare Read/Edit across all sources
- **User Permissions**: Compare system permissions across all sources
- **Tab Settings**: Compare tab visibility across all sources
- **Apex Class Access**: Compare access across all sources
- **Visualforce Page Access**: Compare access across all sources
- **Custom Permissions**: Compare access across all sources
- **Application Visibility**: Compare app access across all sources
- **Other System Permissions**: Compare other permissions across all sources

**Matrix Format**:
| Permission Type | Component Name | Property | Profile: [Name] | PermSet: [Name1] | PermSet: [Name2] | ... |
|----------------|----------------|----------|-----------------|------------------|------------------|-----|
| Object         | Account        | Read     | Yes             | Yes              | -                | ... |
| Object         | Account        | Create   | Yes             | -                | Yes              | ... |
| Field          | Account.Phone  | Read     | Yes             | Yes              | -                | ... |

## Implementation Tasks

### Phase 1: Setup & Structure (Tasks 1-4)

- [ ] **Task 1: Create command file structure**
  - Create `src/commands/jz/user-permissions.ts`
  - Set up basic command class extending SfCommand
  - Define flags (user ID/username, target-org, output-dir)
  - Define result type for command output

- [ ] **Task 2: Create message file**
  - Create `messages/jz.user-permissions.md`
  - Add summary, description, examples
  - Add flag descriptions
  - Add usage examples

- [ ] **Task 3: Define TypeScript types**
  - User record type
  - Permission source type (profile, permset, permset group)
  - Permission matrix type
  - Assignment record types
  - Consolidated permission data types

- [ ] **Task 4: Create helper utilities**
  - Method to resolve user by ID or username
  - Method to get timestamp for filename
  - Method to setup export directory
  - Method to sanitize worksheet names

### Phase 2: Data Collection (Tasks 5-10)

- [ ] **Task 5: Implement user resolution**
  - Query User object by Id or Username
  - Get Profile information
  - Get basic user details (Name, Email, Active, etc.)
  - Error handling for user not found

- [ ] **Task 6: Get direct permission set assignments**
  - Query PermissionSetAssignment
  - Filter by user ID
  - Exclude profile-based permission sets
  - Get assignment dates
  - Return list of directly assigned permission sets

- [ ] **Task 7: Get permission set group assignments**
  - Query PermissionSetAssignment for groups
  - Filter for IsOwnedByProfile = false and permission set groups
  - Get assignment dates
  - Return list of permission set groups

- [ ] **Task 8: Expand permission set groups**
  - Query PermissionSetGroupComponent
  - For each group, get all member permission sets
  - Avoid duplicates with directly assigned permission sets
  - Track source (which group it came from)

- [ ] **Task 9: Get profile as permission set**
  - Query PermissionSet where ProfileId = user's profile
  - Profiles are represented as permission sets with IsOwnedByProfile = true
  - Get profile permission set details

- [ ] **Task 10: Collect all permissions for each source**
  - Reuse existing permission query logic from permissionsets-compare.ts
  - For profile: get all permissions
  - For each permission set: get all permissions
  - For each group member: get all permissions
  - Store permissions with source information

### Phase 3: Permission Analysis & Consolidation (Tasks 11-13)

- [ ] **Task 11: Build permission matrix structure**
  - Group permissions by type (Object, Field, User, Tab, etc.)
  - For each permission, create matrix row
  - Columns: Permission Type, Component Name, Property, [Source 1], [Source 2], ...
  - Mark which source grants each permission

- [ ] **Task 12: Consolidate duplicate permissions**
  - If same permission exists in multiple sources, mark all sources
  - Use "Yes" for granted, "-" for not granted
  - Handle conflicting permissions (document approach)

- [ ] **Task 13: Calculate summary statistics**
  - Count permission sets per group
  - Count total unique permissions
  - Count permissions by type
  - Identify effective permissions (any source grants it)

### Phase 4: Excel Report Generation (Tasks 14-18)

- [ ] **Task 14: Create Summary worksheet**
  - User information section
  - Permission sources count
  - Quick statistics
  - Professional formatting with headers

- [ ] **Task 15: Create Permission Sources worksheet**
  - List all permission sources (profile, permsets, groups)
  - Show assignment hierarchy
  - Include assignment dates
  - Format with colors for different source types

- [ ] **Task 16: Create permission comparison worksheets**
  - One worksheet per permission type
  - Matrix format with sources as columns
  - Apply conditional formatting
  - Set appropriate column widths
  - Add filters to headers

- [ ] **Task 17: Apply Excel formatting**
  - Header row formatting (bold, background color)
  - Column width auto-adjustment
  - Freeze panes on headers
  - Add borders to cells
  - Color-code permission types

- [ ] **Task 18: Save Excel workbook**
  - Generate filename with timestamp
  - Save to export directory
  - Return file path in result

### Phase 5: Testing & Documentation (Tasks 19-22)

- [ ] **Task 19: Add comprehensive logging**
  - Log user resolution
  - Log permission set discovery
  - Log permission collection progress
  - Log Excel generation progress
  - Log final statistics

- [ ] **Task 20: Add error handling**
  - Handle user not found
  - Handle permission query failures
  - Handle Excel generation errors
  - Provide helpful error messages
  - Graceful degradation for missing permissions

- [ ] **Task 21: Update README.md**
  - Add new command to command list
  - Add usage examples
  - Document output format
  - Add troubleshooting tips

- [ ] **Task 22: Update Claude_Notes.md**
  - Document new command
  - Add implementation notes
  - Document design decisions
  - Add technical details
  - Add testing recommendations

### Phase 6: Code Quality (Tasks 23-24)

- [ ] **Task 23: Add code comments**
  - Comment complex logic
  - Explain query structures
  - Document permission resolution logic
  - Add JZ as author in comments

- [ ] **Task 24: Build and test**
  - Run yarn build
  - Fix any compilation errors
  - Test command with sample user
  - Verify Excel output
  - Test error scenarios

## Technical Design Decisions

### 1. Permission Set Groups Handling

Permission Set Groups are essentially containers for multiple Permission Sets. When querying:
1. Get the group assignment to the user
2. Query PermissionSetGroupComponent to get all member permission sets
3. Treat each member as if directly assigned for permission analysis

### 2. Profile as Permission Set

In modern Salesforce, Profiles are represented as PermissionSets where `IsOwnedByProfile = true`. This allows us to use the same query logic for both profiles and permission sets.

### 3. Permission Matrix Format

The matrix shows each permission as a row, with sources as columns:
- "Yes" = permission is granted by this source
- "-" = permission is not granted by this source
- Empty = permission type not applicable to this source

### 4. Effective Permissions

If ANY source grants a permission, the user effectively has that permission. The report shows all sources to help admins understand the permission stack.

### 5. Reusing Existing Logic

We'll leverage the comprehensive permission query logic from `permissionsets-compare.ts`:
- Object Permissions
- Field Permissions
- User Permissions
- Tab Settings
- Apex Class Access
- Visualforce Page Access
- Custom Permissions
- Application Visibility
- Other System Permissions

### 6. Excel Worksheet Limits

Excel has worksheet name length limit (31 characters) and total worksheet limit (~255). We'll:
- Truncate long worksheet names
- Combine similar permission types if needed
- Use abbreviations where necessary

## Query Examples

### Get User Information
```sql
SELECT Id, Name, Username, Email, ProfileId, Profile.Name, IsActive
FROM User
WHERE Id = :userId OR Username = :username
```

### Get Direct Permission Set Assignments
```sql
SELECT PermissionSetId, PermissionSet.Name, PermissionSet.Label, AssignedDate
FROM PermissionSetAssignment
WHERE AssigneeId = :userId
AND PermissionSet.IsOwnedByProfile = false
AND PermissionSet.IsCustom = true
```

### Get Permission Set Group Assignments
```sql
SELECT PermissionSetGroupId, PermissionSetGroup.DeveloperName, AssignedDate
FROM PermissionSetAssignment
WHERE AssigneeId = :userId
AND PermissionSetGroup.Id != null
```

### Get Permission Sets in a Group
```sql
SELECT PermissionSetId, PermissionSet.Name, PermissionSet.Label
FROM PermissionSetGroupComponent
WHERE PermissionSetGroupId = :groupId
```

## Expected Output Example

```
Exports/
└── UserPermissions/
    └── <org_id>/
        └── UserPermissions_<username>_2025-10-12T10-30-45.xlsx
            ├── Summary (general info)
            ├── Permission Sources (list of all sources)
            ├── Object Permissions (matrix)
            ├── Field Permissions (matrix)
            ├── User Permissions (matrix)
            ├── Tab Settings (matrix)
            └── ... (other permission types)
```

## Success Criteria

1. Command successfully identifies user by ID or username
2. Command finds all permission sources (profile, direct permsets, groups)
3. Command expands permission set groups to member permission sets
4. Command queries all permission types for all sources
5. Excel report is generated with all required worksheets
6. Matrix format clearly shows which source grants each permission
7. Summary provides quick overview of permission sources
8. Error handling is robust and user-friendly
9. Performance is acceptable (completes within reasonable time)
10. Documentation is complete and accurate

## Potential Challenges & Solutions

### Challenge 1: Permission Set Groups API Availability
- **Issue**: PermissionSetGroup may not be available in all API versions
- **Solution**: Add try-catch with graceful degradation, log warning

### Challenge 2: Large Number of Permissions
- **Issue**: User may have hundreds of permission sets, thousands of permissions
- **Solution**: Implement progress logging, consider pagination, optimize queries

### Challenge 3: Excel Performance
- **Issue**: Writing large Excel files can be slow
- **Solution**: Use streaming if needed, batch writes, show progress

### Challenge 4: Duplicate Permissions
- **Issue**: Same permission from multiple sources
- **Solution**: Use Set/Map for deduplication, mark all sources in matrix

### Challenge 5: Conflicting Permissions
- **Issue**: Some permissions may conflict (shouldn't happen but could)
- **Solution**: Document that least restrictive wins, show all in report

## Testing Checklist

- [ ] Test with user ID
- [ ] Test with username
- [ ] Test with user having only profile
- [ ] Test with user having profile + permission sets
- [ ] Test with user having profile + permission set groups
- [ ] Test with user having all three
- [ ] Test with inactive user
- [ ] Test with user not found
- [ ] Test with org having API version < 45 (for tab settings)
- [ ] Test Excel output formatting
- [ ] Test with large permission set (100+ permissions)
- [ ] Verify matrix accuracy by spot-checking permissions in Salesforce UI

## Performance Considerations

1. **Parallel Queries**: Query all permission sources' permissions in parallel using Promise.all
2. **Caching**: Cache permission set data to avoid redundant queries
3. **Batch Processing**: If needed, process permissions in batches
4. **Streaming Excel**: Consider streaming for very large reports
5. **Progress Indicators**: Show progress for long-running operations

## Future Enhancements

1. **HTML Report**: Alternative HTML output with interactive filtering
2. **Comparison Mode**: Compare permissions between two users
3. **Recommendation Engine**: Suggest permission consolidation opportunities
4. **Permission Audit**: Track changes over time
5. **Export to CSV**: Alternative CSV format for data analysis
6. **Permission Search**: Quick search for specific permission

## Implementation Notes

- Leverage existing permission query logic from permissionsets-compare.ts
- Follow project patterns from permissionsets.ts
- Use same Excel library (xlsx) and formatting patterns
- Follow project naming conventions
- Add comprehensive error handling
- Include detailed logging for debugging
- Use TypeScript strict mode
- Follow ESLint rules
