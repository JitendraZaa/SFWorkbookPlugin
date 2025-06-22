import * as fs from 'node:fs';
import * as path from 'node:path';
import { Connection } from '@salesforce/core';

export interface HealthCheckResult {
  category: string;
  title: string;
  severity: 'High' | 'Medium' | 'Low';
  count: number;
  items: string[];
  description: string;
  recommendation: string;
}

export interface ComponentRecord {
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
}

export interface FlowRecord {
  Id: string;
  MasterLabel?: string;
  Label?: string;
  Status: string;
  ProcessType: string;
  ApiVersion?: number;
  VersionNumber?: number;
}

export interface FlowDefinitionRecord {
  Id: string;
  DeveloperName: string;
  ActiveVersionId?: string;
  ManageableState?: string;
}

export interface FlowRecord2 {
  Id: string;
  DeveloperName?: string;
  ProcessType?: string;
  Status?: string;
  MasterLabel?: string;
}

export interface ApexRecord {
  Id: string;
  Name: string;
  ApiVersion: number;
  Status: string;
  Body?: string;
}

export interface ValidationRuleRecord {
  Id: string;
  ValidationName: string;
  EntityDefinitionId?: string;
  EntityDefinition?: {
    QualifiedApiName: string;
  };
  Active: boolean;
}

export interface FieldRecord {
  Id: string;
  QualifiedApiName: string;
  EntityDefinitionId: string;
  LastReferencedDate?: string;
}

export interface PermissionSetRecord {
  Id: string;
  Name: string;
  Label: string;
  IsOwnedByProfile: boolean;
}

export interface ProfileRecord {
  Id: string;
  Name: string;
  UserLicense: { Name: string };
}

export interface UserRecord {
  Id: string;
  ProfileId: string;
  IsActive: boolean;
}

export interface TestCoverageRecord {
  ApexClassOrTriggerId: string;
  TestMethodName?: string;
  NumLinesCovered: number;
  NumLinesUncovered: number;
  Coverage?: { coveredLines: number[]; uncoveredLines: number[] };
  ApexClassOrTrigger?: {
    Name: string;
  };
}

export interface ReportRecord {
  Id: string;
  Name: string;
  LastRunDate?: string;
  LastViewedDate?: string;
}

export interface DashboardRecord {
  Id: string;
  Title: string;
  LastViewedDate?: string;
}

export class HealthProcessor {
  private connection: Connection;
  private logger: (message: string) => void;
  private healthResults: HealthCheckResult[] = [];

  public constructor(connection: Connection, logger: (message: string) => void) {
    this.connection = connection;
    this.logger = logger;
  }

  public async performHealthCheck(): Promise<void> {
    this.logger('Starting Salesforce Org Health Check...');

    try {
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
        this.checkUnusedReportsAndDashboards()
      ]);

      this.logger(`Health check completed. Found ${this.healthResults.length} categories with issues.`);

      // Generate text report
      this.generateTextReport();

    } catch (error) {
      this.logger(`Error during health check: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
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
          category: 'Legacy Technology',
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
          category: 'Legacy Automation',
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
          category: 'Legacy Automation',
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
            category: 'Legacy Automation',
            title: 'Potential Process Builders (Pattern-based Detection)',
            severity: 'High',
            count: flowMetadata.records.length,
            items: (flowMetadata.records as FlowDefinitionRecord[]).map(pb => `${pb.DeveloperName} (Potential Process Builder - verify manually)`),
            description: 'Found Flow Definitions with naming patterns suggesting they might be Process Builders.',
            recommendation: 'Review these flows manually in Setup > Process Builder to confirm if they are Process Builders that need migration.'
          });
        } else {
          this.healthResults.push({
            category: 'Legacy Automation',
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
          category: 'Legacy Automation',
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
          category: 'Legacy Automation',
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
        category: 'Legacy Automation',
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
          category: 'Legacy Technology',
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
        category: 'Code Quality Issues',
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
            category: 'Code Quality Issues',
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
        category: 'Code Quality Issues',
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
          category: 'Code Quality Issues',
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
          category: 'Code Quality Issues',
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

  private generateTextReport(): void {
    try {
      this.logger('Generating text health check report...');

      // Ensure Exports directory exists
      const exportDir = path.join(process.cwd(), 'Exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const fileName = path.join(exportDir, `Salesforce_Health_Check_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);

      let reportContent = '';

      // Title
      reportContent += '='.repeat(60) + '\n';
      reportContent += '           SALESFORCE ORG HEALTH CHECK REPORT\n';
      reportContent += '='.repeat(60) + '\n';
      reportContent += `Generated on: ${new Date().toLocaleDateString()}\n\n`;

      // Executive Summary
      reportContent += 'EXECUTIVE SUMMARY\n';
      reportContent += '-'.repeat(20) + '\n';
      reportContent += `Total Technical Debt Categories Found: ${this.healthResults.length}\n`;

      const highSeverityCount = this.healthResults.filter(r => r.severity === 'High').length;
      const mediumSeverityCount = this.healthResults.filter(r => r.severity === 'Medium').length;
      const lowSeverityCount = this.healthResults.filter(r => r.severity === 'Low').length;

      reportContent += `High Severity Issues: ${highSeverityCount}\n`;
      reportContent += `Medium Severity Issues: ${mediumSeverityCount}\n`;
      reportContent += `Low Severity Issues: ${lowSeverityCount}\n\n`;

      // Technical Debt Details
      reportContent += 'TECHNICAL DEBT ANALYSIS\n';
      reportContent += '-'.repeat(30) + '\n\n';

      // Group results by category
      const categories = [...new Set(this.healthResults.map(r => r.category))];

      categories.forEach(category => {
        const categoryResults = this.healthResults.filter(r => r.category === category);

        reportContent += `${category.toUpperCase()}\n`;
        reportContent += '='.repeat(category.length) + '\n\n';

        categoryResults.forEach(result => {
          reportContent += `${result.title}\n`;
          reportContent += `Severity: ${result.severity} | Count: ${result.count}\n\n`;

          reportContent += `Description: ${result.description}\n\n`;
          reportContent += `Recommendation: ${result.recommendation}\n\n`;

          if (result.items.length > 0 && result.count > 0) {
            reportContent += 'Items Found:\n';
            const itemsToShow = result.items.slice(0, 10); // Limit to first 10 items
            itemsToShow.forEach(item => {
              reportContent += `• ${item}\n`;
            });
            if (result.items.length > 10) {
              reportContent += `... and ${result.items.length - 10} more items\n`;
            }
            reportContent += '\n';
          }

          reportContent += '-'.repeat(50) + '\n\n';
        });
      });

      // Priority Recommendations
      reportContent += 'PRIORITY RECOMMENDATIONS\n';
      reportContent += '-'.repeat(25) + '\n\n';

      const highPriorityItems = this.healthResults.filter(r => r.severity === 'High');
      if (highPriorityItems.length > 0) {
        reportContent += 'HIGH PRIORITY (Address Immediately):\n\n';
        highPriorityItems.forEach((item, index) => {
          reportContent += `${index + 1}. ${item.title}\n`;
          reportContent += `   ${item.recommendation}\n\n`;
        });
      }

      const mediumPriorityItems = this.healthResults.filter(r => r.severity === 'Medium');
      if (mediumPriorityItems.length > 0) {
        reportContent += 'MEDIUM PRIORITY (Address Soon):\n\n';
        mediumPriorityItems.forEach((item, index) => {
          reportContent += `${index + 1}. ${item.title}\n`;
          reportContent += `   ${item.recommendation}\n\n`;
        });
      }

      // Footer
      reportContent += '='.repeat(60) + '\n';
      reportContent += 'Generated by Salesforce Health Check Tool\n';
      reportContent += '='.repeat(60) + '\n';

      fs.writeFileSync(fileName, reportContent);

      this.logger(`Health check report generated: ${fileName}`);
    } catch (error) {
      this.logger(`Error generating text report: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
} 