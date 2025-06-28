# summary

Export permission sets metadata from the specified org to Excel workbook

# description

This command exports permission sets metadata from a Salesforce org to an Excel workbook. It extracts detailed information about object permissions, field permissions, and system permissions for the specified permission sets.

The command generates a comprehensive Excel workbook with separate worksheets for each permission set, containing:

- Object permissions (Read, Create, Edit, Delete, View All, Modify All)
- Field permissions (Read, Edit)
- System permissions and user permissions

Features:

- Export specific permission sets or all permission sets from the org
- Option to include or exclude standard Salesforce permission sets
- Organized export directory structure by org ID
- Detailed progress reporting and error handling
- Professional Excel formatting with proper headers and styling

# examples

- Export all custom permission sets from the org:
  <%= config.bin %> <%= command.id %> --target-org myorg

- Export specific permission sets:
  <%= config.bin %> <%= command.id %> --target-org myorg --permission-sets "Sales_User,Marketing_User"

- Export all permission sets including standard ones:
  <%= config.bin %> <%= command.id %> --target-org myorg --include-standard

- Export to a custom directory:
  <%= config.bin %> <%= command.id %> --target-org myorg --output-dir "Exports"

- Export specific permission sets with standard ones included:
  <%= config.bin %> <%= command.id %> --target-org myorg -p "Admin_Access" --include-standard

# flags.permission-sets.summary

Comma-separated list of permission set names to export

# flags.permission-sets.description

Specify which permission sets to export by providing a comma-separated list of permission set names. If not provided, all custom permission sets in the org will be exported. Use exact permission set names as they appear in Salesforce. Example: "Sales_User,Marketing_User,Support_Agent"

# flags.output-dir.summary

Directory where the Excel file will be exported

# flags.output-dir.description

Specify the base directory where the permission sets Excel file will be saved. The command will create a subdirectory structure: [output-dir]/PermissionSets/[org-id]/. The default directory is 'Exports' in the current working directory.

# flags.include-standard.summary

Include standard Salesforce permission sets in the export

# flags.include-standard.description

When set, this flag includes standard Salesforce permission sets (like Standard User, System Administrator, etc.) in the export. By default, only custom permission sets are exported to reduce file size and focus on organization-specific configurations.
