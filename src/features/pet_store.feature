Feature: Pet Store API Testing

  Scenario: Simple test to verify framework
    Given I want to verify the test setup
    When I run a simple check
    Then it should pass with a message "Setup working!"

  Scenario: Creating multiple pets
    Given I have the following pet data:
      | name    | type  | status    |
      | Buddy   | Dog   | available |
      | Whiskers| Cat   | pending   |
    When I create 2 new pets
    Then it should pass with a message "Pets created"

  Scenario: Retrieve pet details with authenticated user
    Given "John" is an authenticated user
    When John requests pet details for pet ID "123"
    Then the response should contain pet details
    And the pet details should partially match:
      """
      {
        "name": "Buddy",
        "status": "available"
      }
      """

  Scenario: Create new pet with authenticated user
    Given "Alice" is an authenticated user
    When Alice creates a new pet with details:
      """
      {
        "name": "Max",
        "status": "available",
        "category": {
          "name": "Dogs"
        }
      }
      """
    Then the response status should be 200
    And the created pet should have name "Max"
