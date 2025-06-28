# sf_workbook - Salesforce DX Plugin for Configuration Workbook

## Capabilities

1. Export all debug logs in html format. HTML file "Exports/Logs/<org_Id>/index_num.html", detailed log files "Exports/Logs/<org_Id>/<date>/<username>/<log_id>.log"
1. Export all objects in excel
1. Export all permission sets in excel
1. Export Health report in Text and Excel

## Known Issue

1. Analysis is include Manage Package as well, we should exclude it from everywhere
1. System Overview page itself has tons of usefull information, we should include it in the report
1. Tabset system properties shows ID if component belongs to manage Package
1. Sometimes code hangs while creating excel, just cancel transaction and run again.

## Initial Setup

1. Download this Git
1. run `yarn install`
1. Navigate to main folder and run command `sf plugins link .`
1. After every change in code, make sure to run `yarn run build`

## Sample Plugin Commands

### Log Delete

1. `sf jz logdelete --target-org myorg --dry-run` Preview what would be deleted
1. `sf jz logdelete --target-org myorg --confirm` Delete all logs with confirmation
1. `sf jz logdelete --target-org myorg --confirm --batch-size 5` Delete in smaller batches

### Log Export

1. `sf jz log --target-org <org_alias>` - Export all debug log files from Salesforce org

### Health Check

1. `sf jz wbook --target-org <org_alias> --health` --perform health check

### Object Export

1. `sf jz wbook --target-org <org_alias> -e "Account,Contact"` - Main command to run this plugin. If --e is missing then it woulf try to export all objects

### Permission Set Export

1. `sf jz wbook --target-org <org_alias> -p "<csv permission set>"` - Exports permission sets in excel for selected permissions
1. `sf jz wbook --target-org <org_alias> -p " "` - Exports all permission sets in excel for selected permissions

### Call External Service Demo

1. `sf call external service` - This command make API call and provides some interesting facts about numbers

## Run Salesforce Code Analyzer

`sf code-analyzer run --output-file "codeAnalyzer/results.csv"`

## Important Links

- [How to create plugin documentation](https://github.com/salesforcecli/cli/wiki/Get-Started-And-Create-Your-First-Plug-In)

## Troubleshoot

1. If changes in plugin is not reflecting, that means after changes code is not compiled. Run this command in seperate terminal , so that after each file change code automatically compiled. `yarn compile --watch`
1. Remove Husky checks before git commit , else we would not be able to commit code in git `rm -rf .husky/`
1. If you get some error on dependencies etc, run below command to clear cache and install node plugins again

## Yarn Commands (Recommended)

This project uses **Yarn** as the package manager for better performance and consistency. Use these commands instead of npm equivalents:

### **Build Commands:**

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

### **Development Commands:**

```bash
# Install dependencies
yarn install    # or just: yarn

# Clean build artifacts
yarn clean
yarn clean-all

# Format code
yarn format

# Watch mode (auto-compile on file changes)
yarn compile --watch
```

### **Migration from npm:**

| **npm command**   | **Yarn equivalent**      |
| ----------------- | ------------------------ |
| `npm install`     | `yarn` or `yarn install` |
| `npm run build`   | `yarn build` ✨          |
| `npm run compile` | `yarn compile` ✨        |
| `npm run test`    | `yarn test` ✨           |
| `npm run lint`    | `yarn lint` ✨           |

### **Why Yarn?**

- **Faster installs** (parallel downloads)
- **Shorter commands** (`yarn build` vs `npm run build`)
- **Better caching** and dependency resolution
- **No mixed package manager warnings**

**Note:** This project has been cleaned to use only Yarn. The `package-lock.json` has been removed to prevent conflicts with `yarn.lock`.
