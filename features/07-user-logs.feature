Feature: 7. User Logs
  As an RBAC administrator
  I want to review the audit trail of RBAC changes
  So that I can see who changed what and when

  Background:
    Given I am logged in as RBAC admin
    And I open the "User Logs" module

  Scenario: User logs grid loads with expected columns
    Then I should see "RBAC User Transactions"
    And the grid should have the columns:
      | transaction Id      |
      | activity Start Date |
      | activity End Date   |
      | Screen              |
      | user Activity       |
      | modified By         |
    And I capture a screenshot "user logs grid"

  Scenario: User logs record the role assignment
    When I search for "$ROLE"
    Then the first row should contain "$ROLE"
    And every visible row should contain "$ROLE"
    And I should see "assigned"
    And I capture a screenshot "assignment in user logs"

  Scenario: User logs record the changes made to the test user
    When I search for "$USER"
    Then the first row should contain "$USER"
    And every visible row should contain "$USER"
    And I capture a screenshot "test user changes in user logs"

  Scenario: Search user logs filters by activity
    When I search for "role is created"
    Then every visible row should contain "role is created"
    And I capture a screenshot "user logs filtered"

  Scenario: Search user logs with no match shows empty state
    When I search for "zzz_no_such_log_999"
    Then the grid should show no matching records
    And I capture a screenshot "user logs no match"
