Feature: error-in-step

  # - Increased timeout b/c this test opens page
  @timeout:10_000
  Scenario: failing by step assertion
    Given failing step

  Scenario: failing by step timeout
    Given Action 0
    Given timeouted step
    When Action 1

  # - If this scenario name changed, snapshot file names should also change
  # - Increased timeout b/c this test opens page
  @timeout:10_000
  Scenario: failing match snapshot
    When open page "https://example.com"
    Then page title snapshot matches the golden one

  Scenario: soft assertions
    Given failing soft assertion "foo"
    And Action 1
    And failing soft assertion "bar"
    And Action 2
