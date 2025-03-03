# sf_workbook - Salesforce DX Plugin for Configuration Workbook

## Initial Setup
1. Download this Git
1. run `npm install`
1. Navigate to main folder and run command `sf plugins link .`


## Sample Plugin Commands

1. `sf jz wbook --target-org <org_alias> --e "Account,Contact"` - Main command to run this plugin. If --e is missing then it woulf try to export all objects
1. `sf call external service` - This command make API call and provides some interesting facts about numbers

## Important Links
- [How to create plugin documentation](https://github.com/salesforcecli/cli/wiki/Get-Started-And-Create-Your-First-Plug-In)

## Troubleshoot
1. If changes in plugin is not reflecting, that means after changes code is not compiled. Run this command in seperate terminal , so that after each file change code automatically compiled. `yarn compile --watch`
1. Remove Husky checks before git commit , else we would not be able to commit code in git `rm -rf .husky/`
1. If you get some error on dependencies etc, run below command to clear cache and install node plugins again
```
yarn add got
rm -rf node_modules package-lock.json            
npm cache clean --force
npm install
```
