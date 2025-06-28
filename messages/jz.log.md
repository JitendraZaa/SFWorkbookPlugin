# summary

Export all debug log files from Salesforce org

# description

Login to Salesforce org and export all debug log files. Files are saved with .log extension in organized directory structure: Exports/Log/MM-DD-YY/Username/Username_HH:MM:SS.log. Also generates HTML summary report with tabular format showing User, Operation, Status, Duration, Log Size, Time, and local file links.

# flags.name.summary

Export debug logs to organized directory structure

# flags.name.description

Export debug logs to organized directory structure with HTML summary report

# examples

- <%= config.bin %> <%= command.id %> --target-org dev29
- <%= config.bin %> <%= command.id %> --target-org production
