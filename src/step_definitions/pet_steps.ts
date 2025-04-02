import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { UserStore } from '../test_data/users';
import axios from 'axios';
import expect from 'expect';
import chalk from 'chalk';

let currentResponse: any;
let testMessage: string;

// Helper for logging
const log = {
    info: (msg: string) => console.log(chalk.blueBright('[ INFO  ] ' + msg)),
    success: (msg: string) => console.log(chalk.green('[ PASSED ] ' + msg)),
    warning: (msg: string) => console.log(chalk.yellow('[ WARN  ] ' + msg)),
    error: (msg: string) => console.log(chalk.red('[ ERROR ] ' + msg)),
    debug: (msg: string) => console.log(chalk.gray('[ DEBUG ] ' + msg))
};

Given('{string} is an authenticated user', async (username: string) => {
    const user = UserStore.getUser(username);
    expect(user).toBeDefined();
});

When('(.*) requests pet details for pet ID {string}', async (username: string, petId: string) => {
    const user = UserStore.getUser(username);
    currentResponse = await axios.get(`https://petstore.swagger.io/v2/pet/${petId}`, {
        headers: {
            'Authorization': `Bearer ${user.authToken}`
        }
    });
});

When('{word} creates a new pet with details:', async (username: string, petDetails: string) => {
    const user = UserStore.getUser(username);
    const details = JSON.parse(petDetails);
    
    currentResponse = await axios.post('https://petstore.swagger.io/v2/pet', details, {
        headers: {
            'Authorization': `Bearer ${user.authToken}`,
            'Content-Type': 'application/json'
        }
    });
});

Then('the response should contain pet details', () => {
    expect(currentResponse.data).toBeDefined();
});

Then('the pet details should partially match:', function(expectedDetails: string) {
    const expected = JSON.parse(expectedDetails);
    const comparePartialObject = (actual: any, expected: any): boolean => {
        return Object.keys(expected).every(key => {
            if (typeof expected[key] === 'object' && expected[key] !== null) {
                return comparePartialObject(actual[key], expected[key]);
            }
            return actual[key] === expected[key];
        });
    };
    expect(comparePartialObject(currentResponse.data, expected)).toBeTruthy();
});

Given('I want to verify the test setup', () => {
    log.info('Starting test verification...');
    testMessage = '';
});

When('I run a simple check', async () => {
    log.debug('Running simple check...');
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    testMessage = 'Setup working!';
    log.success('Check completed');
});

Then('it should pass with a message {string}', (expectedMessage: string) => {
    log.debug('Validating test result...');
    expect(testMessage).toBe(expectedMessage);
    log.success(`Test passed with message: ${expectedMessage}`);
});

// Example of a more complex scenario
Given('I have the following pet data:', (dataTable: DataTable) => {
    log.info('Processing pet data...');
    const data = dataTable.hashes();
    log.debug(`Received ${data.length} pets`);
});

When('I create {int} new pets', async (count: number) => {
    log.info(`Creating ${count} new pets...`);
    // Simulate API calls
    for (let i = 1; i <= count; i++) {
        log.debug(`Creating pet ${i}/${count}`);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    log.success(`Created ${count} pets`);
});
