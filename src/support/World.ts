import { setWorldConstructor } from '@cucumber/cucumber';
import axios from 'axios';
import { UserStore, UserResponse } from '../test_data/users';

class CustomWorld {
    constructor() {
        // Initialize your world
    }

    async loginUser(username: string): Promise<void> {
        try {
            const response = await axios.post<UserResponse>('https://dummy.com/login', {
                username: username
            });
            
            UserStore.setUser(username, {
                username,
                authToken: response.data.user.authToken
            });
        } catch (error) {
            throw new Error(`Failed to login user ${username}`);
        }
    }

    // Helper for partial object comparison
    comparePartialObject(actual: any, expected: any): boolean {
        return Object.keys(expected).every(key => {
            if (typeof expected[key] === 'object') {
                return this.comparePartialObject(actual[key], expected[key]);
            }
            return actual[key] === expected[key];
        });
    }
}

setWorldConstructor(CustomWorld);
