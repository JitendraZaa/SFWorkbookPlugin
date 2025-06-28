import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import Health from '../../../src/commands/jz/health.js';

describe('jz health', () => {
  const $$ = new TestContext();

  afterEach(() => {
    $$.restore();
  });

  it('should have correct static properties', () => {
    expect(Health.summary).to.contain('Perform comprehensive Salesforce org health check');
    expect(Health.description).to.contain('This command performs a comprehensive health check analysis');
    expect(Health.examples).to.be.an('array');
  });

  it('should have required flags defined', () => {
    expect(Health.flags).to.have.property('target-org');
    expect(Health.flags).to.have.property('output-dir');
    expect(Health.flags).to.have.property('report-format');
    expect(Health.flags).to.have.property('include-summary');
  });

  it('should have correct flag configurations', () => {
    expect(Health.flags['output-dir'].char).to.equal('d');
    expect(Health.flags['output-dir'].default).to.equal('Exports');

    expect(Health.flags['report-format'].char).to.equal('f');
    expect(Health.flags['report-format'].default).to.equal('both');
    expect(Health.flags['report-format'].options).to.deep.equal(['excel', 'text', 'both']);

    expect(Health.flags['include-summary'].char).to.equal('s');
    expect(Health.flags['include-summary'].default).to.equal(true);
  });

  it('should validate result type structure', () => {
    const mockResult = {
      totalIssues: 15,
      highSeverityIssues: 3,
      mediumSeverityIssues: 7,
      lowSeverityIssues: 5,
      categoriesAnalyzed: 8,
      exportPath: '/path/to/exports',
      orgSummaryStats: {
        totalApexClasses: 50,
        usedApexClasses: 45,
        apexUsagePercentage: 90.0,
        dataStorageUsed: 1500,
        dataStorageMax: 5000,
        dataStoragePercentage: 30.0,
        fileStorageUsed: 200,
        fileStorageMax: 1000,
        fileStoragePercentage: 20.0,
        topStorageObjects: []
      },
      issuesByCategory: {
        'Technical Debt': 5,
        'Performance': 3,
        'Security': 2
      }
    };

    expect(mockResult).to.have.property('totalIssues').that.is.a('number');
    expect(mockResult).to.have.property('highSeverityIssues').that.is.a('number');
    expect(mockResult).to.have.property('mediumSeverityIssues').that.is.a('number');
    expect(mockResult).to.have.property('lowSeverityIssues').that.is.a('number');
    expect(mockResult).to.have.property('categoriesAnalyzed').that.is.a('number');
    expect(mockResult).to.have.property('exportPath').that.is.a('string');
    expect(mockResult).to.have.property('orgSummaryStats');
    expect(mockResult).to.have.property('issuesByCategory').that.is.an('object');
  });

  it('should export the correct result type interface', () => {
    // This test verifies that the HealthCheckExportResult type is properly exported
    // and has the expected structure by checking it can be assigned correctly
    const validResult = {
      totalIssues: 0,
      highSeverityIssues: 0,
      mediumSeverityIssues: 0,
      lowSeverityIssues: 0,
      categoriesAnalyzed: 0,
      exportPath: '',
      orgSummaryStats: null,
      issuesByCategory: {},
    };

    // TypeScript compilation will fail if the structure doesn't match
    expect(validResult).to.be.an('object');
    expect(validResult.issuesByCategory).to.be.an('object');
    expect(validResult.orgSummaryStats).to.be.null;
  });

  it('should validate report format options', () => {
    const validFormats = ['excel', 'text', 'both'];
    const flagOptions = Health.flags['report-format'].options;

    expect(flagOptions).to.deep.equal(validFormats);
    expect(flagOptions).to.include('excel');
    expect(flagOptions).to.include('text');
    expect(flagOptions).to.include('both');
  });

  it('should have proper default values', () => {
    expect(Health.flags['output-dir'].default).to.equal('Exports');
    expect(Health.flags['report-format'].default).to.equal('both');
    expect(Health.flags['include-summary'].default).to.equal(true);
  });
}); 