Feature: 8. Cleanup - delete role, page and application
  As an RBAC administrator
  I want to delete roles, pages and applications that are no longer needed
  So that unused access definitions do not linger

  Deletes only the records created earlier in this run (both pages, then the application).
  Deleting a page removes its features,
  and deleting an application succeeds even while it still has pages (cascade).

  Background:
    Given I am logged in as RBAC admin

  Scenario Outline: Cancel delete keeps the <type>
    Given I open the "<module>" module
    And I remove leftover letter-case copies of "<record>"
    When I search for "<record>"
    And I click the "delete" icon
    Then I should see the confirmation "<confirmation>"
    When I answer "No"
    And I search for "<record>"
    Then the first row should contain "<record>"
    And the first row should show status "true"
    And I capture a screenshot "<type> kept after cancel"

    Examples:
      | type        | module      | record | confirmation                                |
      | role        | Roles       | $ROLE  | Are you sure you want to Delete Role?       |
      | page        | Pages       | $PAGE  | Are you sure you want to delete page?       |
      | application | Application | $APP   | Are you sure you want to delete application? |

  Scenario: Delete role
    Given I open the "Roles" module
    When I search for "$ROLE"
    And I click the "delete" icon
    Then I should see the confirmation "This role is associated with"
    When I answer "Yes"
    Then I should see the popup "Role deleted successfully"
    When I search for "$ROLE"
    Then the grid should show no matching records
    And I capture a screenshot "role deleted"

  Scenario Outline: Delete <label> also removes its feature
    Given I open the "Pages" module
    When I search for "<page>"
    And I click the "delete" icon
    Then I should see the confirmation "Are you sure you want to delete page?"
    When I answer "Yes"
    Then I should see the popup "Page is deleted successfully"
    When I search for "<page>"
    Then the grid should show no matching records
    And I capture a screenshot "page deleted"
    Given I open the "Features" module
    When I search for "<feature>"
    Then the grid should show no matching records
    And I capture a screenshot "feature removed with page"

    Examples:
      | label  | page   | feature   |
      | page 1 | $PAGE  | $FEATURE  |
      | page 2 | $PAGE2 | $FEATURE2 |

  Scenario: Delete application
    Given I open the "Application" module
    And I remove leftover letter-case copies of "$APP"
    When I search for "$APP"
    And I click the "delete" icon
    Then I should see the confirmation "Are you sure you want to delete application?"
    When I answer "Yes"
    Then I should see the popup "Application deleted successfully"
    When I search for "$APP"
    Then the grid should show no matching records
    And I capture a screenshot "application deleted"
