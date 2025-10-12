# Permission Sets Compare - Enhancement Plan

## Analysis Summary

Based on analysis of the current `jz permissionsets-compare` command and Salesforce documentation, the following permission types are **currently implemented**:

### ✅ Currently Implemented
1. **Object Permissions** (via ObjectPermissions)
   - Read, Create, Edit, Delete, View All Records, Modify All Records
2. **Field Permissions** (via FieldPermissions)
   - Read and Edit permissions for each field
3. **System Permissions** (via SetupEntityAccess)
   - Administrative and functional permissions (queried by SetupEntityId)

### ❌ Missing Permission Types

The following permission types are **NOT currently included** in the comparison but are part of Salesforce Permission Sets:

4. **User Permissions** (boolean permissions like "API Enabled", "View Setup", etc.)
   - Currently queried as "System Permissions" but only by SetupEntityId (which is often an ID)
   - Need to add explicit user permission fields from PermissionSet object

5. **Application Visibility** (via PermissionSetApplicationVisibility)
   - Which connected apps and applications are visible to users

6. **Apex Class Access** (via SetupEntityAccess with SetupEntityType = 'ApexClass')
   - Currently partially covered but needs proper filtering and labeling

7. **Visualforce Page Access** (via SetupEntityAccess with SetupEntityType = 'ApexPage')
   - Currently partially covered but needs proper filtering and labeling

8. **Tab Settings/Visibility** (via PermissionSetTabSetting)
   - Whether tabs are Available, Visible, Hidden, Default On, Default Off

9. **Custom Permissions** (via SetupEntityAccess with SetupEntityType = 'CustomPermission')
   - Custom permissions defined in the org

10. **Record Type Visibility** (via RecordTypeVisibilityAccess or related objects)
    - Which record types are visible/available

11. **External Data Source Access** (via SetupEntityAccess with SetupEntityType = 'ExternalDataSource')
    - Access to external data sources

12. **Custom Metadata Type Access** (via SetupEntityAccess with SetupEntityType = 'CustomMetadata')
    - Access to custom metadata types

13. **Flow Access** (via SetupEntityAccess with SetupEntityType = 'Flow')
    - Access to specific flows

## Detailed Enhancement Plan

### Task List

- [ ] **Task 1: Research and validate missing permission types**
  - Review Salesforce Object Reference for PermissionSet related objects
  - Verify which objects are queryable via SOQL
  - Test queries in a sample org to ensure they work
  - Document findings

- [ ] **Task 2: Enhance data models (TypeScript types)**
  - Add new types for Application Visibility
  - Add new types for Apex Class Access
  - Add new types for Visualforce Page Access
  - Add new types for Tab Settings
  - Add new types for Custom Permissions
  - Add new types for Record Type Visibility
  - Update PermissionData type to accommodate all permission types
  - Update PermissionDifference type if needed

- [ ] **Task 3: Implement User Permissions queries**
  - Add method to query user permission fields directly from PermissionSet
  - Common fields: PermissionsApiEnabled, PermissionsViewSetup, PermissionsModifyAllData, etc.
  - Update getPermissionSetPermissions to include user permissions
  - Add proper comparison logic for user permissions

- [ ] **Task 4: Implement Application Visibility queries**
  - Query PermissionSetApplicationVisibility object
  - Map application names and visibility settings
  - Add to permission comparison logic
  - Create appropriate worksheet formatting

- [ ] **Task 5: Improve System Permissions (SetupEntityAccess)**
  - Refactor to properly categorize by SetupEntityType
  - Separate Apex Classes, VF Pages, Custom Permissions, etc.
  - Add proper labeling for each type
  - Filter out ID-based components appropriately

- [ ] **Task 6: Implement Tab Settings queries**
  - Query PermissionSetTabSetting object
  - Extract tab name and visibility settings (Available, Visible, Hidden, etc.)
  - Add to permission comparison logic
  - Handle standard vs custom tab naming conventions

- [ ] **Task 7: Implement Custom Permissions queries**
  - Query SetupEntityAccess filtered by SetupEntityType = 'CustomPermission'
  - Get proper custom permission names (not IDs)
  - Add to comparison logic with proper labeling

- [ ] **Task 8: Implement Record Type Visibility**
  - Research the correct object (likely needs metadata API)
  - Implement query logic if available via SOQL
  - Add to comparison if feasible, otherwise document limitation

- [ ] **Task 9: Update Excel report generation**
  - Update worksheet headers to include new permission types
  - Ensure proper categorization in worksheets
  - Update summary worksheet to show counts for all permission types
  - Add color coding or formatting for different permission types

- [ ] **Task 10: Update comparison logic**
  - Ensure all new permission types are compared properly
  - Update comparePermissionProperties to handle new fields
  - Update shouldIgnoreComponent to handle new permission types appropriately
  - Test with different org configurations

- [ ] **Task 11: Add comprehensive logging**
  - Log counts for each permission type found
  - Log any permission types that fail to query
  - Add debug mode flag for detailed logging (optional enhancement)

- [ ] **Task 12: Update documentation**
  - Update messages/jz.permissionsets-compare.md with new permission types
  - Update README.md with enhanced capabilities
  - Add examples showing new permission types in output
  - Document any limitations discovered

- [ ] **Task 13: Update tests**
  - Add test cases for new permission types
  - Update existing tests to accommodate new data structures
  - Add integration tests if possible

- [ ] **Task 14: Performance optimization**
  - Review query performance with new permission types
  - Optimize parallel queries where possible
  - Add progress indicators for long-running operations

- [ ] **Task 15: Update Claude_Notes.md**
  - Document all changes made
  - Update architecture notes
  - Remove outdated information
  - Add any gotchas or limitations discovered

## Priority Ranking

**High Priority** (Most commonly needed):
1. User Permissions (Task 3)
2. Application Visibility (Task 4)
3. Tab Settings (Task 6)
4. Custom Permissions (Task 7)

**Medium Priority** (Commonly used):
5. Improved System Permissions categorization (Task 5)
6. Apex Class Access (part of Task 5)
7. Visualforce Page Access (part of Task 5)

**Low Priority** (Less commonly used but good for completeness):
8. Record Type Visibility (Task 8)
9. External Data Source Access (future enhancement)
10. Custom Metadata Type Access (future enhancement)
11. Flow Access (future enhancement)

## Implementation Notes

- Start with high-priority items that are most impactful
- Keep changes simple and focused - one permission type at a time
- Test each permission type addition independently
- Some permission types may require Metadata API instead of Tooling API
- Document any limitations or API restrictions discovered
- Maintain backward compatibility with existing functionality

## Testing Strategy

1. Test with orgs that have diverse permission sets
2. Test with standard vs custom permission sets
3. Test with managed package permissions
4. Validate Excel output formatting
5. Performance test with large permission sets
6. Cross-org comparison validation

## Expected Outcomes

After implementing all enhancements:
- More comprehensive permission set comparison
- Better visibility into permission differences
- Fewer "missing" comparisons due to incomplete data
- More actionable insights for org administrators
- Professional-grade comparison reports
