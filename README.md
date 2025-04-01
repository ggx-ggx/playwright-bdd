# API Testing Framework with Serenity-JS and Cucumber

This project is a BDD testing framework using Serenity-JS, Cucumber, and TypeScript for API testing.

## Features

- BDD-style test writing with Cucumber
- TypeScript support for type safety
- Serenity-JS for detailed reporting
- User authentication management
- Partial response matching
- Reusable step definitions
- Configurable test environment

## Test Tags Categorization

Our tests use a structured tagging system to organize and run specific test suites. Tags are categorized into different buckets for better organization and execution strategy.

### 1. Test Type Tags
These tags define the nature and scope of the test.

| Tag           | Description                                                               |
|--------------|---------------------------------------------------------------------------|
| @smoke       | Quick tests verifying core functionality and critical paths                |
| @regression  | Comprehensive tests for existing functionality to prevent regressions      |
| @performance | Tests focused on system performance, response times, and load handling     |
| @security    | Tests focusing on security aspects, authentication, and authorization      |
| @integration | Tests verifying integration points between different system components     |
| @critical    | High-priority tests that must pass for any deployment                     |

### 2. Test Status Tags
These tags indicate the test's readiness and reliability.

| Tag          | Description                                                               |
|--------------|---------------------------------------------------------------------------|
| @prod-ready  | Tests verified and stable enough for production environment               |
| @flaky       | Tests that occasionally fail due to known issues or timing                |
| @negative    | Tests verifying system behavior with invalid inputs or error conditions   |

### 3. Feature-Based Organization
Instead of using feature-specific tags (e.g., @user, @admin), we recommend organizing features using directory structure:

```
src/features/
├── user/
│   ├── authentication.feature
│   └── profile.feature
├── admin/
│   ├── user-management.feature
│   └── settings.feature
└── payment/
    ├── checkout.feature
    └── refund.feature
```

This approach provides better organization and allows running feature-specific tests by specifying directories:
```bash
npm test src/features/user/        # Run all user features
npm test src/features/admin/       # Run all admin features
```

## Tag Usage Best Practices

1. **Combining Tags**: Use tag expressions for specific test scenarios:
   - `@smoke and @prod-ready`: Production-ready smoke tests
   - `@regression and not @flaky`: Stable regression tests

2. **Test Organization**:
   - Every test should have at least one test type tag
   - Use `@prod-ready` for tests verified in production
   - Mark unstable tests with `@flaky` for investigation

3. **When to Use Tags vs. Directories**:
   - Use tags for test characteristics (type, status)
   - Use directories for feature organization
   - Combine both for flexible test selection

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd example-test
```

2. Install dependencies:
```bash
npm install
```

## Project Structure 

```
example-test/
├── package.json
├── tsconfig.json
├── cucumber.js
├── src/
│ ├── features/ # Cucumber feature files
│ ├── step_definitions/ # Step implementation
│ ├── support/ # Support files and hooks
│ └── test_data/ # Test data and fixtures
```


