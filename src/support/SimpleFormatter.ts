import { IFormatterOptions } from '@cucumber/cucumber';

class SimpleFormatter {
    constructor(options: IFormatterOptions) {
        options.eventBroadcaster.on('test-run-finished', () => {
            console.log('\n=== SIMPLE SUMMARY ===');
            console.log('Test run completed!');
            console.log('=====================\n');
        });
    }
}

export = SimpleFormatter; 