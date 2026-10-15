Feature: 2. Application
  As an RBAC administrator
  I want to manage applications
  So that pages and roles can be grouped under them

  $APP created here is used by the Pages, Roles and Users features later in the run.

  Background:
    Given I am logged in as RBAC admin
    And I open the "Application" module

  Scenario: Applications grid loads with expected columns
    Then the grid should have the columns:
      | App Name        |
      | Description     |
      | Mapped Pages    |
      | Mapped Features |
      | Status          |
      | Action          |
    And I should see the "Add Application" button
    And I capture a screenshot "applications grid"

  Scenario: Add application
    When I open the "Add Application" form
    And I enter "$APP" in "Enter app name"
    And I enter "Playwright automation app" in "Enter app description"
    And I capture a screenshot "application form filled"
    And I submit the form
    Then I should see the popup "Application created successfully"
    When I search for "$APP"
    Then the grid should have 1 row
    And the first row should contain "$APP"
    And the first row should contain "Playwright automation app"
    And I capture a screenshot "application in grid"

  Scenario: Edit application is not available
    # Documented gap: applications offer only Delete; there is no edit action or editor on row click.
    When I search for "$APP"
    Then the first row should contain "$APP"
    And the first row should not have the "edit" icon
    And the first row should have the "delete" icon
    When I click on the first row
    Then no dialog should open
    And I capture a screenshot "application has no edit action"

  Scenario: Add duplicate application shows error
    When I open the "Add Application" form
    And I enter "$APP" in "Enter app name"
    And I enter "duplicate" in "Enter app description"
    And I submit the form
    Then I should see the error popup "Specified applicationName already exists: $APP"
    And I capture a screenshot "duplicate application rejected"

  Scenario: Add duplicate application with a trailing space is rejected
    When I open the "Add Application" form
    And I enter "$APP " in "Enter app name"
    And I enter "duplicate with trailing space" in "Enter app description"
    And I submit the form
    Then I should see the error popup "Specified applicationName already exists: $APP"
    When I cancel the form
    And I search for "$APP"
    Then the grid should have 1 row

  Scenario: Duplicate application name in a different letter case is accepted
    # Finding: the duplicate check is case-sensitive. The extra record is deleted right away,
    # by its exact lower-case name, so the original $APP is never touched.
    # A copy left by a failed earlier attempt (e.g. staging failed the delete) is removed first.
    Given I remove leftover letter-case copies of "$APP"
    When I open the "Add Application" form
    And I enter "$APP_LOWER" in "Enter app name"
    And I enter "lower-case duplicate, deleted in this scenario" in "Enter app description"
    And I submit the form
    Then I should see the popup "Application created successfully"
    When I search for "$APP_LOWER"
    Then the grid should have 2 rows
    And I capture a screenshot "lower-case duplicate application created"
    When I click the "delete" icon in the row named exactly "$APP_LOWER"
    Then I should see the confirmation "Are you sure you want to delete application?"
    When I answer "Yes"
    Then I should see the popup "Application deleted successfully"
    When I search for "$APP"
    Then the grid should have 1 row
    And the first row should contain "$APP"
    And I capture a screenshot "only the original application remains"

  Scenario: Add application with empty fields shows required errors
    When I open the "Add Application" form
    And I submit the form
    Then I should see the validation message "app name is required"
    And I should see the validation message "Description is required"
    And I capture a screenshot "empty application validation"

  Scenario: Add application without description shows required error
    When I open the "Add Application" form
    And I enter "$TEMP_APP" in "Enter app name"
    And I submit the form
    Then I should see the validation message "Description is required"
    And I should not see the validation message "app name is required"
    And I capture a screenshot "missing description validation"

  Scenario: Add application without name shows required error
    When I open the "Add Application" form
    And I enter "description only" in "Enter app description"
    And I submit the form
    Then I should see the validation message "app name is required"
    And I should not see the validation message "Description is required"
    And I capture a screenshot "missing name validation"

  Scenario: Cancel add application does not create a record
    When I open the "Add Application" form
    And I enter "$TEMP_APP" in "Enter app name"
    And I enter "should not be saved" in "Enter app description"
    And I cancel the form
    And I search for "$TEMP_APP"
    Then the grid should show no matching records
    And I capture a screenshot "cancelled application not in grid"

  Scenario: Search applications with no match shows empty state
    When I search for "zzz_no_such_app_999"
    Then the grid should show no matching records
    And the grid status should contain "Showing 0 to 0 of 0 entries"
    And I capture a screenshot "application search no match"

  Scenario: Search applications is case-insensitive
    When I search for "indofast test automation app"
    Then the first row should contain "Indofast Test Automation App"
    And I capture a screenshot "application search case-insensitive"

  Scenario: Page size selector limits rows to 50
    When I show 50 entries per page
    Then the grid should show at most 50 rows
    And I capture a screenshot "application page size 50"

  Scenario: Sorting by app name toggles sort order
    When I sort by "App Name"
    And I sort by "App Name"
    Then the sort order should be reversed
    And I capture a screenshot "application sorted"
