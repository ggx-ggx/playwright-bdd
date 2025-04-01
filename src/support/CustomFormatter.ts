import { IFormatterOptions } from '@cucumber/cucumber';
import chalk from 'chalk';

// Add interface for pickle tag
interface PickleTag {
    name: string;
    // Add other properties if needed
}

interface TestResult {
    name: string;
    status: string;
    duration: number;
    tags: string[];
}

export default class CustomFormatter {
    private indent = '    ';
    private scenarioCount = 0;
    private stepCount = 0;
    private results: TestResult[] = [];
    private currentScenario: string = '';
    private currentTags: string[] = [];
    private startTime: number = Date.now();

    constructor(options: IFormatterOptions) {
        options.eventBroadcaster.on('test-case-prepared', ({ pickle }) => {
            this.currentScenario = pickle.name;
            this.currentTags = pickle.tags.map((tag: PickleTag) => tag.name);
            console.log('\n' + chalk.blueBright.bold(`📋 Scenario (${++this.scenarioCount}): ${pickle.name}`));
            console.log(chalk.gray(this.indent + `Tags: ${this.currentTags.join(', ')}`));
        });

        options.eventBroadcaster.on('test-step-started', () => {
            this.stepCount++;
        });

        options.eventBroadcaster.on('test-step-finished', ({ testStep, result }) => {
            if (testStep.text) {
                const icon = this.getStatusIcon(result.status);
                const duration = result.duration ? ` (${(result.duration.nanos / 1000000).toFixed(2)}ms)` : '';
                console.log(this.indent + icon + ' ' + testStep.text + chalk.gray(duration));
            }

            if (result.status === 'FAILED') {
                console.log(chalk.red(this.indent + this.indent + result.message));
            }
        });

        options.eventBroadcaster.on('test-case-finished', ({ result }) => {
            this.results.push({
                name: this.currentScenario,
                status: result.status,
                duration: result.duration.nanos / 1000000,
                tags: this.currentTags
            });
        });

        options.eventBroadcaster.on('test-run-finished', () => {
            this.printSummary();
        });
    }

    private getStatusIcon(status: string): string {
        switch (status) {
            case 'PASSED': return chalk.green('✅');
            case 'FAILED': return chalk.red('❌');
            case 'PENDING': return chalk.yellow('⏳');
            case 'SKIPPED': return chalk.gray('⏭️');
            case 'UNDEFINED': return chalk.red('❓');
            default: return chalk.gray('•');
        }
    }

    private printSummary(): void {
        const endTime = Date.now();
        const totalDuration = (endTime - this.startTime) / 1000;

        console.log('\n' + chalk.bold('📊 Test Execution Summary'));
        console.log('═'.repeat(50));

        // Overall Statistics
        console.log(chalk.bold('\n🔍 Overall Statistics:'));
        console.log(this.indent + `Total Scenarios: ${this.scenarioCount}`);
        console.log(this.indent + `Total Steps: ${this.stepCount}`);
        console.log(this.indent + `Total Duration: ${totalDuration.toFixed(2)}s`);

        // Status Breakdown
        const statusCount = this.results.reduce((acc, curr) => {
            acc[curr.status] = (acc[curr.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        console.log(chalk.bold('\n📈 Status Breakdown:'));
        Object.entries(statusCount).forEach(([status, count]) => {
            const icon = this.getStatusIcon(status);
            console.log(this.indent + `${icon} ${status}: ${count}`);
        });

        // Tag Statistics
        const tagStats = new Map<string, { total: number, passed: number }>();
        this.results.forEach(result => {
            result.tags.forEach(tag => {
                if (!tagStats.has(tag)) {
                    tagStats.set(tag, { total: 0, passed: 0 });
                }
                const stats = tagStats.get(tag)!;
                stats.total++;
                if (result.status === 'PASSED') {
                    stats.passed++;
                }
            });
        });

        console.log(chalk.bold('\n🏷️  Tag Statistics:'));
        tagStats.forEach((stats, tag) => {
            const passRate = ((stats.passed / stats.total) * 100).toFixed(1);
            console.log(this.indent + `${tag}: ${stats.passed}/${stats.total} passed (${passRate}%)`);
        });

        // Detailed Results
        console.log(chalk.bold('\n📝 Detailed Results:'));
        this.results.forEach((result, index) => {
            const icon = this.getStatusIcon(result.status);
            console.log(this.indent + `${index + 1}. ${icon} ${result.name}`);
            console.log(this.indent + this.indent + chalk.gray(`Duration: ${result.duration.toFixed(2)}ms`));
            console.log(this.indent + this.indent + chalk.gray(`Tags: ${result.tags.join(', ')}`));
        });

        console.log('\n' + '═'.repeat(50));
    }
} 