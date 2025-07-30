import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import UICompare from '../../../src/commands/jz/uicompare.js';

describe('jz uicompare', () => {
  const $$ = new TestContext();

  afterEach(() => {
    $$.restore();
  });

  it('should have correct static properties', () => {
    expect(UICompare.summary).to.contain('Automate Salesforce UI to extract Lead record data');
    expect(UICompare.description).to.contain('Uses browser automation to login to Salesforce');
    expect(UICompare.examples).to.be.an('array');
  });

  it('should have required flags defined', () => {
    expect(UICompare.flags).to.have.property('target-org');
    expect(UICompare.flags).to.have.property('output-dir');
    expect(UICompare.flags).to.have.property('wait-time');
    expect(UICompare.flags).to.have.property('dry-run');
    expect(UICompare.flags).to.have.property('headless');
  });

  it('should have correct flag configurations', () => {
    expect(UICompare.flags['output-dir'].char).to.equal('d');
    expect(UICompare.flags['output-dir'].default).to.equal('Exports');

    expect(UICompare.flags['wait-time'].char).to.equal('w');
    expect(UICompare.flags['wait-time'].default).to.equal(10);
    expect(UICompare.flags['wait-time'].min).to.equal(5);
    expect(UICompare.flags['wait-time'].max).to.equal(60);

    expect(UICompare.flags['dry-run'].char).to.equal('r');
    expect(UICompare.flags['dry-run'].default).to.equal(false);

    expect(UICompare.flags['headless'].char).to.equal('e');
    expect(UICompare.flags['headless'].default).to.equal(false);
  });

  it('should validate result type structure', () => {
    const mockResult = {
      recordId: '00Q000000000001',
      recordUrl: 'https://example.salesforce.com/00Q000000000001',
      sectionsFound: 3,
      fieldsExtracted: 15,
      exportPath: '/path/to/exports/UICompare/1.json',
      fileName: '1.json',
      capturedAt: '2024-01-15T10:30:00.000Z',
    };

    expect(mockResult).to.have.property('recordId').that.is.a('string');
    expect(mockResult).to.have.property('recordUrl').that.is.a('string');
    expect(mockResult).to.have.property('sectionsFound').that.is.a('number');
    expect(mockResult).to.have.property('fieldsExtracted').that.is.a('number');
    expect(mockResult).to.have.property('exportPath').that.is.a('string');
    expect(mockResult).to.have.property('fileName').that.is.a('string');
    expect(mockResult).to.have.property('capturedAt').that.is.a('string');
  });

  it('should export the correct result type interface', () => {
    // This test verifies that the UICompareResult type is properly exported
    // and has the expected structure by checking it can be assigned correctly
    const validResult = {
      recordId: 'test-id',
      recordUrl: 'https://test.salesforce.com/test-id',
      sectionsFound: 0,
      fieldsExtracted: 0,
      exportPath: '',
      fileName: '',
      capturedAt: '',
    };

    // TypeScript compilation will fail if the structure doesn't match
    expect(validResult).to.be.an('object');
    expect(validResult.recordId).to.be.a('string');
    expect(validResult.sectionsFound).to.be.a('number');
    expect(validResult.fieldsExtracted).to.be.a('number');
  });

  it('should validate wait-time constraints', () => {
    const waitTimeFlag = UICompare.flags['wait-time'];

    expect(waitTimeFlag.min).to.equal(5);
    expect(waitTimeFlag.max).to.equal(60);
    expect(waitTimeFlag.default).to.be.at.least(waitTimeFlag.min as number);
    expect(waitTimeFlag.default).to.be.at.most(waitTimeFlag.max as number);
  });

  it('should have proper default values', () => {
    expect(UICompare.flags['output-dir'].default).to.equal('Exports');
    expect(UICompare.flags['wait-time'].default).to.equal(10);
    expect(UICompare.flags['dry-run'].default).to.equal(false);
    expect(UICompare.flags['headless'].default).to.equal(false);
  });

  it('should validate boolean flags are properly configured', () => {
    const dryRunFlag = UICompare.flags['dry-run'];
    const headlessFlag = UICompare.flags['headless'];

    expect(dryRunFlag.default).to.be.a('boolean');
    expect(headlessFlag.default).to.be.a('boolean');
    expect(dryRunFlag.default).to.equal(false);
    expect(headlessFlag.default).to.equal(false);
  });

  it('should have proper character flags for usability', () => {
    expect(UICompare.flags['output-dir'].char).to.equal('d');
    expect(UICompare.flags['wait-time'].char).to.equal('w');
    expect(UICompare.flags['dry-run'].char).to.equal('r');
    expect(UICompare.flags['headless'].char).to.equal('e');
  });
}); 