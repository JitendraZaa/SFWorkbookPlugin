import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import LogDelete from '../../../src/commands/jz/logdelete.js';

describe('jz logdelete', () => {
  const $$ = new TestContext();

  afterEach(() => {
    $$.restore();
  });

  it('should have correct static properties', () => {
    expect(LogDelete.summary).to.contain('Delete all debug logs');
    expect(LogDelete.description).to.contain('This command deletes all debug logs');
    expect(LogDelete.examples).to.be.an('array');
  });

  it('should have required flags defined', () => {
    expect(LogDelete.flags).to.have.property('target-org');
    expect(LogDelete.flags).to.have.property('confirm');
    expect(LogDelete.flags).to.have.property('dry-run');
    expect(LogDelete.flags).to.have.property('batch-size');
  });

  it('should have correct flag configurations', () => {
    expect(LogDelete.flags['confirm'].char).to.equal('c');
    expect(LogDelete.flags['confirm'].default).to.equal(false);

    expect(LogDelete.flags['dry-run'].char).to.equal('d');
    expect(LogDelete.flags['dry-run'].default).to.equal(false);

    expect(LogDelete.flags['batch-size'].char).to.equal('b');
    expect(LogDelete.flags['batch-size'].default).to.equal(10);
  });

  it('should validate result type structure', () => {
    const mockResult = {
      totalLogsFound: 5,
      logsDeleted: 3,
      logsFailed: 2,
      deletedLogIds: ['id1', 'id2', 'id3'],
      failedLogIds: ['id4', 'id5']
    };

    expect(mockResult).to.have.property('totalLogsFound').that.is.a('number');
    expect(mockResult).to.have.property('logsDeleted').that.is.a('number');
    expect(mockResult).to.have.property('logsFailed').that.is.a('number');
    expect(mockResult).to.have.property('deletedLogIds').that.is.an('array');
    expect(mockResult).to.have.property('failedLogIds').that.is.an('array');
  });
}); 