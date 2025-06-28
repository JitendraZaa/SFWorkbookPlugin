# summary

Compare permission sets between two Salesforce orgs and highlight differences

# description

The `sf jz permissionsets-compare` command performs a comprehensive comparison of permission sets between two Salesforce orgs. It identifies permission sets that exist in both orgs and analyzes their differences, including object permissions, field permissions, and system permissions.

The command generates a detailed Excel report showing:

- **Permission sets with differences**: Each permission set that has differences gets its own worksheet showing exactly what differs between the two orgs
- **Summary worksheet**: Overview of all comparisons, permission sets only in source, and permission sets only in target (appears as first tab)
- **Clear org identification**: Column headers include org aliases (e.g., "Source Value (dev-sandbox)", "Target Value (production)") for easy identification
- **Difference types**: Added (exists in target but not source), Removed (exists in source but not target), or Modified (different values)
- **Smart filtering**: Automatically excludes components with ID-like names since IDs are expected to differ between orgs

Only differences are shown in the output - if a permission set has identical permissions in both orgs, it won't appear in the detailed worksheets (though it will be noted in the summary). Missing permission sets are listed in the summary worksheet only, without creating individual tabs.

The comparison includes:

- **Object Permissions**: Read, Create, Edit, Delete, View All Records, Modify All Records for each object
- **Field Permissions**: Read and Edit permissions for each field
- **System Permissions**: Administrative and functional permissions

Use this command to:

- Identify configuration drift between sandbox and production orgs
- Compare permission sets before and after deployments
- Audit permission differences across different environments
- Validate permission set synchronization between orgs

# flags.source-org.summary

Source org to compare from

# flags.source-org.description

The source Salesforce org to compare permission sets from. This is typically your development or sandbox org.

# flags.target-org.summary

Target org to compare to

# flags.target-org.description

The target Salesforce org to compare permission sets to. This is typically your production or target deployment org.

# flags.permission-sets.summary

Comma-separated list of specific permission sets to compare

# flags.permission-sets.description

By default, all permission sets common to both orgs are compared. Use this flag to limit the comparison to specific permission sets by providing a comma-separated list of permission set names.

Example: "Custom_Admin,Sales_User,Marketing_Manager"

# flags.output-dir.summary

Directory to save the comparison report

# flags.output-dir.description

The directory where the Excel comparison report will be saved. The file will be saved in a subdirectory structure: [output-dir]/PermissionSets/Compare/[source-org-id]_vs_[target-org-id]/

Default: "Exports"

# flags.include-standard.summary

Include standard Salesforce permission sets in comparison

# flags.include-standard.description

By default, only custom permission sets are compared. Use this flag to also include standard Salesforce permission sets (like "Standard User", "System Administrator", etc.) in the comparison.

Note: Standard permission sets are typically identical across orgs, so this flag is usually only needed for specialized use cases.

# examples

- Compare all custom permission sets between two orgs:

  <%= config.bin %> <%= command.id %> --source-org dev-sandbox --target-org production

- Compare specific permission sets between orgs:

  <%= config.bin %> <%= command.id %> --source-org dev-sandbox --target-org production --permission-sets "Custom_Admin,Sales_Manager"

- Include standard permission sets in comparison:

  <%= config.bin %> <%= command.id %> --source-org dev-sandbox --target-org production --include-standard

- Save comparison to a specific directory:

  <%= config.bin %> <%= command.id %> --source-org dev-sandbox --target-org production --output-dir "PermissionAudits"

- Compare using org aliases with short flags:

  <%= config.bin %> <%= command.id %> -s dev -t prod -p "Marketing_User,Sales_User" -d "Reports"
