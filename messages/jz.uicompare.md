# summary

Automate Salesforce UI to extract Lead record data and export as JSON

# description

Uses browser automation to login to Salesforce, navigate to the Leads tab, open the first Lead record, wait for the page to load, and extract all visible field data organized by sections. The extracted data is saved as an incrementally numbered JSON file in the Export/UICompare/ directory.

This command supports both Lightning Experience and Salesforce Classic interfaces, automatically detecting the UI type and using appropriate selectors for data extraction.

**Important**: This command requires browser automation and will open a visible browser window by default. Ensure you have a stable network connection and that the target org contains at least one Lead record.

# examples

- Extract Lead record data from the default org:

  <%= config.bin %> <%= command.id %> --target-org myorg

- Extract with custom wait time and output directory:

  <%= config.bin %> <%= command.id %> --target-org myorg --wait-time 15 --output-dir "CustomExports"

- Run in headless mode (no visible browser):

  <%= config.bin %> <%= command.id %> --target-org myorg --headless

- Preview the command without running browser automation:

  <%= config.bin %> <%= command.id %> --target-org myorg --dry-run

- Use short flags for a complete custom setup:

  <%= config.bin %> <%= command.id %> --target-org prod -w 20 -d "UIExports" -e -r

# flags.output-dir.summary

Directory where the JSON files will be saved.

# flags.output-dir.description

The base directory where the UICompare folder will be created and JSON files will be saved. The command creates an incremental filename (1.json, 2.json, etc.) in the UICompare subdirectory.

# flags.wait-time.summary

Time to wait (in seconds) for the Lead record page to fully load.

# flags.wait-time.description

Number of seconds to wait after opening the Lead record page before extracting data. This ensures all sections and fields are fully loaded. Minimum is 5 seconds, maximum is 60 seconds.

# flags.dry-run.summary

Preview the command without performing browser automation.

# flags.dry-run.description

When enabled, shows what the command would do without actually opening a browser or performing any automation. Useful for validating parameters and understanding the command behavior.

# flags.headless.summary

Run browser automation in headless mode (no visible browser window).

# flags.headless.description

When enabled, the browser runs in headless mode without a visible window. This can be faster and more suitable for automated environments, but you won't be able to see the automation progress visually.
