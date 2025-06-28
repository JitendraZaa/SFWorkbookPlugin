import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import JzLog from '../../../src/commands/jz/log.js';

describe('jz log', () => {
  const $$ = new TestContext();
  let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(() => {
    sfCommandStubs = stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('runs log export command', async () => {
    await JzLog.run(['--target-org', 'test-org']);
    const output = sfCommandStubs.log
      .getCalls()
      .flatMap((c) => c.args)
      .join('\n');
    expect(output).to.include('Fetching debug logs');
  });

  it('handles no debug logs found', async () => {
    const result = await JzLog.run(['--target-org', 'test-org']);
    expect(result.totalLogs).to.be.a('number');
    expect(result.exportPath).to.be.a('string');
    expect(result.htmlSummary).to.be.a('string');
  });
}); 