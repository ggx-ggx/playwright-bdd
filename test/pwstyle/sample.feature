Feature: Playwright style bdd

    Scenario: Check fixtures
      Given state with fixtures - arrow fn
      Given state without fixtures - arrow fn
      Given state with fixtures - function
      Given state without fixtures - function
      When action 1
      Then result with fixtures and arg equals to "bar" - function
      Then result with fixtures and arg equals to "bar" - arrow fn
