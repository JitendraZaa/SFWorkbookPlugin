# summary

Generate package.xml for all email templates from the specified Salesforce org

# description

This command queries all email templates from a Salesforce org and generates a package.xml file for metadata deployment. It provides a comprehensive solution for extracting email template metadata that can be used with Salesforce CLI, Workbench, or other deployment tools.

The command analyzes email templates and creates:

- A properly formatted package.xml file with fully qualified email template names (folder/template format)
- A detailed summary report showing template information and statistics
- Validation of template metadata to ensure compatibility with deployment tools
- Organized directory structure by org ID for easy management

Features:

- Query all email templates or filter by specific template types
- Option to include or exclude inactive email templates
- Dry-run mode to preview the package.xml content without creating files
- Comprehensive validation of template metadata
- Detailed logging and progress reporting
- Summary report with template breakdown by type and folder
- Professional error handling and recovery

Email template types supported:

- text: Plain text templates
- html: HTML templates
- custom: Lightning email templates
- visualforce: Visualforce email templates

# examples

- Generate package.xml for all active email templates:
  <%= config.bin %> <%= command.id %> --target-org myorg

- Include inactive email templates:
  <%= config.bin %> <%= command.id %> --target-org myorg --include-inactive

- Filter by specific template types:
  <%= config.bin %> <%= command.id %> --target-org myorg --template-types "html,custom"

- Preview package.xml content without creating files:
  <%= config.bin %> <%= command.id %> --target-org myorg --dry-run

- Export to custom directory:
  <%= config.bin %> <%= command.id %> --target-org myorg --output-dir "EmailTemplatePackages"

- Generate package.xml for HTML and Visualforce templates only:
  <%= config.bin %> <%= command.id %> --target-org prod --template-types "html,visualforce" --output-dir "Deployments"

- Include all templates (active and inactive) with dry-run:
  <%= config.bin %> <%= command.id %> --target-org sandbox --include-inactive --dry-run

# flags.output-dir.summary

Directory where the package.xml and summary files will be saved

# flags.output-dir.description

Specify the base directory where the email templates package.xml and summary report will be saved. The command will create a subdirectory structure: [output-dir]/EmailTemplates/[org-id]/.

The default directory is 'Exports' in the current working directory. Each export creates timestamped files to avoid conflicts with previous exports.

# flags.include-inactive.summary

Include inactive email templates in the package.xml

# flags.include-inactive.description

When set, this flag includes inactive email templates in the package.xml generation. By default, only active email templates are included to ensure deployments don't include templates that are not currently in use.

Inactive templates may cause deployment issues if they reference deleted fields or objects, so use this flag carefully.

# flags.template-types.summary

Comma-separated list of email template types to include

# flags.template-types.description

Filter the email templates by specific template types. Provide a comma-separated list of template types to include in the package.xml. If not specified, all template types are included.

Supported template types:

- text: Plain text email templates
- html: HTML email templates
- custom: Lightning email templates (custom HTML)
- visualforce: Visualforce email templates

Example: "html,custom" will include only HTML and Lightning email templates.

# flags.dry-run.summary

Preview the package.xml content without creating files

# flags.dry-run.description

Run in preview mode to see what email templates would be included in the package.xml without actually creating any files. This is useful for:

- Verifying which templates would be included based on your filter criteria
- Checking the generated package.xml format
- Understanding the scope of templates before committing to file creation
- Testing different filter combinations

The command will display the complete package.xml content and summary statistics in the console output.
