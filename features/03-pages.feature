Feature: 3. Pages
  As an RBAC administrator
  I want to manage pages mapped to applications
  So that roles can grant access per page

  Background:
    Given I am logged in as RBAC admin
    And I open the "Pages" module

  Scenario: Pages grid loads with expected columns
    Then the grid should have the columns:
      | Page Name          |
      | Description        |
      | Mapped Application |
      | Status             |
      | Action             |
    And I should see the "Add Page" button
    And I capture a screenshot "pages grid"

  Scenario: Add page mapped to application
    When I open the "Add Page" form
    And I enter "$PAGE" in "Enter page name"
    And I enter "Playwright automation page" in "Enter page description"
    And I choose "$APP" from the dropdown
    And I capture a screenshot "page form filled"
    And I submit the form
    Then I should see the popup "Page created successfully"
    When I search for "$PAGE"
    Then the first row should contain "$PAGE"
    And the first row should contain "$APP"
    And I capture a screenshot "page in grid"

  Scenario: Add a second page mapped to the same application
    When I open the "Add Page" form
    And I enter "$PAGE2" in "Enter page name"
    And I enter "Playwright automation page 2" in "Enter page description"
    And I choose "$APP" from the dropdown
    And I capture a screenshot "second page form filled"
    And I submit the form
    Then I should see the popup "Page created successfully"
    When I search for "$PAGE2"
    Then the first row should contain "$PAGE2"
    And the first row should contain "$APP"
    And I capture a screenshot "second page in grid"

  Scenario: Both pages are listed under the application
    When I search for "$APP"
    Then the grid should have 2 rows
    And every visible row should contain "$APP"
    And I capture a screenshot "application has two pages"

  Scenario: Add page with a duplicate name in the same application is rejected
    When I open the "Add Page" form
    And I enter "$PAGE" in "Enter page name"
    And I enter "duplicate page check" in "Enter page description"
    And I choose "$APP" from the dropdown
    And I capture a screenshot "duplicate page form filled"
    And I submit the form
    Then I should see the message "Invalid PageName provided. Specified PageName already exists: $PAGE"
    When I cancel the form
    And I search for "$PAGE"
    Then the grid should have 1 row
    And I capture a screenshot "only one page with the name"

  Scenario: Add page with empty fields shows mandatory alert
    When I open the "Add Page" form
    And I submit the form
    Then I should see the popup "All fields are mandatory!"

  Scenario: Add page without application shows mandatory alert
    When I open the "Add Page" form
    And I enter "$TEMP_PAGE" in "Enter page name"
    And I enter "no application" in "Enter page description"
    And I submit the form
    Then I should see the popup "All fields are mandatory!"

  Scenario: Cancel add page does not create a record
    When I open the "Add Page" form
    And I enter "$TEMP_PAGE" in "Enter page name"
    And I cancel the form
    And I search for "$TEMP_PAGE"
    Then the grid should show no matching records
    And I capture a screenshot "cancelled page not in grid"

  Scenario: Search pages with no match shows empty state
    When I search for "zzz_no_such_page_999"
    Then the grid should show no matching records
    And the grid status should contain "Showing 0 to 0 of 0 entries"
    And I capture a screenshot "page search no match"
