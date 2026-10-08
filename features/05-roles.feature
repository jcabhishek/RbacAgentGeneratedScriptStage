Feature: 5. Roles
  As an RBAC administrator
  I want to manage roles
  So that users can be granted access to applications, pages and features

  Background:
    Given I am logged in as RBAC admin
    And I open the "Roles" module

  Scenario: Roles grid loads with expected columns
    Then the grid should have the columns:
      | Role Name        |
      | Role Description |
      | Application      |
      | Pages            |
      | Features         |
      | Status           |
      | Action           |
    And I should see the "Add Role" button
    And I capture a screenshot "roles grid"

  Scenario: Add role with page and feature access
    When I open the "Add Role" form
    And I enter "$ROLE" in "Enter user role name"
    And I enter "Playwright automation role" in "Enter role description"
    And I choose "$APP" from the dropdown
    And I grant page "$PAGE" with write access to feature "$FEATURE"
    And I grant page "$PAGE2" with write access to feature "$FEATURE2"
    And I capture a screenshot "role form filled"
    And I submit the form
    Then I should see a success popup
    When I search for "$ROLE"
    Then the first row should contain "$ROLE"
    And the first row should contain "$APP"
    And the first row should contain "$PAGE"
    And the first row should contain "$FEATURE"
    And the first row should contain "$PAGE2"
    And the first row should contain "$FEATURE2"
    And I capture a screenshot "role in grid"

  Scenario: Add role with a duplicate name for the same application is rejected
    When I open the "Add Role" form
    And I enter "$ROLE" in "Enter user role name"
    And I enter "duplicate role check" in "Enter role description"
    And I choose "$APP" from the dropdown
    And I grant page "$PAGE" with write access to feature "$FEATURE"
    And I capture a screenshot "duplicate role form filled"
    And I submit the form
    Then I should see the error popup "RoleName mapped to the same application already exists: RoleName: $ROLE"
    When I cancel the form
    And I search for "$ROLE"
    Then the grid should have 1 row
    And I capture a screenshot "only one role with the name"

  Scenario: Add role with empty fields asks for application
    When I open the "Add Role" form
    And I submit the form
    Then I should see the popup "Select application to create role"

  Scenario: Add role without page asks for at least one page
    When I open the "Add Role" form
    And I enter "$TEMP_ROLE" in "Enter user role name"
    And I enter "no page" in "Enter role description"
    And I choose "$EXISTING_APP" from the dropdown
    And I submit the form
    Then I should see the popup "Select atleast one page for the application"

  Scenario: Cancel add role does not create a record
    When I open the "Add Role" form
    And I enter "$TEMP_ROLE" in "Enter user role name"
    And I cancel the form
    And I search for "$TEMP_ROLE"
    Then the grid should show no matching records
    And I capture a screenshot "cancelled role not in grid"

  Scenario: Search roles with no match shows empty state
    When I search for "zzz_no_such_role_999"
    Then the grid should show no matching records
    And the grid status should contain "Showing 0 to 0 of 0 entries"
    And I capture a screenshot "role search no match"
