Feature: 4. Features
  As an RBAC administrator
  I want to manage features mapped to pages
  So that roles can grant read or write access per feature

  Background:
    Given I am logged in as RBAC admin
    And I open the "Features" module

  Scenario: Features grid loads with expected columns
    Then the grid should have the columns:
      | Feature Name |
      | Description  |
      | Mapped Pages |
      | Status       |
      | Action       |
    And I should see the "Add Feature" button
    And I capture a screenshot "features grid"

  Scenario: Add feature mapped to page
    When I open the "Add Feature" form
    And I enter "$FEATURE" in "Enter feature name"
    And I enter "Playwright automation feature" in "Enter feature description"
    And I choose "$PAGE" from the dropdown
    And I capture a screenshot "feature form filled"
    And I submit the form
    Then I should see the popup "Feature added successfully"
    When I search for "$FEATURE"
    Then the first row should contain "$FEATURE"
    And the first row should contain "$PAGE"
    And I capture a screenshot "feature in grid"

  Scenario: Add feature mapped to the second page
    When I open the "Add Feature" form
    And I enter "$FEATURE2" in "Enter feature name"
    And I enter "Playwright automation feature 2" in "Enter feature description"
    And I choose "$PAGE2" from the dropdown
    And I capture a screenshot "second feature form filled"
    And I submit the form
    Then I should see the popup "Feature added successfully"
    When I search for "$FEATURE2"
    Then the first row should contain "$FEATURE2"
    And the first row should contain "$PAGE2"
    And I capture a screenshot "second feature in grid"

  Scenario: Cancel delete feature keeps it
    When I search for "$FEATURE2"
    And I click the "delete" icon
    Then I should see the confirmation "Are you sure you want to delete feature?"
    When I answer "No"
    And I search for "$FEATURE2"
    Then the first row should contain "$FEATURE2"
    And the first row should show status "true"
    And I capture a screenshot "feature kept after cancel"

  Scenario: Delete a feature that is not the last on its page
    # Each page keeps one feature, so a temporary extra feature is added to $PAGE and deleted
    When I open the "Add Feature" form
    And I enter "$TEMP_FEATURE" in "Enter feature name"
    And I enter "Temporary feature, deleted in this scenario" in "Enter feature description"
    And I choose "$PAGE" from the dropdown
    And I submit the form
    Then I should see the popup "Feature added successfully"
    When I search for "$TEMP_FEATURE"
    And I click the "delete" icon
    Then I should see the confirmation "Are you sure you want to delete feature?"
    When I answer "Yes"
    Then I should see a success popup
    When I search for "$TEMP_FEATURE"
    Then the grid should show no matching records
    And I capture a screenshot "feature deleted"

  Scenario: Delete the last feature of a page is blocked
    # Guard: $FEATURE must be the only feature on $PAGE; otherwise this delete would really remove it.
    # A temporary feature left by a failed earlier delete is removed first.
    When I remove leftover temporary features from "$PAGE"
    And I search for "$PAGE"
    Then the grid should have 1 row
    And the first row should contain "$FEATURE"
    When I search for "$FEATURE"
    And I click the "delete" icon
    Then I should see the confirmation "Are you sure you want to delete feature?"
    When I answer "Yes"
    Then I should see the message "The last feature linked to Page $PAGE cannot be deleted."
    When I search for "$FEATURE"
    Then the first row should contain "$FEATURE"
    And I capture a screenshot "last feature kept"

  Scenario: Add feature with a duplicate name on the same page is rejected
    When I open the "Add Feature" form
    And I enter "$FEATURE" in "Enter feature name"
    And I enter "duplicate feature check" in "Enter feature description"
    And I choose "$PAGE" from the dropdown
    And I capture a screenshot "duplicate feature form filled"
    And I submit the form
    Then I should see the error popup "Invalid featureName provided. Specified featureName already exists: $FEATURE"
    When I cancel the form
    And I search for "$FEATURE"
    Then the grid should have 1 row
    And I capture a screenshot "only one feature with the name"

  Scenario: Same feature name on a different page is accepted
    # Finding: feature names are only unique per page. Runs after the "last feature" check, and the
    # extra record is deleted right away by its page ($PAGE2), so $FEATURE on $PAGE is never touched.
    When I open the "Add Feature" form
    And I enter "$FEATURE" in "Enter feature name"
    And I enter "duplicate on another page, deleted in this scenario" in "Enter feature description"
    And I choose "$PAGE2" from the dropdown
    And I submit the form
    Then I should see the popup "Feature added successfully"
    When I search for "$FEATURE"
    Then a row should contain "$FEATURE" and "$PAGE2"
    And I capture a screenshot "feature name on two pages"
    When I click the "delete" icon in the row containing "$FEATURE" and "$PAGE2"
    Then I should see the confirmation "Are you sure you want to delete feature?"
    When I answer "Yes"
    Then I should see a success popup
    When I search for "$FEATURE"
    Then the grid should have 1 row
    And the first row should contain "$PAGE"
    And I capture a screenshot "duplicate removed, original kept"

  Scenario: Add feature with empty fields shows mandatory alert
    When I open the "Add Feature" form
    And I submit the form
    Then I should see the popup "All fields are mandatory!"

  Scenario: Add feature without page shows mandatory alert
    When I open the "Add Feature" form
    And I enter "$TEMP_FEATURE" in "Enter feature name"
    And I enter "no page" in "Enter feature description"
    And I submit the form
    Then I should see the popup "All fields are mandatory!"

  Scenario: Cancel add feature does not create a record
    When I open the "Add Feature" form
    And I enter "$TEMP_FEATURE" in "Enter feature name"
    And I cancel the form
    And I search for "$TEMP_FEATURE"
    Then the grid should show no matching records
    And I capture a screenshot "cancelled feature not in grid"

  Scenario: Search features with no match shows empty state
    When I search for "zzz_no_such_feature_999"
    Then the grid should show no matching records
    And the grid status should contain "Showing 0 to 0 of 0 entries"
    And I capture a screenshot "feature search no match"
