# Salesforce DX Plugin for Configuration Workbook

## Overview

A comprehensive Salesforce DX plugin that provides multiple commands for analyzing, exporting, and managing your Salesforce org configuration and metadata. Each command is focused on a specific task to provide better usability and maintainability.

## Available Commands

This plugin provides 8 main commands (1 in development):

1. **`jz log`** - Export all debug logs with HTML summary and organized file structure
2. **`jz logdelete`** - Safely delete debug logs with dry-run and batch processing options
3. **`jz permissionsets`** - Export permission sets metadata to Excel workbook
4. **`jz permissionsets-compare`** - Compare permission sets between two orgs and highlight differences
5. **`jz health`** - Comprehensive org health check with detailed analysis and reports
6. **`jz wbook`** - Export Salesforce objects metadata to Excel workbook
7. **`jz emailtemplates`** - Generate package.xml for all email templates with folder structure
8. **`jz uicompare`** - [🚧 WORK IN PROGRESS] Compare UI layout between two orgs to ensure field consistency

## Capabilities

### Debug Log Management

- Export all debug logs in organized directory structure: `Exports/Logs/<org_id>/<date>/<username>/<log_id>.log`
- Generate HTML summary with search functionality and detailed log information
- Safely delete debug logs with confirmation and dry-run modes
- Batch processing to respect API limits and handle large volumes

### Metadata Export & Comparison

- Export objects metadata to Excel workbook with comprehensive field information
- Export permission sets with object permissions, field permissions, and system permissions
- Compare permission sets between two orgs to identify configuration differences
- Generate package.xml for email templates with proper folder structure for deployments
- Professional Excel formatting with multiple worksheets and proper headers

### UI Automation & Data Extraction

- 🚧 **WORK IN PROGRESS**: UI comparison between two Salesforce orgs to ensure field layout consistency
- Intended to compare Lead record UI layout, field sequence, and values between source and target orgs
- Will support both Lightning Experience and Salesforce Classic interfaces
- Planned structured JSON export with field comparison results

### Health Analysis

- Comprehensive org health check across 15+ categories
- Analysis of Apex classes, flows, validation rules, unused components, and more
- Multiple report formats (Excel, Text, or both)
- Severity-based issue classification with actionable recommendations
- Storage usage analysis and optimization suggestions

## Known Issues

1. Analysis includes Managed Packages - should exclude them from analysis
2. System Overview page has useful information that should be included in health reports
3. Tabset system properties show ID if component belongs to Managed Package
4. Sometimes Excel generation hangs - cancel and re-run if this occurs

## Initial Setup

1. Clone this repository

   ```bash
   git clone <repository-url>
   cd sf_workbook
   ```

2. Install dependencies

   ```bash
   yarn install
   ```

3. Link the plugin to Salesforce CLI

   ```bash
   sf plugins link .
   ```

4. Build the project after any code changes
   ```bash
   yarn build
   ```

## Command Reference

### Debug Log Export

**Export all debug logs from org:**

```bash
sf jz log --target-org <org_alias>
```

**Features:**

- Exports all debug logs to organized directory structure
- Generates HTML summary with search functionality
- Parallel processing for better performance
- Automatic retry mechanism for failed downloads
- Memory optimization for large logs

### Debug Log Deletion

**Preview what would be deleted (dry-run):**

```bash
sf jz logdelete --target-org myorg --dry-run
```

**Delete all logs with confirmation:**

```bash
sf jz logdelete --target-org myorg --confirm
```

**Delete in smaller batches:**

```bash
sf jz logdelete --target-org myorg --confirm --batch-size 5
```

**Features:**

- Safety-first approach with required confirmation
- Dry-run mode to preview deletions
- Configurable batch sizes (1-50 logs per batch)
- Progress tracking and error handling

### Health Check Analysis

**Comprehensive health check with both Excel and text reports:**

```bash
sf jz health --target-org myorg
```

**Generate only Excel report:**

```bash
sf jz health --target-org myorg --report-format excel
```

**Generate only text report:**

```bash
sf jz health --target-org myorg --report-format text
```

**Export to custom directory:**

```bash
sf jz health --target-org myorg --output-dir "Exports"
```

**Use short flags:**

```bash
sf jz health --target-org myorg -f excel -d "Reports" -s
```

**Features:**

- Analysis across 15+ categories (Apex, Flows, Validation Rules, etc.)
- Multiple report formats with professional formatting
- Severity-based issue classification (High, Medium, Low)
- Organization summary statistics and usage metrics
- Detailed recommendations for each issue type

### Email Templates Package.xml Generation

**Generate package.xml for all active email templates:**

```bash
sf jz emailtemplates --target-org myorg
```

**Include inactive email templates:**

```bash
sf jz emailtemplates --target-org myorg --include-inactive
```

**Filter by specific template types:**

```bash
sf jz emailtemplates --target-org myorg --template-types "html,custom"
```

**Preview package.xml content without creating files:**

```bash
sf jz emailtemplates --target-org myorg --dry-run
```

**Export to custom directory:**

```bash
sf jz emailtemplates --target-org myorg --output-dir "EmailTemplatePackages"
```

**Generate package.xml for HTML and Visualforce templates only:**

```bash
sf jz emailtemplates --target-org prod --template-types "html,visualforce" --output-dir "Deployments"
```

**Include all templates (active and inactive) with dry-run:**

```bash
sf jz emailtemplates --target-org sandbox --include-inactive --dry-run
```

**Features:**

- Generate properly formatted package.xml with fully qualified names (folder/template format)
- Query all email templates or filter by specific template types (text, html, custom, visualforce)
- Option to include or exclude inactive email templates
- Dry-run mode to preview package.xml content without creating files
- Comprehensive validation of template metadata for deployment compatibility
- Organized directory structure by org ID with timestamped files
- Detailed logging and progress reporting with sample template names
- Professional error handling and summary statistics

### UI Comparison Between Orgs (🚧 Work in Progress)

**⚠️ CURRENT STATUS: DEVELOPMENT IN PROGRESS**

This command is being developed to compare UI layouts between two Salesforce orgs to ensure field consistency, sequence, and layout match between environments (e.g., sandbox vs production).

**Intended Use Case:**
Compare Lead record UI between source and target orgs to verify:

- Field presence and sequence
- Section organization
- Field labels and types
- UI layout consistency

**Current Implementation Status:**

- ✅ SOQL-based record selection (eliminates list view dependency)
- ✅ Direct record navigation using record IDs
- ✅ Robust URL construction for various Salesforce domains
- ⚠️ Lightning field extraction in development
- ❌ Org comparison logic not yet implemented
- ❌ Comparison report generation pending

**Test Command (Single Org):**

```bash
sf jz uicompare --target-org myorg --dry-run
```

**Planned Features:**

- **Dual Org Comparison**: Compare UI layout between source and target orgs
- **Field Sequence Validation**: Ensure fields appear in same order
- **Layout Consistency Check**: Verify section organization matches
- **Difference Reporting**: Generate detailed reports of UI discrepancies
- **Multi-Object Support**: Extend beyond Lead records to other objects
- **Cross-UI Compatibility**: Support both Lightning and Classic interfaces

**Known Limitations:**

- Currently only attempts single-org data extraction
- Lightning field extraction needs refinement
- No comparison logic implemented yet
- Limited to Lead records in current implementation

**Development Notes:**

- SOQL query successfully finds Lead records
- Direct navigation working correctly
- Field extraction requires enhancement for modern Lightning UI
- Comparison algorithm and reporting engine pending implementation

### Permission Sets Export

**Export all custom permission sets:**

```bash
sf jz permissionsets --target-org myorg
```

**Export specific permission sets:**

```bash
sf jz permissionsets --target-org myorg --permission-sets "Sales_User,Marketing_User"
```

**Include standard Salesforce permission sets:**

```bash
sf jz permissionsets --target-org myorg --include-standard
```

**Export to custom directory:**

```bash
sf jz permissionsets --target-org myorg --output-dir "Exports"
```

**Use short flags:**

```bash
sf jz permissionsets --target-org myorg -p "Admin_Access" -d "CustomDir" -s
```

**Features:**

- Export custom or standard permission sets
- Comprehensive permission analysis (Object, Field, System permissions)
- Professional Excel formatting with separate worksheets
- Progress reporting and error handling

### Permission Sets Comparison

**Compare all custom permission sets between two orgs:**

```bash
sf jz permissionsets-compare --source-org dev-sandbox --target-org production
```

**Compare specific permission sets:**

```bash
sf jz permissionsets-compare --source-org dev-sandbox --target-org production --permission-sets "Custom_Admin,Sales_Manager"
```

**Include standard permission sets in comparison:**

```bash
sf jz permissionsets-compare --source-org dev-sandbox --target-org production --include-standard
```

**Export to custom directory:**

```bash
sf jz permissionsets-compare --source-org dev-sandbox --target-org production --output-dir "PermissionAudits"
```

**Use short flags:**

```bash
sf jz permissionsets-compare -s dev -t prod -p "Marketing_User,Sales_User" -d "Reports" -i
```

**Features:**

- Compare permission sets between source and target orgs
- Identify Added, Removed, and Modified permissions
- Comprehensive analysis (Object, Field, and System permissions)
- Generate detailed Excel reports with differences only
- Individual worksheets for each permission set with differences
- Summary worksheet with comparison overview
- Parallel processing for optimal performance
- Smart filtering to exclude identical permission sets from detailed output

### Objects Metadata Export

**Export specific objects:**

```bash
sf jz wbook --target-org myorg --objects "Account,Contact"
```

**Export default objects (first 5 if none specified):**

```bash
sf jz wbook --target-org myorg
```

**Features:**

- Export object metadata to Excel workbook
- Comprehensive field information and relationships
- Professional formatting with proper headers

### Call External Service Demo

**API demonstration command:**

```bash
sf call external service
```

This command demonstrates API calls and provides interesting facts about numbers.

## Development Workflow

### Build Commands

```bash
# Main build command (compiles TypeScript + runs lint)
yarn build

# Just compile TypeScript
yarn compile

# Run linter only
yarn lint

# Run tests
yarn test
```

### Development Commands

```bash
# Install dependencies
yarn install

# Clean build artifacts
yarn clean
yarn clean-all

# Format code
yarn format

# Watch mode (auto-compile on file changes)
yarn compile --watch
```

### Command Equivalents

| **npm command**   | **Yarn equivalent**      |
| ----------------- | ------------------------ |
| `npm install`     | `yarn` or `yarn install` |
| `npm run build`   | `yarn build` ✨          |
| `npm run compile` | `yarn compile` ✨        |
| `npm run test`    | `yarn test` ✨           |
| `npm run lint`    | `yarn lint` ✨           |

### Why Yarn?

- **Faster installs** (parallel downloads)
- **Shorter commands** (`yarn build` vs `npm run build`)
- **Better caching** and dependency resolution
- **Consistent dependency versions** with `yarn.lock`

## Code Analysis

Run Salesforce Code Analyzer for additional code quality checks:

```bash
sf code-analyzer run --output-file "codeAnalyzer/results.csv"
```

## Troubleshooting

### Common Issues

1. **Plugin changes not reflecting:**

   - Ensure code is compiled after changes: `yarn build`
   - Use watch mode for auto-compilation: `yarn compile --watch`

2. **Git commit issues with Husky:**

   - Remove Husky checks if needed: `rm -rf .husky/`

3. **Dependency issues:**

   - Clear cache and reinstall: `yarn clean-all && yarn install`

4. **Memory issues with large logs:**

   - The plugin includes memory optimization and garbage collection
   - Use smaller batch sizes for log processing if needed

5. **Excel generation hanging:**

   - Cancel the operation and run again
   - Ensure sufficient system memory for large datasets

6. **Permission set comparison issues:**

   - Ensure both orgs are accessible and authenticated
   - Some permission differences may be expected between sandbox and production environments
   - Standard permission sets are typically identical and can be excluded with the default behavior

7. **Email templates package.xml issues:**

   - Ensure templates have valid folder references (unfiled$public is default for unorganized templates)
   - Use dry-run mode first to verify template names and folder structure
   - Generated package.xml includes fully qualified names (folder/template) required for deployment

8. **UI Compare issues (🚧 Work in Progress):**
   - **⚠️ Feature incomplete**: UI comparison is currently under development and may not produce expected results
   - **Field extraction**: Lightning UI field extraction needs enhancement - currently returns empty sections
   - **Single org only**: Command currently only processes one org; dual-org comparison not yet implemented
   - **Limited object support**: Currently limited to Lead records only
   - **No comparison output**: Comparison reports and difference analysis not yet available
   - **SOQL working**: Record selection and navigation working correctly
   - **Use dry-run**: Use `--dry-run` flag to test command setup without browser automation
   - **Development status**: Command foundation is solid but field extraction and comparison logic pending

### Performance Tips

- Use dry-run mode first to estimate processing time for log operations
- Use smaller batch sizes for orgs with many debug logs
- Choose specific permission sets instead of exporting all when possible
- Use text format for health reports if Excel generation is slow
- For permission set comparisons, specify individual permission sets rather than comparing all when possible
- Permission set comparisons use parallel processing automatically for better performance
- Use dry-run mode with email templates to preview results before generating package.xml files
- Filter email templates by specific types when you only need certain template categories
- UI Compare is currently under development - use dry-run mode for testing
- SOQL-based record selection eliminates list view filter dependencies (working correctly)
- Direct record navigation provides reliable access (implemented and working)
- Field extraction and comparison logic still in development

## Important Links

- [Salesforce CLI Plugin Development Guide](https://github.com/salesforcecli/cli/wiki/Get-Started-And-Create-Your-First-Plug-In)
- [sf-plugins-core Documentation](https://github.com/salesforcecli/sf-plugins-core)
- [Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `yarn test`
5. Build the project: `yarn build`
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
