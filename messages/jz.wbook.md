# summary

Salesforce plugin to export metadata in Workbook or perform org health check

# description

Export Salesforce metadata to Excel workbook or perform comprehensive org health check with PDF report. If --objects is not provided, then it will export all metadata in Workbook. Use --health flag to perform technical debt analysis.

# flags.name.summary

Use this command to export metadata in Workbook

# flags.name.description

Use this command to export metadata in Workbook

# examples

- <%= config.bin %> <%= command.id %> --target-org dev29 --objects "Account,Contact"
- <%= config.bin %> <%= command.id %> --target-org dev29 -p "perm1, perm2"
- <%= config.bin %> <%= command.id %> --target-org dev29 -p " "
- <%= config.bin %> <%= command.id %> --target-org dev29 --health
