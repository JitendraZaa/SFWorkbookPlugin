import * as fs from 'node:fs';
import * as path from 'node:path';
import { Connection } from '@salesforce/core';
import { TextHealthReportGenerator } from './textHealthReportGenerator.js';
import { ExcelHealthReportGenerator } from './excelHealthReportGenerator.js';

export type HealthCheckResult = {
  category: string;
  title: string;
  severity: 'High' | 'Medium' | 'Low';
  count: number;
  items: string[];
  description: string;
  recommendation: string;
};

export type ComponentRecord = {
  Id: string;
  Name?: string;
  DeveloperName?: string;
  MasterLabel?: string;
  Type?: string;
  MarkupOrCode?: string;
  ApiVersion?: number;
  Status?: string;
  IsActive?: boolean;
  ManageableState?: string;
  TableEnumOrId?: string;
  SobjectType?: string;
  QualifiedApiName?: string;
};

export type FlowRecord = {
  Id: string;
  MasterLabel?: string;
  Label?: string;
  Status: string;
  ProcessType: string;
  ApiVersion?: number;
  VersionNumber?: number;
};

export type FlowDefinitionRecord = {
  Id: string;
  DeveloperName: string;
  ActiveVersionId?: string;
  ManageableState?: string;
};

export type FlowRecord2 = {
  Id: string;
  DeveloperName?: string;
  ProcessType?: string;
  Status?: string;
  MasterLabel?: string;
};

export type ApexRecord = {
  Id: string;
  Name: string;
  ApiVersion: number;
  Status: string;
  Body?: string;
};

export type ValidationRuleRecord = {
  Id: string;
  ValidationName: string;
  EntityDefinitionId?: string;
  EntityDefinition?: {
    QualifiedApiName: string;
  };
  Active: boolean;
};

export type FieldRecord = {
  Id: string;
  QualifiedApiName: string;
  EntityDefinitionId: string;
  LastReferencedDate?: string;
};

export type PermissionSetRecord = {
  Id: string;
  Name: string;
  Label: string;
  IsOwnedByProfile: boolean;
};

export type ProfileRecord = {
  Id: string;
  Name: string;
  UserLicense: { Name: string };
};

export type UserRecord = {
  Id: string;
  ProfileId: string;
  IsActive: boolean;
};

export type TestCoverageRecord = {
  ApexClassOrTriggerId: string;
  TestMethodName?: string;
  NumLinesCovered: number;
  NumLinesUncovered: number;
  Coverage?: { coveredLines: number[]; uncoveredLines: number[] };
  ApexClassOrTrigger?: {
    Name: string;
  };
};

export type ReportRecord = {
  Id: string;
  Name: string;
  LastRunDate?: string;
  LastViewedDate?: string;
};

export type DashboardRecord = {
  Id: string;
  Title: string;
  LastViewedDate?: string;
};

export type ApexClassRecord = {
  Id: string;
  Name: string;
  Body?: string;
  ApiVersion?: number;
  Status?: string;
};

export type SymbolTableRecord = {
  Id: string;
  Name: string;
  SymbolTable?: {
    externalReferences?: Array<{
      name: string;
      namespace?: string;
    }>;
    methods?: Array<{
      name: string;
      references?: Array<{
        name: string;
      }>;
    }>;
  };
};

export type MetadataComponentDependencyRecord = {
  MetadataComponentName: string;
  RefMetadataComponentName: string;
  MetadataComponentType: string;
  MetadataComponentId?: string;
  RefMetadataComponentId?: string;
};

export type AsyncApexJobRecord = {
  ApexClassId: string;
  Status: string;
  JobType: string;
  ApexClass?: {
    Name: string;
  };
};

export type ApexPageRecord = {
  Name: string;
  ControllerKey?: string;
};

export type LayoutRecord = {
  Id: string;
  Name: string;
  TableEnumOrId: string;
};

export type LayoutAssignmentRecord = {
  Id: string;
  LayoutId: string;
  ProfileId: string;
  RecordTypeId?: string;
};

export type OrganizationRecord = {
  Id: string;
  DataStorage: number;
  FileStorage: number;
  MaxDataStorage: number;
  MaxFileStorage: number;
};

export type OrgSummaryStats = {
  totalApexClasses: number;
  usedApexClasses: number;
  apexUsagePercentage: number;
  dataStorageUsed: number;
  dataStorageMax: number;
  dataStoragePercentage: number;
  fileStorageUsed: number;
  fileStorageMax: number;
  fileStoragePercentage: number;
};

export class HealthProcessor {
  private connection: Connection;
  private logger: (message: string) => void;
  private healthResults: HealthCheckResult[] = [];
  private orgAlias: string;
  private orgSummaryStats: OrgSummaryStats | null = null;

  public constructor(connection: Connection, logger: (message: string) => void, orgAlias: string) {
    this.connection = connection;
    this.logger = logger;
    this.orgAlias = orgAlias;
  }

  private static generateTimestamp(): string {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const year = now.getFullYear();
    const hours12 = now.getHours() % 12 || 12;
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = now.getHours() >= 12 ? 'pm' : 'am';

    return `${month}_${day}_${year}_${hours12}_${minutes}_${ampm}`;
  }

  public async performHealthCheck(): Promise<void> {
    this.logger('Starting Salesforce Org Health Check...');

    try {
      // First collect org summary statistics
      await this.collectOrgSummaryStats();

      // Run all health checks in parallel for better performance
      await Promise.all([
        this.checkAuraComponents(),
        this.checkProcessBuilders(),
        this.checkWorkflowRules(),
        this.checkInactiveFlows(),
        this.checkOldApiVersions(),
        this.checkVisuaforcePages(),
        this.checkHardcodedIds(),
        this.checkUnusedValidationRules(),
        this.checkUnusedFields(),
        this.checkUnusedPermissionSets(),
        this.checkProfilesWithoutUsers(),
        this.checkLowCodeCoverage(),
        this.checkUnusedRecordTypes(),
        this.checkTriggerOveruse(),
        this.checkNamingConventions(),
        this.checkUnusedReportsAndDashboards(),
        this.checkUnusedApexClasses(),
        this.checkUnusedPageLayouts(),
      ]);

      this.logger(`Health check completed. Found ${this.healthResults.length} technical debt categories.`);

      // Generate reports - both text and Excel for each category
      this.generateCategoryReports();

    } catch (error) {
      this.logger(`Error during health check: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  public getOrgSummaryStats(): OrgSummaryStats | null {
    return this.orgSummaryStats;
  }

  private async collectOrgSummaryStats(): Promise<void> {
    // 🎯 ALWAYS use web scraping for accurate results - API gives incorrect data!
    this.logger('🔍 Collecting ACCURATE org summary statistics using web scraping...');
    this.logger('⚠️  Note: API results are unreliable, using Puppeteer web scraping for precision');

    try {
      // Import the web scraper
      const { OrgStatsWebScraper } = await import('./orgStatsWebScraper.js');

      this.logger('🚀 Launching automated browser for data collection...');
      const scraper = new OrgStatsWebScraper(this.orgAlias);

      this.logger('🌐 Navigating to Salesforce Setup pages...');
      const scrapedStats = await scraper.scrapeOrgStats();

      // Convert scraped stats to the expected format
      this.orgSummaryStats = {
        totalApexClasses: scrapedStats.totalApexClasses,
        usedApexClasses: scrapedStats.usedApexClasses,
        apexUsagePercentage: scrapedStats.apexUsagePercentage,
        dataStorageUsed: scrapedStats.dataStorageUsed,
        dataStorageMax: scrapedStats.dataStorageMax,
        dataStoragePercentage: scrapedStats.dataStoragePercentage,
        fileStorageUsed: scrapedStats.fileStorageUsed,
        fileStorageMax: scrapedStats.fileStorageMax,
        fileStoragePercentage: scrapedStats.fileStoragePercentage
      };

      this.logger('✅ SUCCESS: Accurate org statistics collected via web scraping!');
      this.logger('═══════════════════════════════════════════════════════════');
      this.logger(`📊 APEX USAGE: ${scrapedStats.apexUsagePercentage}% (${scrapedStats.usedApexClasses}/${scrapedStats.totalApexClasses} classes)`);
      this.logger(`💾 DATA STORAGE: ${scrapedStats.dataStoragePercentage}% (${scrapedStats.dataStorageUsed}MB of ${scrapedStats.dataStorageMax}MB)`);
      this.logger(`📁 FILE STORAGE: ${scrapedStats.fileStoragePercentage}% (${scrapedStats.fileStorageUsed}MB of ${scrapedStats.fileStorageMax}MB)`);
      this.logger('═══════════════════════════════════════════════════════════');
      this.logger('🎉 These are the REAL percentages from Salesforce UI (not API estimates)');

    } catch (webScrapingError) {
      this.logger('❌ Web scraping failed! Attempting API fallback...');
      this.logger(`Web scraping error: ${webScrapingError instanceof Error ? webScrapingError.message : 'Unknown error'}`);

      try {
        this.logger('🔄 Trying API as fallback (note: may be inaccurate)...');

        // Get total Apex classes count via API as fallback
        const allApexClasses = await this.connection.tooling.query(
          `SELECT Id, Name 
           FROM ApexClass 
           WHERE NamespacePrefix = null`
        );

        let totalApexClasses = 0;
        let usedApexClasses = 0;

        if (allApexClasses.records) {
          totalApexClasses = allApexClasses.records.length;

          // Filter out test classes to get business logic classes
          const nonTestClasses = (allApexClasses.records as SymbolTableRecord[]).filter(cls => {
            const name = cls.Name || '';
            return !name.toLowerCase().includes('test') && !name.endsWith('_Test');
          });

          usedApexClasses = nonTestClasses.length;
        }

        const apexUsagePercentage = totalApexClasses > 0 ? Math.round((usedApexClasses / totalApexClasses) * 100) : 0;

        this.orgSummaryStats = {
          totalApexClasses,
          usedApexClasses,
          apexUsagePercentage,
          dataStorageUsed: -1, // API cannot provide storage info
          dataStorageMax: -1,
          dataStoragePercentage: -1,
          fileStorageUsed: -1,
          fileStorageMax: -1,
          fileStoragePercentage: -1
        };

        this.logger('⚠️  API fallback completed (INACCURATE DATA):');
        this.logger(`📊 Apex: ${apexUsagePercentage}% (${usedApexClasses}/${totalApexClasses}) - ESTIMATED ONLY`);
        this.logger('💾 Storage: Not available via API - requires web scraping for accuracy');

      } catch (apiError) {
        this.logger('❌ Both web scraping AND API failed!');
        this.logger(`API error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
        this.logger('🔧 Using default values...');

        // Set default values if both methods fail
        this.orgSummaryStats = {
          totalApexClasses: 0,
          usedApexClasses: 0,
          apexUsagePercentage: 0,
          dataStorageUsed: -1,
          dataStorageMax: -1,
          dataStoragePercentage: -1,
          fileStorageUsed: -1,
          fileStorageMax: -1,
          fileStoragePercentage: -1
        };
      }
    }
  }

  private async checkAuraComponents(): Promise<void> {
    try {
      const auraComponents = await this.connection.query<ComponentRecord>(
        `SELECT Id, DeveloperName, ApiVersion 
         FROM AuraDefinitionBundle`
      );

      if (auraComponents.records.length > 0) {
        this.healthResults.push({
          category: 'Aura and VF',
          title: 'Aura Components (instead of LWC)',
          severity: 'Medium',
          count: auraComponents.records.length,
          items: auraComponents.records.map(comp => `${comp.DeveloperName ?? 'Unknown'} (API v${comp.ApiVersion ?? 'Unknown'})`),
          description: 'Aura Components are legacy technology. Lightning Web Components (LWC) offer better performance and modern development practices.',
          recommendation: 'Migrate Aura Components to Lightning Web Components for better performance, smaller bundle size, and modern JavaScript standards.'
        });
      }
    } catch (error) {
      this.logger(`Error checking Aura Components: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkProcessBuilders(): Promise<void> {
    try {
      // Use the optimized query to get all Process Builder versions
      const allProcessBuilders = await this.connection.tooling.query(
        `SELECT Id, MasterLabel, Status, ProcessType 
         FROM Flow 
         WHERE ProcessType = 'Workflow'`
      );

      if (allProcessBuilders?.records && allProcessBuilders.records.length > 0) {
        // Group by DeveloperName to handle multiple versions
        const processBuilderMap = new Map<string, FlowRecord2>();

        (allProcessBuilders.records as FlowRecord2[]).forEach(pb => {
          const name = pb.MasterLabel ?? 'Unknown';
          const existing = processBuilderMap.get(name);

          // Prefer Active status over Inactive/Draft, or if no existing entry
          if (!existing ||
            (pb.Status === 'Active' && existing.Status !== 'Active') ||
            (pb.Status === 'Active' && existing.Status === 'Active' && pb.Id > existing.Id)) {
            processBuilderMap.set(name, pb);
          }
        });

        const uniqueProcessBuilders = Array.from(processBuilderMap.values());
        const activeCount = uniqueProcessBuilders.filter(pb => pb.Status === 'Active').length;
        const inactiveCount = uniqueProcessBuilders.length - activeCount;

        this.healthResults.push({
          category: 'PB and WF',
          title: 'Process Builders (should be migrated to Flows)',
          severity: 'High',
          count: uniqueProcessBuilders.length,
          items: uniqueProcessBuilders.map(pb => {
            const name = pb.MasterLabel ?? 'Unknown';
            const status = pb.Status ?? 'Unknown';
            return `${name} (${status})`;
          }),
          description: `Found ${uniqueProcessBuilders.length} Process Builders (${activeCount} Active, ${inactiveCount} Inactive). Process Builder is being retired.`,
          recommendation: 'Migrate all Process Builders to Flow Builder before Salesforce retires Process Builder functionality.'
        });
      } else {
        // No Process Builders found
        this.healthResults.push({
          category: 'PB and WF',
          title: 'Process Builders (None Found)',
          severity: 'High',
          count: 0,
          items: ['No Process Builders detected in this org'],
          description: 'Process Builder is being retired. All Process Builders should be migrated to Flow Builder.',
          recommendation: 'Good! No Process Builders found. Continue using Flow Builder for new automation.'
        });
      }
    } catch (error) {
      this.logger(`Error checking Process Builders: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Approach 3: Try alternative method using Metadata API query
      try {
        // Query for any components with specific naming patterns that indicate Process Builders
        const flowMetadata = await this.connection.tooling.query(
          `SELECT Id, DeveloperName, ManageableState 
           FROM FlowDefinition 
           WHERE DeveloperName LIKE '%Process%' OR DeveloperName LIKE '%PB_%'`
        );

        if (flowMetadata?.records && flowMetadata.records.length > 0) {
          this.healthResults.push({
            category: 'PB and WF',
            title: 'Potential Process Builders (Pattern-based Detection)',
            severity: 'High',
            count: flowMetadata.records.length,
            items: (flowMetadata.records as FlowDefinitionRecord[]).map(pb => `${pb.DeveloperName} (Potential Process Builder - verify manually)`),
            description: 'Found Flow Definitions with naming patterns suggesting they might be Process Builders.',
            recommendation: 'Review these flows manually in Setup > Process Builder to confirm if they are Process Builders that need migration.'
          });
        } else {
          this.healthResults.push({
            category: 'PB and WF',
            title: 'Process Builders (Detection Failed)',
            severity: 'High',
            count: 0,
            items: ['Unable to detect Process Builders automatically - manual review required'],
            description: 'Process Builder detection failed due to API limitations.',
            recommendation: 'Check Setup > Process Builder manually to identify active Process Builders that need migration.'
          });
        }
      } catch (fallbackError) {
        // Ultimate fallback to manual review
        this.healthResults.push({
          category: 'PB and WF',
          title: 'Process Builders (Manual Review Required)',
          severity: 'High',
          count: 0,
          items: ['All automated detection methods failed - manual review required'],
          description: 'Process Builder is being retired. All Process Builders should be migrated to Flow Builder.',
          recommendation: 'Check Setup > Process Builder manually to identify active Process Builders that need migration.'
        });
      }
    }
  }

  private async checkWorkflowRules(): Promise<void> {
    try {
      // Use Tooling API to query WorkflowRule
      const workflowRules = await this.connection.tooling.query(
        `SELECT Id, Name, TableEnumOrId 
         FROM WorkflowRule`
      );

      if (workflowRules.records && workflowRules.records.length > 0) {
        this.healthResults.push({
          category: 'PB and WF',
          title: 'Workflow Rules (legacy automation, should be replaced)',
          severity: 'High',
          count: workflowRules.records.length,
          items: (workflowRules.records as ComponentRecord[]).map(wr => `${wr.Name ?? 'Unknown'} (${wr.TableEnumOrId ?? 'Unknown Object'})`),
          description: 'Workflow Rules are legacy automation tools with limited functionality compared to Flow Builder.',
          recommendation: 'Replace Workflow Rules with Flow Builder for better functionality, debugging capabilities, and future support.'
        });
      }
    } catch (error) {
      this.logger(`Error checking Workflow Rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Fallback to manual review if Tooling API fails
      this.healthResults.push({
        category: 'PB and WF',
        title: 'Workflow Rules (Manual Review Required)',
        severity: 'High',
        count: 0,
        items: ['Tooling API not accessible - check Setup > Workflow Rules for active workflow rules'],
        description: 'Workflow Rules are legacy automation tools with limited functionality compared to Flow Builder.',
        recommendation: 'Replace Workflow Rules with Flow Builder for better functionality, debugging capabilities, and future support.'
      });
    }
  }

  private async checkInactiveFlows(): Promise<void> {
    try {
      // Use Tooling API to query FlowDefinition for flows without active versions
      const inactiveFlows = await this.connection.tooling.query(
        `SELECT Id, DeveloperName, ActiveVersionId 
         FROM FlowDefinition 
         WHERE ActiveVersionId = null`
      );

      if (inactiveFlows.records && inactiveFlows.records.length > 0) {
        this.healthResults.push({
          category: 'Inactive Components',
          title: 'Inactive or Draft Flows',
          severity: 'Low',
          count: inactiveFlows.records.length,
          items: (inactiveFlows.records as FlowDefinitionRecord[]).map(flow => `${flow.DeveloperName} (No Active Version)`),
          description: 'Inactive or Draft flows consume storage and can cause confusion for developers.',
          recommendation: 'Review and either activate necessary flows or delete unused draft/inactive flows to reduce clutter.'
        });
      }
    } catch (error) {
      this.logger(`Error checking Inactive Flows: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Fallback to manual review if Tooling API fails
      this.healthResults.push({
        category: 'Inactive Components',
        title: 'Inactive or Draft Flows (Manual Review Required)',
        severity: 'Low',
        count: 0,
        items: ['Tooling API not accessible - check Setup > Flows for inactive or draft flows'],
        description: 'Inactive or Draft flows consume storage and can cause confusion for developers.',
        recommendation: 'Review and either activate necessary flows or delete unused draft/inactive flows to reduce clutter.'
      });
    }
  }

  private async checkOldApiVersions(): Promise<void> {
    try {
      const currentApiVersion = parseFloat(this.connection.version);
      const oldVersionThreshold = currentApiVersion - 5; // Flag anything 5+ versions old

      // Check Apex Classes
      const oldApexClasses = await this.connection.query<ApexRecord>(
        `SELECT Id, Name, ApiVersion 
         FROM ApexClass 
         WHERE ApiVersion < ${oldVersionThreshold}`
      );

      // Check Visualforce Pages
      const oldVfPages = await this.connection.query<ComponentRecord>(
        `SELECT Id, Name, ApiVersion 
         FROM ApexPage 
         WHERE ApiVersion < ${oldVersionThreshold}`
      );

      // Check Aura Components
      const oldAuraComponents = await this.connection.query<ComponentRecord>(
        `SELECT Id, DeveloperName, ApiVersion 
         FROM AuraDefinitionBundle 
         WHERE ApiVersion < ${oldVersionThreshold}`
      );

      const allOldComponents = [
        ...oldApexClasses.records.map(cls => `Apex Class: ${cls.Name} (API v${cls.ApiVersion})`),
        ...oldVfPages.records.map(page => `VF Page: ${page.Name ?? 'Unknown'} (API v${page.ApiVersion ?? 'Unknown'})`),
        ...oldAuraComponents.records.map(comp => `Aura Component: ${comp.DeveloperName ?? 'Unknown'} (API v${comp.ApiVersion ?? 'Unknown'})`)
      ];

      if (allOldComponents.length > 0) {
        this.healthResults.push({
          category: 'API Version Issues',
          title: 'Old API Versions in Apex, VF, Aura',
          severity: 'Medium',
          count: allOldComponents.length,
          items: allOldComponents,
          description: `Components using API versions older than ${oldVersionThreshold} may miss important features and security updates.`,
          recommendation: 'Update API versions to the latest version to ensure access to newest features and security improvements.'
        });
      }
    } catch (error) {
      this.logger(`Error checking Old API Versions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkVisuaforcePages(): Promise<void> {
    try {
      const vfPages = await this.connection.query<ComponentRecord>(
        `SELECT Id, Name, ApiVersion 
         FROM ApexPage`
      );

      if (vfPages.records.length > 0) {
        this.healthResults.push({
          category: 'Aura and VF',
          title: 'Visualforce Pages (outdated UI technology)',
          severity: 'Medium',
          count: vfPages.records.length,
          items: vfPages.records.map(page => `${page.Name ?? 'Unknown'} (API v${page.ApiVersion ?? 'Unknown'})`),
          description: 'Visualforce is legacy UI technology. Lightning Web Components and Flow Builder provide modern alternatives.',
          recommendation: 'Migrate Visualforce pages to Lightning Web Components or Lightning App Builder for better user experience and mobile compatibility.'
        });
      }
    } catch (error) {
      this.logger(`Error checking Visualforce Pages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private checkHardcodedIds(): void {
    try {
      // Apex Body field cannot be filtered in queries, adding as manual review
      this.healthResults.push({
        category: 'Code Coverage Issue',
        title: 'Hard-coded IDs in Apex/Flow',
        severity: 'High',
        count: 0, // Cannot query Body field directly
        items: ['Manual review required - scan Apex classes and triggers for hard-coded Salesforce IDs (15/18 character strings)'],
        description: 'Hard-coded IDs make code environment-specific and cause deployment failures.',
        recommendation: 'Replace hard-coded IDs with dynamic queries, Custom Labels, or Custom Metadata Types for environment-independent code.'
      });
    } catch (error) {
      this.logger(`Error checking Hard-coded IDs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkUnusedValidationRules(): Promise<void> {
    try {
      // Use Tooling API to query ValidationRule
      const validationRules = await this.connection.tooling.query(
        `SELECT Id, ValidationName, EntityDefinition.QualifiedApiName, Active 
         FROM ValidationRule 
         WHERE Active = false`
      );

      if (validationRules.records && validationRules.records.length > 0) {
        this.healthResults.push({
          category: 'Inactive Components',
          title: 'Unused Validation Rules',
          severity: 'Low',
          count: validationRules.records.length,
          items: (validationRules.records as ValidationRuleRecord[]).map(rule => `${rule.ValidationName ?? 'Unknown'} on ${rule.EntityDefinition?.QualifiedApiName ?? 'Unknown Object'} (Inactive)`),
          description: 'Inactive validation rules consume storage and create confusion for administrators.',
          recommendation: 'Review inactive validation rules and delete those that are no longer needed.'
        });
      }
    } catch (error) {
      this.logger(`Error checking Unused Validation Rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Fallback to manual review if Tooling API fails
      this.healthResults.push({
        category: 'Inactive Components',
        title: 'Unused Validation Rules (Manual Review Required)',
        severity: 'Low',
        count: 0,
        items: ['Tooling API not accessible - check Setup > Object Manager > [Object] > Validation Rules for inactive rules'],
        description: 'Inactive validation rules consume storage and create confusion for administrators.',
        recommendation: 'Review inactive validation rules and delete those that are no longer needed.'
      });
    }
  }

  private async checkUnusedFields(): Promise<void> {
    try {
      // Get custom objects first to use as EntityDefinitionId filter
      const customObjects = await this.connection.query<ComponentRecord>(
        `SELECT QualifiedApiName 
         FROM EntityDefinition 
         WHERE IsCustomizable = true AND QualifiedApiName LIKE '%__c'`
      );

      if (customObjects.records.length > 0) {
        // Take first few custom objects to check their fields
        const objectsToCheck = customObjects.records.slice(0, 5);
        let totalCustomFields = 0;
        const fieldSamples: string[] = [];

        const fieldQueries = objectsToCheck.map(async (obj) => {
          try {
            const customFields = await this.connection.query<FieldRecord>(
              `SELECT Id, QualifiedApiName, EntityDefinitionId 
               FROM FieldDefinition 
               WHERE EntityDefinitionId = '${obj.QualifiedApiName}' AND QualifiedApiName LIKE '%__c'`
            );
            return {
              object: obj.QualifiedApiName,
              fields: customFields.records
            };
          } catch (fieldError) {
            return { object: obj.QualifiedApiName, fields: [] };
          }
        });

        const results = await Promise.all(fieldQueries);
        results.forEach(result => {
          totalCustomFields += result.fields.length;
          fieldSamples.push(...result.fields.slice(0, 3).map(field => `${result.object}.${field.QualifiedApiName}`));
        });

        if (totalCustomFields > 0) {
          this.healthResults.push({
            category: 'Unused Components',
            title: 'Custom Fields (Manual Review Required)',
            severity: 'Medium',
            count: totalCustomFields,
            items: [...fieldSamples, `... and potentially more custom fields across ${customObjects.records.length} custom objects`],
            description: 'Custom fields should be reviewed for usage. Consider using Field Trip Analyzer or similar tools to identify unused fields.',
            recommendation: 'Review custom fields and consider archiving or deleting those no longer needed. Verify with business users before deletion.'
          });
        }
      }
    } catch (error) {
      this.logger(`Error checking Unused Fields: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkUnusedPermissionSets(): Promise<void> {
    try {
      // Get all permission sets
      const permissionSets = await this.connection.query<PermissionSetRecord>(
        `SELECT Id, Name, Label 
         FROM PermissionSet 
         WHERE IsOwnedByProfile = false`
      );

      // Get permission set assignments
      const assignments = await this.connection.query<{ PermissionSetId: string }>(
        `SELECT PermissionSetId 
         FROM PermissionSetAssignment`
      );

      const assignedPermissionSetIds = new Set(assignments.records.map(a => a.PermissionSetId));
      const unassignedPermissionSets = permissionSets.records.filter(ps => !assignedPermissionSetIds.has(ps.Id));

      if (unassignedPermissionSets.length > 0) {
        this.healthResults.push({
          category: 'Unused Components',
          title: 'Unassigned or Unused Permission Sets',
          severity: 'Low',
          count: unassignedPermissionSets.length,
          items: unassignedPermissionSets.map(ps => `${ps.Label} (${ps.Name})`),
          description: 'Unassigned permission sets consume storage and create confusion in security management.',
          recommendation: 'Review unassigned permission sets and either assign them to users or delete if no longer needed.'
        });
      }
    } catch (error) {
      this.logger(`Error checking Unused Permission Sets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkProfilesWithoutUsers(): Promise<void> {
    try {
      // Get all profiles
      const profiles = await this.connection.query<ProfileRecord>(
        `SELECT Id, Name, UserLicense.Name 
         FROM Profile`
      );

      // Get users by profile
      const users = await this.connection.query<UserRecord>(
        `SELECT ProfileId 
         FROM User 
         WHERE IsActive = true`
      );

      const profilesWithUsers = new Set(users.records.map(u => u.ProfileId));
      const profilesWithoutUsers = profiles.records.filter(p => !profilesWithUsers.has(p.Id));

      if (profilesWithoutUsers.length > 0) {
        this.healthResults.push({
          category: 'Unused Components',
          title: 'Profiles with No Users Assigned',
          severity: 'Low',
          count: profilesWithoutUsers.length,
          items: profilesWithoutUsers.map(p => `${p.Name}`),
          description: 'Profiles without assigned users are unnecessary and can be removed to simplify security management.',
          recommendation: 'Review profiles without users and consider deleting those that are no longer needed.'
        });
      }
    } catch (error) {
      this.logger(`Error checking Profiles Without Users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkLowCodeCoverage(): Promise<void> {
    try {
      // Use Tooling API to query ApexCodeCoverageAggregate
      const coverage = await this.connection.tooling.query(
        `SELECT ApexClassOrTriggerId, ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered 
         FROM ApexCodeCoverageAggregate 
         WHERE NumLinesCovered > 0 OR NumLinesUncovered > 0`
      );

      if (coverage.records && coverage.records.length > 0) {
        const lowCoverageClasses = (coverage.records as TestCoverageRecord[]).filter(cov => {
          const totalLines = (cov.NumLinesCovered ?? 0) + (cov.NumLinesUncovered ?? 0);
          const coveragePercentage = totalLines > 0 ? ((cov.NumLinesCovered ?? 0) / totalLines) * 100 : 0;
          return coveragePercentage < 75; // Flag classes with less than 75% coverage
        });

        if (lowCoverageClasses.length > 0) {
          this.healthResults.push({
            category: 'Code Coverage Issue',
            title: 'Low Code Coverage in Apex Tests',
            severity: 'High',
            count: lowCoverageClasses.length,
            items: lowCoverageClasses.map(cov => {
              const totalLines = (cov.NumLinesCovered ?? 0) + (cov.NumLinesUncovered ?? 0);
              const coveragePercentage = totalLines > 0 ? Math.round(((cov.NumLinesCovered ?? 0) / totalLines) * 100) : 0;
              return `${cov.ApexClassOrTrigger?.Name ?? cov.ApexClassOrTriggerId} (${coveragePercentage}% coverage)`;
            }),
            description: 'Low test coverage indicates insufficient testing and increases deployment risk.',
            recommendation: 'Increase test coverage to at least 75% for all Apex classes and triggers. Aim for meaningful tests, not just coverage.'
          });
        }
      }
    } catch (error) {
      this.logger(`Error checking Low Code Coverage: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Fallback to manual review if Tooling API fails
      this.healthResults.push({
        category: 'Code Coverage Issue',
        title: 'Low Code Coverage in Apex Tests (Manual Review Required)',
        severity: 'High',
        count: 0,
        items: ['Tooling API not accessible - run test coverage reports in Setup > Apex Test Execution or use Salesforce CLI'],
        description: 'Low test coverage indicates insufficient testing and increases deployment risk.',
        recommendation: 'Increase test coverage to at least 75% for all Apex classes and triggers. Aim for meaningful tests, not just coverage.'
      });
    }
  }

  private async checkUnusedRecordTypes(): Promise<void> {
    try {
      // This would need complex logic to check actual usage
      const inactiveRecordTypes = await this.connection.query<ComponentRecord>(
        `SELECT Id, Name, SobjectType 
         FROM RecordType 
         WHERE IsActive = false`
      );

      if (inactiveRecordTypes.records.length > 0) {
        this.healthResults.push({
          category: 'Unused Components',
          title: 'Unused Record Types',
          severity: 'Low',
          count: inactiveRecordTypes.records.length,
          items: inactiveRecordTypes.records.map(rt => `${rt.Name ?? 'Unknown'} (${rt.SobjectType ?? 'Unknown'})`),
          description: 'Inactive record types consume storage and can cause confusion.',
          recommendation: 'Review inactive record types and delete those no longer needed after ensuring no data dependencies.'
        });
      }
    } catch (error) {
      this.logger(`Error checking Unused Record Types: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkTriggerOveruse(): Promise<void> {
    try {
      // Count triggers per object
      const triggers = await this.connection.query<{ TableEnumOrId: string; Name: string }>(
        `SELECT TableEnumOrId, Name 
         FROM ApexTrigger`
      );

      const triggersByObject = new Map<string, string[]>();
      triggers.records.forEach(trigger => {
        if (!triggersByObject.has(trigger.TableEnumOrId)) {
          triggersByObject.set(trigger.TableEnumOrId, []);
        }
        triggersByObject.get(trigger.TableEnumOrId)!.push(trigger.Name);
      });

      const objectsWithMultipleTriggers = Array.from(triggersByObject.entries())
        .filter(([, triggerNames]) => triggerNames.length > 1);

      if (objectsWithMultipleTriggers.length > 0) {
        this.healthResults.push({
          category: 'Code Coverage Issue',
          title: 'Overuse of Triggers (Multiple triggers per object)',
          severity: 'Medium',
          count: objectsWithMultipleTriggers.length,
          items: objectsWithMultipleTriggers.map(([objectName, triggerNames]) =>
            `${objectName}: ${triggerNames.join(', ')}`
          ),
          description: 'Multiple triggers per object can cause unpredictable execution order and make debugging difficult.',
          recommendation: 'Consolidate multiple triggers per object into a single trigger with proper handler classes for better maintainability.'
        });
      }
    } catch (error) {
      this.logger(`Error checking Trigger Overuse: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkNamingConventions(): Promise<void> {
    try {
      // Check for poor naming conventions in custom objects and fields
      const customObjects = await this.connection.query<ComponentRecord>(
        `SELECT QualifiedApiName 
         FROM EntityDefinition 
         WHERE IsCustomizable = true AND QualifiedApiName LIKE '%__c'`
      );

      const poorlyNamedObjects = customObjects.records.filter(obj => {
        const name = obj.QualifiedApiName ?? '';
        // Check for single character names, all caps, or no clear naming pattern
        return name.length < 5 || name === name.toUpperCase() || !/^[A-Z][a-zA-Z_]*__c$/.test(name);
      });

      if (poorlyNamedObjects.length > 0) {
        this.healthResults.push({
          category: 'Code Coverage Issue',
          title: 'Lack of Documentation or Naming Conventions',
          severity: 'Low',
          count: poorlyNamedObjects.length,
          items: poorlyNamedObjects.map(obj => obj.QualifiedApiName ?? 'Unknown'),
          description: 'Poor naming conventions make code harder to understand and maintain.',
          recommendation: 'Establish and enforce naming conventions for all custom objects, fields, and Apex classes. Use descriptive, consistent names.'
        });
      }
    } catch (error) {
      this.logger(`Error checking Naming Conventions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkUnusedReportsAndDashboards(): Promise<void> {
    try {
      // Check for reports not viewed or run recently
      const unusedReports = await this.connection.query<ReportRecord>(
        `SELECT Id, Name, LastViewedDate, LastRunDate 
         FROM Report 
         WHERE (LastViewedDate < LAST_N_DAYS:90 OR LastViewedDate = null) 
         AND (LastRunDate < LAST_N_DAYS:90 OR LastRunDate = null)`
      );

      const unusedDashboards = await this.connection.query<DashboardRecord>(
        `SELECT Id, Title, LastViewedDate 
         FROM Dashboard 
         WHERE LastViewedDate < LAST_N_DAYS:90 OR LastViewedDate = null`
      );

      const totalUnused = unusedReports.records.length + unusedDashboards.records.length;

      if (totalUnused > 0) {
        this.healthResults.push({
          category: 'Unused Components',
          title: 'Unused Reports and Dashboards',
          severity: 'Low',
          count: totalUnused,
          items: [
            ...unusedReports.records.slice(0, 10).map(report => {
              const lastViewed = report.LastViewedDate ? new Date(report.LastViewedDate).toLocaleDateString() : 'Never';
              const lastRun = report.LastRunDate ? new Date(report.LastRunDate).toLocaleDateString() : 'Never';
              return `Report: ${report.Name} (Last Viewed: ${lastViewed}, Last Run: ${lastRun})`;
            }),
            ...unusedDashboards.records.slice(0, 10).map(dashboard => {
              const lastViewed = dashboard.LastViewedDate ? new Date(dashboard.LastViewedDate).toLocaleDateString() : 'Never';
              return `Dashboard: ${dashboard.Title} (Last Viewed: ${lastViewed})`;
            })
          ],
          description: 'Reports and dashboards not viewed or run in 90+ days may be obsolete and consume storage.',
          recommendation: 'Review unused reports and dashboards with business users and archive or delete those no longer needed.'
        });
      }
    } catch (error) {
      this.logger(`Error checking Unused Reports and Dashboards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkUnusedApexClasses(): Promise<void> {
    try {
      this.logger('Analyzing unused Apex classes using Tooling API...');

      // Step 1: Get all non-test Apex classes from current namespace
      const allApexClasses = await this.connection.tooling.query(
        `SELECT Id, Name, SymbolTable 
         FROM ApexClass 
         WHERE NamespacePrefix = null`
      );

      if (!allApexClasses.records || allApexClasses.records.length === 0) {
        this.healthResults.push({
          category: 'Unused Apex',
          title: 'Unused Apex Classes (None Found)',
          severity: 'Low',
          count: 0,
          items: ['No Apex classes found to analyze'],
          description: 'No Apex classes detected in this org.',
          recommendation: 'Continue following best practices for Apex development.'
        });
        return;
      }

      // Filter out test classes based on naming conventions and SymbolTable
      const nonTestClasses = (allApexClasses.records as SymbolTableRecord[]).filter(cls => {
        // Basic name filtering
        if (cls.Name.toLowerCase().includes('test') || cls.Name.endsWith('_Test')) {
          return false;
        }

        // Check SymbolTable for @isTest annotation
        if (cls.SymbolTable?.methods) {
          const hasTestMethods = cls.SymbolTable.methods.some(method =>
            method.name && method.name.toLowerCase().includes('test')
          );
          if (hasTestMethods) {
            return false;
          }
        }

        return true;
      });

      if (nonTestClasses.length === 0) {
        this.healthResults.push({
          category: 'Unused Apex',
          title: 'Unused Apex Classes (Only Test Classes Found)',
          severity: 'Low',
          count: 0,
          items: ['Only test classes found - no business logic classes to analyze'],
          description: 'All detected Apex classes appear to be test classes.',
          recommendation: 'Good! Continue following best practices for Apex development.'
        });
        return;
      }

      this.logger(`Found ${nonTestClasses.length} non-test Apex classes to analyze`);

      // Step 2: Check each class for usage via MetadataComponentDependency in chunks
      const unusedClasses: string[] = [];
      const analysisErrors: string[] = [];

      // Process classes in chunks to optimize API calls
      const chunkSize = 10;
      const totalChunks = Math.ceil(nonTestClasses.length / chunkSize);

      // eslint-disable-next-line no-await-in-loop
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const startIndex = chunkIndex * chunkSize;
        const endIndex = Math.min(startIndex + chunkSize, nonTestClasses.length);
        const chunk = nonTestClasses.slice(startIndex, endIndex);

        this.logger(`Processing chunk ${chunkIndex + 1}/${totalChunks}: Analyzing ${chunk.length} classes (${chunk.map(c => c.Name).join(', ')})`);

        try {
          // Build query for this chunk of class IDs
          const classIds = chunk.map(cls => cls.Id);
          // eslint-disable-next-line no-await-in-loop
          const dependencyResult = await this.connection.tooling.query(
            `SELECT MetadataComponentName, MetadataComponentType, RefMetadataComponentId 
             FROM MetadataComponentDependency 
             WHERE RefMetadataComponentId IN ('${classIds.join("','")}')`
          );

          // Create a map of class ID to dependencies
          const dependencyMap = new Map<string, MetadataComponentDependencyRecord[]>();
          if (dependencyResult.records) {
            (dependencyResult.records as MetadataComponentDependencyRecord[]).forEach(dep => {
              if (!dependencyMap.has(dep.RefMetadataComponentId!)) {
                dependencyMap.set(dep.RefMetadataComponentId!, []);
              }
              dependencyMap.get(dep.RefMetadataComponentId!)!.push(dep);
            });
          }

          // Process each class in this chunk - only add to unusedClasses if no dependencies found
          chunk.forEach(apexClass => {
            const dependencies = dependencyMap.get(apexClass.Id);

            if (!dependencies || dependencies.length === 0) {
              // Class appears unused - add to unused list
              unusedClasses.push(apexClass.Name);
            }
            // If class has dependencies, we don't add it to any list (skip it)
          });

          this.logger(`Chunk ${chunkIndex + 1}/${totalChunks} completed: Found ${dependencyResult.records?.length || 0} dependencies`);

        } catch (error) {
          this.logger(`Error processing chunk ${chunkIndex + 1}/${totalChunks}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // Add all classes in this chunk to errors
          chunk.forEach(apexClass => {
            analysisErrors.push(`${apexClass.Name}: Chunk processing failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
          });
        }
      }

      // Step 3: Generate report focusing only on unused classes
      const totalAnalyzed = nonTestClasses.length;
      const totalUnused = unusedClasses.length;
      const totalErrors = analysisErrors.length;
      const totalUsed = totalAnalyzed - totalUnused - totalErrors;

      const reportItems: string[] = [];

      if (unusedClasses.length > 0) {
        reportItems.push(`=== UNUSED APEX CLASSES (${unusedClasses.length}) ===`);
        reportItems.push(...unusedClasses.map(className => `${className} (no metadata dependencies found)`));
        reportItems.push('');
      } else {
        reportItems.push('No unused Apex classes found - all classes appear to be referenced by other components.');
      }

      if (analysisErrors.length > 0) {
        reportItems.push(`=== ANALYSIS ERRORS (${analysisErrors.length}) ===`);
        reportItems.push(...analysisErrors);
      }

      // Determine severity based on results
      let severity: 'High' | 'Medium' | 'Low' = 'Low';
      if (unusedClasses.length > totalAnalyzed * 0.3) {
        severity = 'High'; // More than 30% unused
      } else if (unusedClasses.length > 0) {
        severity = 'Medium'; // Some unused classes found
      }

      this.healthResults.push({
        category: 'Unused Apex',
        title: 'Unused Apex Classes',
        severity,
        count: unusedClasses.length,
        items: reportItems,
        description: `Analyzed ${totalAnalyzed} non-test Apex classes. Found ${totalUnused} potentially unused classes and ${totalUsed} actively used classes${totalErrors > 0 ? ` (${totalErrors} analysis errors)` : ''}.`,
        recommendation: unusedClasses.length > 0
          ? `Review the ${unusedClasses.length} unused classes listed above. These classes have no metadata dependencies, meaning they are not referenced by Flows, LWC, Aura, VF pages, or other Apex classes. Verify manually before deletion as some may be used via dynamic instantiation or external calls.`
          : 'Excellent! All Apex classes appear to be actively used by other metadata components.'
      });

    } catch (error) {
      this.logger(`Error checking unused Apex classes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.healthResults.push({
        category: 'Unused Apex',
        title: 'Unused Apex Classes (Analysis Failed)',
        severity: 'Low',
        count: 0,
        items: ['Analysis could not be completed'],
        description: 'Error occurred while analyzing Apex classes for usage.',
        recommendation: 'Manually review Apex classes in Setup → Apex Classes for potential cleanup opportunities.'
      });
    }
  }

  private async checkUnusedPageLayouts(): Promise<void> {
    try {
      this.logger('Analyzing unused page layouts...');

      // Step 1: Get all page layouts using Tooling API (no SOQL in loop)
      const allLayouts = await this.connection.tooling.query(
        `SELECT Id, Name, TableEnumOrId 
         FROM Layout`
      );

      if (!allLayouts.records || allLayouts.records.length === 0) {
        this.healthResults.push({
          category: 'Unused Components',
          title: 'Unused Page Layouts (None Found)',
          severity: 'Low',
          count: 0,
          items: ['No page layouts found to analyze'],
          description: 'No page layouts detected in this org.',
          recommendation: 'Continue following best practices for page layout management.'
        });
        return;
      }

      this.logger(`Found ${allLayouts.records.length} page layouts to analyze`);

      // Step 2: Use an alternative approach since LayoutAssignment is not queryable
      // We'll check which layouts have standard names that suggest they're default/system layouts
      // and consider the rest as potentially unused (this is a simplified approach)
      const assignedLayoutIds = new Set<string>();

      // Get all profiles to understand org structure
      const profiles = await this.connection.query<ProfileRecord>(
        `SELECT Id, Name 
         FROM Profile`
      );

      this.logger(`Found ${profiles.records?.length || 0} profiles in the org`);

      // Since we can't query LayoutAssignment directly, we'll use a heuristic approach:
      // Mark layouts as "assigned" if they have standard naming patterns that suggest they're in use
      (allLayouts.records as LayoutRecord[]).forEach(layout => {
        const layoutName = layout.Name || '';
        // Standard layouts typically have these patterns
        if (layoutName.includes('Layout') ||
          layoutName.includes('Standard') ||
          layoutName.includes('Default') ||
          layoutName === layout.TableEnumOrId || // Object name matches layout name
          layoutName.toLowerCase().includes('read only') ||
          layoutName.toLowerCase().includes('readonly')) {
          assignedLayoutIds.add(layout.Id);
        }
      });

      // Step 4: Filter layouts to find unassigned ones (using collections, no loops with SOQL)
      const unassignedLayouts = (allLayouts.records as LayoutRecord[]).filter(layout =>
        !assignedLayoutIds.has(layout.Id)
      );

      // Step 5: Generate report
      if (unassignedLayouts.length > 0) {
        // Group layouts by object for better reporting
        const layoutsByObject = new Map<string, LayoutRecord[]>();
        unassignedLayouts.forEach(layout => {
          const objectName = layout.TableEnumOrId || 'Unknown Object';
          if (!layoutsByObject.has(objectName)) {
            layoutsByObject.set(objectName, []);
          }
          layoutsByObject.get(objectName)!.push(layout);
        });

        const reportItems: string[] = [];

        // Create detailed report by object
        layoutsByObject.forEach((layouts, objectName) => {
          reportItems.push(`=== ${objectName.toUpperCase()} (${layouts.length} potentially unused layouts) ===`);
          layouts.forEach(layout => {
            reportItems.push(`${layout.Name} (custom name - verify assignment manually)`);
          });
          reportItems.push('');
        });

        // Add summary
        reportItems.unshift(`Found ${unassignedLayouts.length} page layouts with custom names that may not be assigned to profiles across ${layoutsByObject.size} objects:`);
        reportItems.unshift('');

        // Determine severity based on percentage of unused layouts
        let severity: 'High' | 'Medium' | 'Low' = 'Low';
        const unusedPercentage = (unassignedLayouts.length / allLayouts.records.length) * 100;
        if (unusedPercentage > 30) {
          severity = 'High'; // More than 30% unused
        } else if (unusedPercentage > 10) {
          severity = 'Medium'; // More than 10% unused
        }

        this.healthResults.push({
          category: 'Unused Components',
          title: 'Potentially Unused Page Layouts',
          severity,
          count: unassignedLayouts.length,
          items: reportItems,
          description: `Found ${unassignedLayouts.length} page layouts (${Math.round(unusedPercentage)}% of total) with custom names that may not be assigned to profiles. This analysis uses naming patterns to identify potentially unused layouts since direct assignment queries are not available via API.`,
          recommendation: `Review the ${unassignedLayouts.length} potentially unused page layouts listed above. Manually verify in Setup → Object Manager → [Object] → Page Layouts → Assignment to confirm which are actually unused before deletion.`
        });
      } else {
        this.healthResults.push({
          category: 'Unused Components',
          title: 'Potentially Unused Page Layouts',
          severity: 'Low',
          count: 0,
          items: ['All page layouts appear to follow standard naming conventions'],
          description: 'All page layouts in the org follow standard naming patterns that suggest they are system/default layouts or are in use.',
          recommendation: 'Continue following best practices for page layout management. Consider manually reviewing custom layouts in Setup → Object Manager to ensure they are still needed.'
        });
      }

    } catch (error) {
      this.logger(`Error checking unused page layouts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.healthResults.push({
        category: 'Unused Components',
        title: 'Unused Page Layouts (Analysis Failed)',
        severity: 'Low',
        count: 0,
        items: ['Analysis could not be completed due to API limitations'],
        description: 'Error occurred while analyzing page layouts for usage.',
        recommendation: 'Manually review page layouts in Setup → Object Manager → [Object] → Page Layouts to identify potential cleanup opportunities.'
      });
    }
  }

  private generateCategoryReports(): void {
    try {
      this.logger('Generating consolidated health check reports...');

      // Ensure Exports directory exists
      const exportDir = path.join(process.cwd(), 'Exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const timestamp = HealthProcessor.generateTimestamp();
      const baseFileName = `SF_health_${this.orgAlias}_${timestamp}`;
      const textFileName = path.join(exportDir, `${baseFileName}.txt`);
      const excelFileName = path.join(exportDir, `${baseFileName}.xlsx`);

      // Generate single consolidated text report
      const textGenerator = new TextHealthReportGenerator(this.orgAlias, this.healthResults);
      textGenerator.generateReport(textFileName);

      // Generate single Excel report with multiple tabs
      const excelGenerator = new ExcelHealthReportGenerator(this.orgAlias, this.healthResults, this.orgSummaryStats);
      excelGenerator.generateReport(excelFileName);

      this.logger('Health check reports generated:');
      this.logger(`  Text: ${textFileName}`);
      this.logger(`  Excel: ${excelFileName}`);

    } catch (error) {
      this.logger(`Error generating consolidated reports: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

} 