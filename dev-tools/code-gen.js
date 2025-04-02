#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Handlebars = require('handlebars');
const mkdirp = require('mkdirp');

// Configuration with existing project structure
const config = {
  swaggerDir: './api_spec/',                 // Where Swagger files are stored
  templatesDir: './templates/',               // Templates directory
  featuresDir: './src/features/',             // Existing features directory
  integrationTestsDir: './src/integration_tests/', // Existing integration tests directory
  stepDefinitionsDir: './src/step_definitions/' // Step definitions directory
};

// Parse command line arguments
const args = process.argv.slice(2);
const isSingleMode = args.includes('--single');
const isCleanMode = args.includes('--clean');
const isCleanSingleMode = args.includes('--clean-single');
const targetFile = args[args.indexOf('--file') + 1];

// Only check essential directories exist
const checkDirectories = () => {
  const requiredDirs = [config.swaggerDir, config.templatesDir];
  
  requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.error(`Required directory ${dir} does not exist. Please create it first.`);
      process.exit(1);
    }
  });
};

// Cleanup function to remove generated files
const cleanupGeneratedFiles = (tag = null) => {
  const cleanupDirs = [config.featuresDir, config.stepDefinitionsDir];
  
  cleanupDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      if (tag) {
        // Clean specific tag
        const tagPath = path.join(dir, tag);
        if (fs.existsSync(tagPath)) {
          console.log(`Cleaning up files for tag: ${tag}`);
          fs.rmSync(tagPath, { recursive: true, force: true });
        }
      } else {
        // Clean all generated files
        console.log('Cleaning up all generated files');
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          if (fs.statSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          }
        });
      }
    }
  });
};

// Feature template for API tests
const featureTemplate = `@{{tag}} @api @regression
Feature: {{featureName}}
  As an API consumer
  I want to interact with the {{name}} endpoint
  So that I can {{purpose}}

{{#each scenarios}}
  Scenario: {{this.name}} for {{../path}}
    Given I have a request for "{{../path}}"
    When I send a {{../method}} request with {{#if this.body}}the following body:
      """
      {{this.body}}
      """{{else}}no body{{/if}}
    Then I should receive a response with status {{this.expectedStatus}}
    And the response should match the following schema:
      """
      {{this.expectedResponse}}
      """
{{/each}}`;

// Integration test template
const integrationTestTemplate = `@{{swaggerA}} @{{swaggerB}} @integration @regression @not-implemented
Feature: {{featureName}}
  As an API consumer
  I want to integrate data between services
  So that I can {{purpose}}

  Background:
    Given I am using the API testing framework

  @integration-flow @pending
  Scenario: {{scenarioName}}
    # Call {{swaggerA}} endpoint
    When I send a {{firstCall.method}} request to "{{firstCall.endpoint}}"
    Then I should receive a {{firstCall.expectedStatus}} response
    And I store the response field "{{firstCall.extractField}}" as "{{firstCall.storeAs}}"

    # Use stored data in {{swaggerB}} call
    When I send a {{secondCall.method}} request to "{{secondCall.endpoint}}" with body:
      """
      {{secondCall.bodyTemplate}}
      """
    Then I should receive a {{secondCall.expectedStatus}} response
`;

// Integration steps template
const integrationStepsTemplate = `import { Given, When, Then } from '@cucumber/cucumber';
import { Actor } from '@serenity-js/core';
import { CallAnApi, LastResponse, Send } from '@serenity-js/rest';
import { Ensure, equals } from '@serenity-js/assertions';

/**
 * Integration test steps for {{featureName}}
 * Generated from Swagger specifications:
 * - {{swaggerA}}: {{firstCall.endpoint}}
 * - {{swaggerB}}: {{secondCall.endpoint}}
 * 
 * @pending Implementation needed
 */

/* 
 * Integration test steps using Serenity/JS's built-in actor memory management:
 * - Maintains isolation between parallel test runs
 * - Each actor has its own memory space
 * - Data is automatically cleaned up after each scenario
 */
When('{actor} send a {{firstCall.method}} request to "{{firstCall.endpoint}}"', async (actor: Actor) => {
    // TODO: Implement the first API call
    return 'pending';
});

Then('{actor} store the response field "{{firstCall.extractField}}" as "{{firstCall.storeAs}}"', async (actor: Actor) => {
    // TODO: Implement response field extraction and storage
    return 'pending';
});

When('{actor} send a {{secondCall.method}} request to "{{secondCall.endpoint}}" with stored data', async (actor: Actor) => {
    // TODO: Implement the second API call using stored data
    return 'pending';
});
`;

// Main function to process Swagger files and generate tests
const processSwaggerFiles = async () => {
  checkDirectories();
  
  if (isCleanMode) {
    cleanupGeneratedFiles();
    return;
  }
  
  if (isCleanSingleMode) {
    if (!targetFile) {
      console.error('Please specify a file with --file parameter');
      process.exit(1);
    }
    const tag = getTagFromFileName(targetFile);
    cleanupGeneratedFiles(tag);
    return;
  }
  
  const swaggerFiles = fs.readdirSync(config.swaggerDir)
    .filter(file => file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.json'));
  
  if (swaggerFiles.length === 0) {
    console.log(`No Swagger/OpenAPI specification files found in ${config.swaggerDir}`);
    return;
  }
  
  if (isSingleMode) {
    if (!targetFile) {
      console.error('Please specify a file with --file parameter');
      process.exit(1);
    }
    if (!swaggerFiles.includes(targetFile)) {
      console.error(`File ${targetFile} not found in ${config.swaggerDir}`);
      process.exit(1);
    }
    const swaggerDoc = {
      name: targetFile,
      content: yaml.load(fs.readFileSync(path.join(config.swaggerDir, targetFile), 'utf8'))
    };
    await generateApiTests(swaggerDoc.content, getTagFromFileName(targetFile));
  } else {
    const swaggerDocs = swaggerFiles.map(file => ({
      name: file,
      content: yaml.load(fs.readFileSync(path.join(config.swaggerDir, file), 'utf8'))
    }));
    
    // Generate individual API tests
    for (const {name, content} of swaggerDocs) {
      const tag = getTagFromFileName(name);
      await generateApiTests(content, tag);
    }
    
    // Generate integration tests
    await generateIntegrationTests(swaggerDocs);
  }
};

// Helper functions
const getTagFromFileName = (fileName) => {
  // Convert something like "Swagger-A.json" or "BT-Service.json" to "sa" or "bts"
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '') // Remove non-alphanumeric chars except hyphens
    .replace(/swagger-?/, '') // Remove "swagger" or "swagger-"
    .replace(/service-?/, '') // Remove "service" or "service-"
    .replace(/-/g, ''); // Remove remaining hyphens
};

const generateApiTests = async (swaggerDoc, tag) => {
    const paths = swaggerDoc.paths || {};
  
    for (const [path, methods] of Object.entries(paths)) {
        for (const [method, endpoint] of Object.entries(methods)) {
            if (!['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
                continue;
            }
          
          const scenarios = generateTestScenarios(path, method, endpoint);
            const content = Handlebars.compile(featureTemplate)({
            tag,
                featureName: endpoint.summary || `${method.toUpperCase()} ${path}`,
                name: endpoint.operationId || `${method}${path}`,
            purpose: endpoint.description || `access the ${path} endpoint`,
            path,
            method: method.toUpperCase(),
            scenarios
          });
          
            // Create subfolder based on API path segments
            const pathSegments = path.split('/').filter(s => s && !s.includes('{')); // Skip empty and parameter segments
            const subfolderPath = pathSegments.slice(0, -1).join('/'); // Use all but last segment
            
            // Combine tag and path-based subfolder
            const fileName = `${method.toLowerCase()}_${pathSegments[pathSegments.length-1]}.feature`;
            const filePath = path.join(
                config.featuresDir, 
                tag,
                subfolderPath,
                fileName
            );
            
            mkdirp.sync(path.dirname(filePath));
            fs.writeFileSync(filePath, content);
        }
    }
};

// Simplified test scenario generation
const generateTestScenarios = (path, method, endpoint) => {
  return [
    {
      name: 'Default case',
      body: endpoint.requestBody ? JSON.stringify(generateSampleBody(endpoint.requestBody), null, 2) : '',
      expectedStatus: 200,
      expectedResponse: JSON.stringify({ isError: false, error: null }, null, 2)
    },
    // ... other scenarios
  ];
};

const generateIntegrationTests = async (swaggerDocs) => {
    for (const [swaggerA, swaggerB] of findIntegrationPairs(swaggerDocs)) {
        const tagA = getTagFromFileName(swaggerA.name);
        const tagB = getTagFromFileName(swaggerB.name);
        
        // Flattened structure: just put in sa/integration/
        const integrationPath = path.join(
            config.featuresDir,
            tagA,
            'integration'
        );
        
        // Name file to clearly indicate services involved
        const fileName = `${tagA}_with_${tagB}_integration.feature`;
        const filePath = path.join(integrationPath, fileName);
        
        // Generate feature file
        const content = Handlebars.compile(integrationTestTemplate)({
            swaggerA: tagA,
            swaggerB: tagB,
            featureName: `${tagA.toUpperCase()} with ${tagB.toUpperCase()} Integration`,
            purpose: 'integrate data between services',
            scenarioName: `Integration between ${tagA} and ${tagB}`,
            firstCall: {
                method: 'GET',
                endpoint: '/api/example',
                expectedStatus: 200,
                extractField: 'data.field',
                storeAs: 'storedValue'
            },
            secondCall: {
                method: 'POST',
                endpoint: '/api/other',
                expectedStatus: 200,
                bodyTemplate: `{
                    "data": {
                        "field": "\${storedValue}"
                    }
                }`
            }
        });
        
        // Create directory and write feature file
        mkdirp.sync(integrationPath);
        fs.writeFileSync(filePath, content);
        
        // Similarly flatten step definitions
        const stepDefPath = path.join(
            config.stepDefinitionsDir,
            tagA,
            'integration',
            `${tagA}_with_${tagB}_steps.ts`
        );
        
        mkdirp.sync(path.dirname(stepDefPath));
        fs.writeFileSync(stepDefPath, Handlebars.compile(integrationStepsTemplate)({
            featureName: `${tagA.toUpperCase()} with ${tagB.toUpperCase()} Integration`,
            swaggerA: tagA,
            swaggerB: tagB,
            firstCall: {
                method: 'GET',
                endpoint: '/api/example',
                extractField: 'data.field',
                storeAs: 'storedValue'
            },
            secondCall: {
                method: 'POST',
                endpoint: '/api/other'
            }
        }));
    }
};

// Helper function to find potential integration pairs
const findIntegrationPairs = (swaggerDocs) => {
    const pairs = [];
    for (let i = 0; i < swaggerDocs.length; i++) {
        for (let j = i + 1; j < swaggerDocs.length; j++) {
            pairs.push([swaggerDocs[i], swaggerDocs[j]]);
        }
    }
    return pairs;
};

// Run the generator
processSwaggerFiles().catch(error => {
  console.error('Error generating tests:', error);
  process.exit(1);
});