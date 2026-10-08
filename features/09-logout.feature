Feature: 9. Logout
  As an RBAC administrator
  I want to sign out of the RBAC portal
  So that my session cannot be reused

  Scenario: Logout returns to login page
    Given I am logged in as RBAC admin
    When I log out
    Then I should be on the login page
    And I capture a screenshot "logged out"
