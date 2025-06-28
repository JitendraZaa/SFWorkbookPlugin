# summary

Perform comprehensive Salesforce org health check and generate detailed reports

# description

This command performs a comprehensive health check analysis of your Salesforce org to identify technical debt, performance issues, and optimization opportunities. It analyzes various components and generates detailed reports with actionable recommendations.

The health check analyzes:

- Apex classes and triggers (API versions, unused code, test coverage)
- Flows and Process Builders (inactive flows, old process builders)
- Validation rules and workflow rules (unused or inactive)
- Custom fields and objects (unused components, naming conventions)
- Permission sets and profiles (unused assignments)
- Reports and dashboards (unused or old components)
- Page layouts and record types (unused assignments)
- Storage usage and limits (data and file storage)
- Aura components and Visualforce pages (old API versions)

Features:

- Multiple report formats: Excel, Text, or both
- Comprehensive analysis across 15+ categories
- Severity-based issue classification (High, Medium, Low)
- Detailed recommendations for each issue type
- Organization summary statistics and usage metrics
- Organized export directory structure by org ID

# examples

- Perform comprehensive health check with both Excel and text reports:
  <%= config.bin %> <%= command.id %> --target-org myorg

- Generate only Excel report:
  <%= config.bin %> <%= command.id %> --target-org myorg --report-format excel

- Generate only text report:
  <%= config.bin %> <%= command.id %> --target-org myorg --report-format text

- Export to custom directory:
  <%= config.bin %> <%= command.id %> --target-org myorg --output-dir "HealthChecks"

- Perform health check with specific options:
  <%= config.bin %> <%= command.id %> --target-org myorg -f excel -d "MyReports"

# flags.output-dir.summary

Directory where the health check reports will be saved

# flags.output-dir.description

Specify the base directory where the health check reports will be saved. The command will create a subdirectory structure: [output-dir]/HealthReports/[org-id]/. The default directory is 'Exports' in the current working directory.

# flags.report-format.summary

Format for the generated health check reports

# flags.report-format.description

Choose the format for the health check reports. Options are:

- 'excel': Generate only Excel (.xlsx) report with multiple worksheets
- 'text': Generate only text (.txt) report with formatted output
- 'both': Generate both Excel and text reports (default)

The Excel format provides better visualization and filtering capabilities, while the text format is easier to read and share in plain text environments.

# flags.include-summary.summary

Include organization summary statistics in the report

# flags.include-summary.description

When enabled (default), includes comprehensive organization summary statistics in the health check report such as:

- Apex class usage and API version distribution
- Data and file storage usage with percentages
- Top storage consuming objects
- Overall health score and metrics

This provides valuable context for understanding the overall state of your Salesforce org.
