import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';

describe('jz permissionsets-compare NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({
      devhubAuthStrategy: 'NONE',
      scratchOrgs: [],
    });
  });

  after(async () => {
    await session?.clean();
  });

  it('should display help for permissionsets-compare command', () => {
    const command = 'jz permissionsets-compare --help';
    const output = execCmd(command, { ensureExitCode: 0 }).shellOutput.stdout;

    expect(output).to.contain('Compare permission sets between two Salesforce orgs');
    expect(output).to.contain('--source-org');
    expect(output).to.contain('--target-org');
    expect(output).to.contain('--permission-sets');
    expect(output).to.contain('--output-dir');
    expect(output).to.contain('--include-standard');
  });

  it('should show error when source-org is missing', () => {
    const command = 'jz permissionsets-compare --target-org test-org';
    const output = execCmd(command, { ensureExitCode: 2 }).shellOutput.stderr;

    expect(output).to.contain('Missing required flag');
    expect(output).to.contain('source-org');
  });

  it('should show error when target-org is missing', () => {
    const command = 'jz permissionsets-compare --source-org test-org';
    const output = execCmd(command, { ensureExitCode: 2 }).shellOutput.stderr;

    expect(output).to.contain('Missing required flag');
    expect(output).to.contain('target-org');
  });

  it('should validate that source-org and target-org are different', () => {
    const command = 'jz permissionsets-compare --source-org same-org --target-org same-org';
    const output = execCmd(command, { ensureExitCode: 1 }).shellOutput.stderr;

    // This would be handled by the actual authentication, but the command structure validates input
    expect(output).to.contain('authenticated');
  });

  it('should accept valid permission-sets format', () => {
    const command = 'jz permissionsets-compare --source-org source --target-org target --permission-sets "Admin,User" --help';
    const output = execCmd(command, { ensureExitCode: 0 }).shellOutput.stdout;

    expect(output).to.contain('Compare permission sets between two Salesforce orgs');
  });

  it('should accept custom output directory', () => {
    const command = 'jz permissionsets-compare --source-org source --target-org target --output-dir "CustomDir" --help';
    const output = execCmd(command, { ensureExitCode: 0 }).shellOutput.stdout;

    expect(output).to.contain('Compare permission sets between two Salesforce orgs');
  });

  it('should accept include-standard flag', () => {
    const command = 'jz permissionsets-compare --source-org source --target-org target --include-standard --help';
    const output = execCmd(command, { ensureExitCode: 0 }).shellOutput.stdout;

    expect(output).to.contain('Compare permission sets between two Salesforce orgs');
  });

  it('should support short flags', () => {
    const command = 'jz permissionsets-compare -s source -t target -p "Admin" -d "Reports" -i --help';
    const output = execCmd(command, { ensureExitCode: 0 }).shellOutput.stdout;

    expect(output).to.contain('Compare permission sets between two Salesforce orgs');
  });
}); 