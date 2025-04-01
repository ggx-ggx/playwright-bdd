import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import chalk from 'chalk';
import expect from 'expect';

interface Permission {
    role: string;
    create: string;
    read: string;
    update: string;
    delete: string;
}

const log = {
    info: (msg: string) => console.log(chalk.blueBright('[ INFO  ] ' + msg)),
    success: (msg: string) => console.log(chalk.green('[ PASSED ] ' + msg)),
    warning: (msg: string) => console.log(chalk.yellow('[ WARN  ] ' + msg)),
    error: (msg: string) => console.log(chalk.red('[ ERROR ] ' + msg)),
    debug: (msg: string) => console.log(chalk.gray('[ DEBUG ] ' + msg))
};

// Passing test steps
Given('I have valid test data', function() {
    log.info('Setting up valid test data');
});

When('I execute the happy path', function() {
    log.success('Executing happy path');
});

Then('the test should pass successfully', function() {
    log.success('Test passed as expected');
    expect(true).toBe(true);
});

// Pending test steps
Given('I have test data for payment flow', function() {
    log.info('Setting up payment test data');
});

When('I try to process the payment', function() {
    log.debug('Processing payment...');
});

Then('the payment should be processed', function() {
    // This step will be implemented
    log.warning('Payment verification pending');
});

// Failing test steps
Given('I have invalid test data', function() {
    log.warning('Setting up invalid test data');
});

When('I execute with invalid data', function() {
    log.error('Executing with invalid data');
});

Then('the test should fail with proper message', function() {
    log.error('Test failed as expected');
    expect(false).toBe(true); // Deliberate failure
});

// Skipped test steps
Given('I have performance test data', function() {
    // These steps will be skipped due to @skip tag
    return 'skipped';
});

When('the system is under load', function() {
    return 'skipped';
});

Then('response time should be under threshold', function() {
    return 'skipped';
});

// Parameterized test steps
Given('I have user with role {string}', function(role: string) {
    log.info(`Setting up user with role: ${role}`);
});

When('they access {string}', function(resource: string) {
    log.debug(`Accessing resource: ${resource}`);
});

Then('the access should be {string}', function(result: string) {
    log.info(`Verifying access is: ${result}`);
    if (result === 'denied') {
        expect(true).toBe(true);
    }
});

// Table data test steps
Given('I have the following user permissions:', function(dataTable: DataTable) {
    log.info('Processing permission matrix');
    const rawPermissions = dataTable.hashes();
    const permissions = rawPermissions.map(row => ({
        role: row.role,
        create: row.create,
        read: row.read,
        update: row.update,
        delete: row.delete
    })) as Permission[];
    
    log.debug(`Loaded ${permissions.length} role permissions`);
    
    // Store the permissions in the world object
    this.permissions = permissions;
});

When('I verify permission matrix', function() {
    log.debug('Verifying permissions...');
    // No need to store anything here
});

Then('all permissions should match expected values', function() {
    const permissions = this.permissions as Permission[];
    
    // Verify admin permissions
    const adminPermissions = permissions.find((p: Permission) => p.role === 'admin');
    expect(adminPermissions?.create).toBe('yes');
    expect(adminPermissions?.read).toBe('yes');
    expect(adminPermissions?.update).toBe('yes');
    expect(adminPermissions?.delete).toBe('yes');
    
    // Verify manager permissions
    const managerPermissions = permissions.find((p: Permission) => p.role === 'manager');
    expect(managerPermissions?.create).toBe('yes');
    expect(managerPermissions?.read).toBe('yes');
    expect(managerPermissions?.update).toBe('yes');
    expect(managerPermissions?.delete).toBe('no');
    
    // Verify user permissions
    const userPermissions = permissions.find((p: Permission) => p.role === 'user');
    expect(userPermissions?.create).toBe('no');
    expect(userPermissions?.read).toBe('yes');
    expect(userPermissions?.update).toBe('no');
    expect(userPermissions?.delete).toBe('no');
    
    log.success('Permissions verified successfully');
});

// Add the missing step definition
Then('this step is not yet implemented', async function() {
    log.warning('Step marked as pending');
    return 'pending';
}); 