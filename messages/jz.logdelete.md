# summary

Delete all debug logs from the specified org

# description

This command deletes all debug logs from the specified Salesforce org. It provides safety features including dry-run mode and confirmation requirements to prevent accidental deletions.

The command processes logs in configurable batches to avoid overwhelming the Salesforce API and provides detailed progress reporting.

Safety features:

- Requires explicit --confirm flag to perform actual deletions
- Supports --dry-run mode to preview what would be deleted
- Processes logs in batches with configurable batch size
- Provides detailed summary before deletion
- Reports progress and results throughout the process

# examples

- Preview what logs would be deleted (dry-run mode):
  <%= config.bin %> <%= command.id %> --target-org myorg --dry-run

- Delete all debug logs with confirmation:
  <%= config.bin %> <%= command.id %> --target-org myorg --confirm

- Delete logs in smaller batches (5 logs per batch):
  <%= config.bin %> <%= command.id %> --target-org myorg --confirm --batch-size 5

- Preview and then delete with custom batch size:
  <%= config.bin %> <%= command.id %> --target-org myorg --dry-run
  <%= config.bin %> <%= command.id %> --target-org myorg --confirm --batch-size 20

# flags.confirm.summary

Confirm deletion of debug logs

# flags.confirm.description

When set, this flag confirms that you want to proceed with deleting the debug logs. Without this flag, the command will only show what would be deleted and require confirmation.

# flags.dry-run.summary

Preview mode - show what would be deleted without actually deleting

# flags.dry-run.description

Run in preview mode to see what debug logs would be deleted without actually performing the deletion. This is useful for understanding the scope of logs that would be affected before running the actual deletion.

# flags.batch-size.summary

Number of logs to process in each batch

# flags.batch-size.description

Configure how many logs to process in each batch. Smaller batch sizes are more conservative and put less load on the Salesforce API, while larger batch sizes complete faster. Valid range is 1-50 logs per batch.
