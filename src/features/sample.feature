@all
Feature: Sample Test States and Tags Demo

  @smoke @critical @prod-ready
  Scenario: Simple passing test
    Given I have valid test data
    When I execute the happy path
    Then the test should pass successfully

  @regression @integration @payment
  Scenario: Test with pending step
    Given I have test data for payment flow
    When I try to process the payment
    Then the payment should be processed
    And this step is not yet implemented

  @smoke @negative @prod-ready
  Scenario: Deliberately failing test
    Given I have invalid test data
    When I execute with invalid data
    Then the test should fail with proper message

  @regression @performance @skip
  Scenario: Skipped test example
    Given I have performance test data
    When the system is under load
    Then response time should be under threshold

  @integration @api @flaky
  Scenario Outline: Parameterized tests with different states
    Given I have user with role "<role>"
    When they access "<resource>"
    Then the access should be "<result>"

    Examples:
      | role    | resource | result  |
      | admin   | reports  | allowed |
      | user    | reports  | denied  |
      | guest   | public   | allowed |

  @security @prod-ready @critical
  Scenario: Test with table data
    Given I have the following user permissions:
      | role    | create | read | update | delete |
      | admin   | yes    | yes  | yes    | yes    |
      | manager | yes    | yes  | yes    | no     |
      | user    | no     | yes  | no     | no     |
    When I verify permission matrix
    Then all permissions should match expected values 