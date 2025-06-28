# summary

Salesforce plugin to export metadata in Workbook or perform org health check

# description

Export Salesforce objects metadata to Excel workbook or perform comprehensive org health check with PDF report. If --objects is not provided, then it will export metadata for first 5 objects. Use --health flag to perform technical debt analysis. For permission sets export, use the separate 'jz permissionsets' command.

# flags.name.summary

Use this command to export metadata in Workbook

# flags.name.description

Use this command to export metadata in Workbook

# examples

- Export specific objects metadata:
  <%= config.bin %> <%= command.id %> --target-org dev29 --objects "Account,Contact"

- Export objects metadata (first 5 objects if none specified):
  <%= config.bin %> <%= command.id %> --target-org dev29

- Perform org health check and generate PDF report:
  <%= config.bin %> <%= command.id %> --target-org dev29 --health
