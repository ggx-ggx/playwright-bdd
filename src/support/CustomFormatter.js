const { Status, formatterHelpers, Formatter } = require('@cucumber/cucumber');
const chalk = require('chalk');
const path = require('path');
const { Worker } = require('worker_threads');
const fs = require('fs');

class CustomFormatter extends Formatter {
    constructor(options) {
        super(options);
        this.indent = '    ';
        this.scenarioCount = 0;
        this.stepCount = 0;
        this.results = [];
        this.currentScenario = null;
        this.currentTags = [];
        this.startTime = Date.now();
        this.eventBroadcaster = options.eventBroadcaster;
        this.log = options.log || console.log;
        this.stepTextById = new Map();
        this.stepStatusById = new Map();
        this.pickleById = new Map();
        this.stepLocationById = new Map();
        this.failureMessageById = new Map();
        this.currentPickleId = null;
        this.featureUris = new Map();
        this.testCaseToPickleId = new Map();
        this.testResults = {
            passed: 0,
            failed: 0,
            skipped: 0,
            undefined: 0
        };
        this.scenarioOutputs = new Map();
        this.failedTests = [];
        this.authLogs = []; // Buffer for authentication logs
        this.outputLock = false;
        this.scenarios = new Map();
        this.currentStep = null;
        this.currentOutput = [];
        this.authLogLock = false;
        this.lineWidth = 80;

        // Register event handlers
        this.eventBroadcaster.on('envelope', (envelope) => {
            if (envelope.gherkinDocument) {
                const { uri, feature } = envelope.gherkinDocument;
                if (feature) {
                    this.featureUris.set(uri, {
                        name: feature.name,
                        children: feature.children || []
                    });
                }
            }
            else if (envelope.testCase) {
                const { id, pickleId, testSteps } = envelope.testCase;
                this.testCaseToPickleId.set(id, pickleId);
                testSteps.forEach(step => {
                    if (step.pickleStepId) {
                        const cleanText = step.pickleStepId.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '').trim();
                        this.stepTextById.set(step.id, cleanText);
                    }
                    if (step.stepDefinitionIds && step.stepDefinitionIds.length > 0) {
                        this.stepLocationById.set(step.id, {
                            stepDefId: step.stepDefinitionIds[0]
                        });
                    }
                });
            }
            else if (envelope.pickle) {
                const { id, name, tags, uri, astNodeIds } = envelope.pickle;
                const featureInfo = this.featureUris.get(uri);
                let scenarioLine = 0;
                
                if (featureInfo && astNodeIds && astNodeIds.length > 0) {
                    const scenarioAstNodeId = astNodeIds[0];
                    const scenario = featureInfo.children.find(child => 
                        child.scenario && child.scenario.id === scenarioAstNodeId
                    );
                    if (scenario) {
                        scenarioLine = scenario.scenario.location.line;
                    }
                }

                const featureName = featureInfo ? featureInfo.name : path.basename(uri, '.feature');
                const featureFile = uri ? path.relative(process.cwd(), uri) : 'unknown';

                this.pickleById.set(id, {
                    name,
                    tags: tags || [],
                    uri,
                    line: scenarioLine,
                    featureName,
                    featureFile
                });
            }
            else if (envelope.stepDefinition) {
                const { id, location } = envelope.stepDefinition;
                if (location && location.uri) {
                    this.stepLocationById.set(id, {
                        file: location.uri,
                        line: location.line || 0
                    });
                }
            }
            else if (envelope.testCaseStarted) {
                this.scenarioCount++;
                const testCaseId = envelope.testCaseStarted.testCaseId;
                this.currentPickleId = this.testCaseToPickleId.get(testCaseId);
                const pickle = this.pickleById.get(this.currentPickleId);
                if (pickle) {
                    this.currentScenario = {
                        id: this.currentPickleId,
                        name: pickle.name,
                        feature: pickle.featureName,
                        file: pickle.featureFile,
                        tags: pickle.tags,
                        steps: [],
                        startTime: new Date()
                    };
                    this.currentTags = pickle.tags.map(tag => tag.name);
                    this.log('\n' + chalk.blueBright.bold(`📋 Scenario (${this.scenarioCount}): ${pickle.name}`));
                    this.log(chalk.gray(this.indent + `Feature: ${pickle.featureName} (${pickle.featureFile}:${pickle.line})`));
                    if (this.currentTags.length > 0) {
                        this.log(chalk.gray(this.indent + `Tags: ${this.currentTags.join(', ')}`));
                    }
                    this.scenarios.set(this.currentPickleId, this.currentScenario);
                }
            }
            else if (envelope.testStepStarted) {
                this.stepCount++;
                const stepId = envelope.testStepStarted.testStepId;
                const stepText = this.stepTextById.get(stepId);
                if (stepText) {
                    this.log(this.indent + chalk.blueBright('[ RUNNING ] ') + stepText);
                }
            }
            else if (envelope.testStepFinished) {
                const { testStepId, testStepResult } = envelope.testStepFinished;
                const stepText = this.stepTextById.get(testStepId);
                if (stepText) {
                    const icon = this.getStatusIcon(testStepResult.status);
                    const duration = testStepResult.duration ? 
                        ` (${(testStepResult.duration.nanos / 1000000).toFixed(2)}ms)` : '';
                    
                    let locationInfo = '';
                    if (testStepResult.status === Status.FAILED) {
                        const pickle = this.pickleById.get(this.currentPickleId);
                        if (pickle) {
                            locationInfo += chalk.gray(`\n${this.indent}    at ${pickle.featureFile}:${pickle.line}`);
                        }

                        const stepLocation = this.stepLocationById.get(testStepId);
                        if (stepLocation && stepLocation.stepDefId) {
                            const defLocation = this.stepLocationById.get(stepLocation.stepDefId);
                            if (defLocation && defLocation.file) {
                                const stepFile = path.relative(process.cwd(), defLocation.file);
                                locationInfo += chalk.gray(`\n${this.indent}    at ${stepFile}:${defLocation.line}`);
                            }
                        }

                        if (testStepResult.message) {
                            this.failureMessageById.set(testStepId, testStepResult.message);
                            locationInfo += chalk.red(`\n${this.indent}    Error: ${testStepResult.message}`);
                        }
                    }
                    
                    this.log(this.indent + icon + ' ' + stepText + chalk.gray(duration) + locationInfo);
                }
                this.stepStatusById.set(testStepId, testStepResult.status);
            }
            else if (envelope.testCaseFinished) {
                const status = Array.from(this.stepStatusById.values()).reduce((final, current) => {
                    if (current === Status.FAILED) return Status.FAILED;
                    if (current === Status.UNDEFINED) return Status.UNDEFINED;
                    if (current === Status.PENDING) return Status.PENDING;
                    if (current === Status.SKIPPED && final !== Status.FAILED) return Status.SKIPPED;
                    return final;
                }, Status.PASSED);

                const pickle = this.pickleById.get(this.currentPickleId);
                this.results.push({
                    name: this.currentScenario.name,
                    status: status,
                    duration: envelope.testCaseFinished.timestamp ? 
                        new Date(envelope.testCaseFinished.timestamp).getTime() - this.startTime : 0,
                    tags: this.currentTags,
                    featureName: pickle ? pickle.featureName : 'Unknown Feature',
                    featureFile: pickle ? pickle.featureFile : 'unknown',
                    line: pickle ? pickle.line : 0
                });

                this.stepStatusById.clear();
                this.log('');
            }
        });
    }

    getStatusIcon(status) {
        switch (status) {
            case Status.PASSED: return chalk.green('✅');
            case Status.FAILED: return chalk.red('❌');
            case Status.PENDING: return chalk.yellow('⏳');
            case Status.SKIPPED: return chalk.gray('⏭️');
            case Status.UNDEFINED: return chalk.red('❓');
            case Status.AMBIGUOUS: return chalk.red('[ AMBIGUOUS ]');
            default: return chalk.gray('•');
        }
    }

    logSummary() {
        const endTime = Date.now();
        const totalDuration = (endTime - this.startTime) / 1000;

        this.log('\n' + chalk.bold('[ TEST SUMMARY ]'));
        this.log('═'.repeat(80));

        this.log(chalk.bold('\n[ STATISTICS ]'));
        this.log(this.indent + `Total Scenarios: ${this.scenarioCount}`);
        this.log(this.indent + `Total Steps: ${this.stepCount}`);
        this.log(this.indent + `Total Duration: ${totalDuration.toFixed(2)}s`);

        const statusCount = this.results.reduce((acc, curr) => {
            acc[curr.status] = (acc[curr.status] || 0) + 1;
            return acc;
        }, {});

        this.log(chalk.bold('\n[ STATUS BREAKDOWN ]'));
        Object.entries(statusCount).forEach(([status, count]) => {
            const icon = this.getStatusIcon(status);
            this.log(this.indent + `${icon}: ${count}`);
        });

        const failedTests = this.results.filter(r => r.status === Status.FAILED);
        if (failedTests.length > 0) {
            this.log(chalk.bold('\n[ FAILED TESTS ]'));
            failedTests.forEach(test => {
                this.log(chalk.red(this.indent + `• ${test.name}`));
                this.log(chalk.gray(this.indent + `  Feature: ${test.featureName} (${test.featureFile}:${test.line})`));
                if (test.tags.length > 0) {
                    this.log(chalk.gray(this.indent + `  Tags: ${test.tags.join(', ')}`));
                }
            });
        }

        this.log('\n' + '═'.repeat(80));
    }

    async finished() {
        return new Promise((resolve) => {
            this.logSummary();
            resolve();
        });
    }

    printSummary() {
        const duration = (Date.now() - this.startTime) / 1000;
        console.log('\n' + '═'.repeat(80));
        console.log('[ TEST SUMMARY ]');
        console.log('═'.repeat(80));
        console.log(`[ STATISTICS ]`);
        console.log(`    Total Scenarios: ${this.scenarioCount}`);
        console.log(`    Total Steps: ${this.stepCount}`);
        console.log(`    Total Duration: ${duration.toFixed(2)}s`);
        console.log('\n[ STATUS BREAKDOWN ]');
        console.log(`    [ PASSED ]: ${this.testResults.passed}`);
        console.log(`    [ FAILED ]: ${this.testResults.failed}`);
        console.log(`    [ SKIPPED ]: ${this.testResults.skipped}`);
        console.log(`    [ UNDEFINED ]: ${this.testResults.undefined}`);

        if (this.testResults.failed > 0) {
            console.log('\n[ FAILED TESTS ]');
            this.failedTests.forEach(test => {
                console.log('\n    • ' + test.name);
                console.log(`      Feature: ${test.feature}`);
                if (test.tags && test.tags.length > 0) {
                    console.log(`      Tags: ${test.tags.join(', ')}`);
                }
                if (test.error) {
                    console.log(`      Error: ${test.error}`);
                }
            });
        }
        console.log('\n' + '═'.repeat(80) + '\n');
    }

    async handleTestCaseStarted(envelope) {
        const id = envelope.testCaseStarted.testCaseId;
        const pickleId = this.testCaseToPickleId.get(id);
        if (!pickleId) return;

        this.currentPickleId = pickleId;
        const pickle = this.pickleById.get(pickleId);
        if (!pickle) return;

        this.currentScenario = {
            id: pickleId,
            name: pickle.name,
            feature: pickle.featureName,
            file: pickle.featureFile,
            tags: pickle.tags,
            steps: [],
            startTime: new Date()
        };

        await this.processAuthLogs();
        await this.processOutput('');
        await this.processOutput('[ SCENARIO ]');
        await this.processOutput(`Name: ${pickle.name}`);
        await this.processOutput(`Feature: ${pickle.featureName}`);
        await this.processOutput(`File: ${pickle.featureFile}`);
        if (pickle.tags.length > 0) {
            await this.processOutput(`Tags: ${pickle.tags.join(', ')}`);
        }
        await this.processOutput('─'.repeat(this.lineWidth));
    }

    async handleTestStepStarted(envelope) {
        if (!this.currentPickleId) return;
        const step = envelope.testStepStarted.testStep;
        this.currentStep = {
            id: step.id,
            text: step.text,
            startTime: new Date()
        };
    }

    async handleTestStepFinished(envelope) {
        if (!this.currentPickleId || !this.currentStep) return;

        const result = envelope.testStepFinished.testStepResult;
        const duration = result.duration ? result.duration.seconds : 0;
        const status = result.status;
        const message = result.message || '';

        this.currentStep.status = status;
        this.currentStep.duration = duration;
        this.currentStep.message = message;
        this.currentScenario.steps.push(this.currentStep);

        if (status === 'FAILED' || status === 'UNDEFINED') {
            await this.processOutput(`[ ${status} ] ${message}`);
        }
    }

    async handleTestCaseFinished(envelope) {
        if (!this.currentPickleId) return;

        const result = envelope.testCaseFinished.testCaseResult;
        const duration = result.duration ? result.duration.seconds : 0;
        const status = result.status;

        this.currentScenario.status = status;
        this.currentScenario.duration = duration;
        this.scenarios.set(this.currentPickleId, this.currentScenario);

        const statusColor = status === 'PASSED' ? chalk.green : status === 'FAILED' ? chalk.red : chalk.yellow;
        await this.processOutput(statusColor(`[ ${status} ] ${this.currentScenario.name}`));
        await this.processOutput('');
    }

    async handleTestRunFinished(envelope) {
        const totalScenarios = this.scenarios.size;
        const totalSteps = Array.from(this.scenarios.values())
            .reduce((sum, scenario) => sum + scenario.steps.length, 0);
        const totalDuration = Array.from(this.scenarios.values())
            .reduce((sum, scenario) => sum + (scenario.duration || 0), 0);

        const statusCounts = {
            PASSED: 0,
            FAILED: 0,
            SKIPPED: 0,
            UNDEFINED: 0
        };

        Array.from(this.scenarios.values()).forEach(scenario => {
            statusCounts[scenario.status]++;
        });

        await this.processOutput('');
        await this.processOutput('═'.repeat(this.lineWidth));
        await this.processOutput('[ TEST SUMMARY ]');
        await this.processOutput('═'.repeat(this.lineWidth));
        await this.processOutput('');
        await this.processOutput(`Total Scenarios: ${totalScenarios}`);
        await this.processOutput('');
        await this.processOutput('Status Breakdown:');
        await this.processOutput(`✅ Passed: ${statusCounts.PASSED}`);
        await this.processOutput(`❌ Failed: ${statusCounts.FAILED}`);
        await this.processOutput(`⏭️ Skipped: ${statusCounts.SKIPPED}`);
        await this.processOutput(`❓ Undefined: ${statusCounts.UNDEFINED}`);
        await this.processOutput('');

        if (statusCounts.FAILED > 0) {
            await this.processOutput('\n[ FAILED TESTS ]');
            const failedScenarios = Array.from(this.scenarios.values()).filter(s => s.status === 'FAILED');
            
            for (let i = 0; i < failedScenarios.length; i++) {
                const scenario = failedScenarios[i];
                await this.processOutput('\n');
                await this.processOutput('• ' + scenario.name + '\n');
                await this.processOutput('  Feature: ' + scenario.feature + '\n');
                await this.processOutput('  File: ' + scenario.file + '\n');
                if (scenario.tags.length > 0) {
                    await this.processOutput('  Tags: ' + scenario.tags.join(', ') + '\n');
                }
            }
        }
        await this.processOutput('\n' + '═'.repeat(80) + '\n');
    }

    async handleGherkinDocument(envelope) {
        const document = envelope.gherkinDocument;
        if (!document.feature) return;

        document.feature.children.forEach(child => {
            if (child.scenario) {
                const scenario = child.scenario;
                this.pickleById.set(scenario.id, {
                    id: scenario.id,
                    name: scenario.name,
                    feature: document.feature.name,
                    file: document.uri,
                    tags: scenario.tags.map(tag => tag.name),
                    steps: scenario.steps.map(step => ({
                        text: step.text,
                        keyword: step.keyword
                    }))
                });
            }
        });
    }

    async handlePickle(envelope) {
        const pickle = envelope.pickle;
        const existingPickle = this.pickleById.get(pickle.id);
        if (existingPickle) {
            existingPickle.steps = pickle.steps.map(step => ({
                text: step.text,
                keyword: step.keyword
            }));
        }
    }

    async handleTestCase(envelope) {
        const testCase = envelope.testCase;
        const id = testCase.id;
        const pickleId = testCase.pickleId;
        this.testCaseToPickleId.set(id, pickleId);
    }

    async processOutput(output) {
        while (this.outputLock) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        this.outputLock = true;
        try {
            process.stdout.write(output + '\n');
        } finally {
            this.outputLock = false;
        }
    }

    async processAuthLogs() {
        while (this.authLogLock) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        this.authLogLock = true;
        try {
            if (this.authLogs.length > 0) {
                await this.processOutput('\n[ AUTH SETUP ]════════════════════════════════════════════════════════════════════════════════');
                for (const log of this.authLogs) {
                    await this.processOutput(log);
                }
                await this.processOutput('════════════════════════════════════════════════════════════════════════════════\n');
                this.authLogs = [];
            }
        } finally {
            this.authLogLock = false;
        }
    }

    async handleLogMessage(envelope) {
        const message = envelope.log.message;
        if (message.includes('Logged in user:') || message.includes('Starting user authentication setup') || message.includes('Completed user authentication setup')) {
            this.authLogs.push(message);
        } else {
            await this.processOutput(message);
        }
    }
}

module.exports = CustomFormatter; 