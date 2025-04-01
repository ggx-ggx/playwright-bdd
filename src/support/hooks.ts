import { Before, BeforeAll } from '@cucumber/cucumber';
import { UserStore } from '../test_data/users';

const USERS = ['John', 'Alice', 'Bob', 'Carol'] as const;
type Username = typeof USERS[number];

// Properly typed fake authentication tokens
const fakeAuthTokens: Record<Username, string> = {
    'John': 'john-fake-token-123',
    'Alice': 'alice-fake-token-456',
    'Bob': 'bob-fake-token-789',
    'Carol': 'carol-fake-token-012'
};

// Mock login function since we can't access World directly in hooks
async function mockLoginUser(username: Username): Promise<void> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate storing user data
    UserStore.setUser(username, {
        username,
        authToken: fakeAuthTokens[username],
        // Add any other user properties you need
    });
    
    console.log(`Logged in user: ${username}`); // Debug log
}

BeforeAll(async function() {
    console.log('Starting user authentication setup...'); // Debug log
    
    // Login all users before tests start
    for (const username of USERS) {
        // Using mock login instead of this.loginUser
        await mockLoginUser(username);
    }
    
    console.log('Completed user authentication setup'); // Debug log
});

Before(function() {
    // Reset any test-specific state if needed
    console.log('Running before each scenario...'); // Debug log
});
