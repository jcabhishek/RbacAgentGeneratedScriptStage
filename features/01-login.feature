Feature: 1. Login
  As an RBAC administrator
  I want to sign in to the RBAC portal
  So that only authorised users can manage access

  Scenario: Login with valid credentials lands on dashboard
    Given I am on the login page
    When I log in with valid admin credentials
    Then I should be on the dashboard
    And I should see "RBAC Admin"
    And I capture a screenshot "dashboard"

  Scenario: Login with invalid password shows error
    Given I am on the login page
    When I log in with email "$EMAIL" and password "WrongPass@000"
    Then I should see "Invalid password. please enter correct password."
    And I should be on the login page
    And I capture a screenshot "invalid password error"

  Scenario: Login with empty fields stays on login page
    Given I am on the login page
    When I click LOGIN
    Then I should be on the login page
    And I capture a screenshot "empty login"
