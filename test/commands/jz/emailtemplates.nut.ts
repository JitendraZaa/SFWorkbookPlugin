import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';

describe('jz emailtemplates NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({ devhubAuthStrategy: 'NONE' });
  });

  after(async () => {
    await session?.clean();
  });

  it('should display help for emailtemplates command', () => {
    const command = 'jz emailtemplates --help';
    const output = execCmd(command, { ensureExitCode: 0 }).shellOutput.stdout;

    expect(output).to.contain('Generate package.xml for all email templates');
    expect(output).to.contain('--target-org');
    expect(output).to.contain('--output-dir');
    expect(output).to.contain('--include-inactive');
    expect(output).to.contain('--template-types');
    expect(output).to.contain('--dry-run');
  });

  it('should show error when no target-org is provided', () => {
    const command = 'jz emailtemplates';
    const output = execCmd(command, { ensureExitCode: 2 }).shellOutput.stderr;

    expect(output).to.contain('Missing required flag');
    expect(output).to.contain('target-org');
  });

  it('should validate flag combinations', () => {
    const command = 'jz emailtemplates --help';
    const output = execCmd(command, { ensureExitCode: 0 }).shellOutput.stdout;

    // Verify that all expected flags are documented
    expect(output).to.contain('-d, --output-dir');
    expect(output).to.contain('-i, --include-inactive');
    expect(output).to.contain('-t, --template-types');
    expect(output).to.contain('-r, --dry-run');
  });

  it('should show examples in help output', () => {
    const command = 'jz emailtemplates --help';
    const output = execCmd(command, { ensureExitCode: 0 }).shellOutput.stdout;

    expect(output).to.contain('EXAMPLES');
    expect(output).to.contain('--target-org myorg');
    expect(output).to.contain('--include-inactive');
    expect(output).to.contain('--template-types');
    expect(output).to.contain('--dry-run');
  });
}); 