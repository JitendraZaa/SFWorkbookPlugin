# summary

Analyze and export all permission sources for a specific Salesforce user

# description

The `sf jz user-permissions` command performs a comprehensive analysis of all permission sources for a specific Salesforce user. It identifies and analyzes permissions from the user's profile, directly assigned permission sets, and permission set groups (including their expanded member permission sets).

The command generates a detailed Excel report showing:

- **Summary**: User information, profile, and count of permission sources
- **Permission Sources**: Complete list of all permission sources (Profile, Permission Sets, Permission Set Groups) with assignment dates
- **Permission Comparison Matrix**: Detailed comparison showing which permissions are granted by which source

This command is invaluable for:

- **Troubleshooting Access Issues**: Quickly understand why a user can see specific tabs, objects, or fields
- **Security Audits**: Review all permissions granted to a user from various sources
- **Permission Optimization**: Identify redundant permissions across multiple sources
- **Compliance**: Document user access for compliance requirements
- **Onboarding/Offboarding**: Review and verify user permissions during lifecycle events

The comparison matrix shows permissions across all sources, making it easy to see:
- Which source grants each specific permission
- Overlapping permissions across multiple sources
- The effective permissions the user has (union of all sources)

# flags.target-org.summary

Target Salesforce org to analyze

# flags.target-org.description

The Salesforce org containing the user whose permissions you want to analyze. This should be an authenticated org accessible via Salesforce CLI.

# flags.user.summary

User ID or Username to analyze

# flags.user.description

The Salesforce user to analyze. You can specify either:
- **User ID**: 15 or 18-character Salesforce ID (e.g., "005xx000001X8Uz")
- **Username**: Full Salesforce username (e.g., "john.doe@company.com")

The command will automatically detect whether you provided an ID or username and query accordingly.

# flags.output-dir.summary

Directory to save the analysis report

# flags.output-dir.description

The directory where the Excel analysis report will be saved. The file will be saved in a subdirectory structure: [output-dir]/UserPermissions/[org-id]/

The filename will include the username and timestamp for easy identification.

Default: "Exports"

# examples

- Analyze user by username:

  <%= config.bin %> <%= command.id %> --target-org myorg --user john.doe@company.com

- Analyze user by ID:

  <%= config.bin %> <%= command.id %> --target-org myorg --user 005xx000001X8Uz

- Save to custom directory:

  <%= config.bin %> <%= command.id %> --target-org myorg --user john.doe@company.com --output-dir "SecurityAudits"

- Use short flags:

  <%= config.bin %> <%= command.id %> -o myorg -u john.doe@company.com -d "Reports"

- Analyze user in production org:

  <%= config.bin %> <%= command.id %> -o production -u admin@company.com
