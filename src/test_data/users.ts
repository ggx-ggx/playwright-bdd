export interface User {
    username: string;
    authToken: string;
    // other user properties
}

export interface UserResponse {
    user: {
        authToken: string;
        name: string;
        age: number;
        user_guid: string;
    }
}

export const UserStore = new class {
    private users: Map<string, User> = new Map();

    setUser(username: string, userData: User) {
        this.users.set(username, userData);
    }

    getUser(username: string): User {
        const user = this.users.get(username);
        if (!user) {
            throw new Error(`User ${username} not found`);
        }
        return user;
    }
}
