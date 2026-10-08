@users
Feature: 6. Users
  As an RBAC administrator
  I want to find, edit, enable/disable users and assign or unassign roles
  So that I can control what each user can access

  $USER and $USER2 are existing test users. Before and after this feature they are reset:
  re-enabled, any "_PWEDIT" name suffix removed and automation roles unassigned.

  Background:
    Given I am logged in as RBAC admin
    And I open the "Users" module

  # ---------- Search ----------

  Scenario: Users search filters the grid
    Then the grid should have the columns:
      | User Id   |
      | User Name |
      | Email Id  |
      | Role      |
      | Status    |
    When I search for "SUNMP00000791"
    Then the grid should have 1 row
    And the first row should contain "SUNMP00000791"
    And I capture a screenshot "user search match"

  Scenario: Users search with no match shows empty state
    When I search for "zzz_no_such_user_999"
    Then the grid should show no matching records
    And the grid status should contain "Showing 0 to 0 of 0 entries"
    And I capture a screenshot "user search no match"

  # ---------- Edit user name ----------

  Scenario: Edit user first name and restore it
    When I search for "$USER"
    And I click the "edit" icon
    And I remember the value of "Enter first name"
    And I append "_PWEDIT" to "Enter first name"
    And I capture a screenshot "edit user form filled"
    And I submit the form
    Then I should see the popup "User data updated successfully"
    When I search for "$USER"
    Then the first row should contain "$REMEMBERED"
    And the first row should contain "_PWEDIT"
    And I capture a screenshot "user name edited"
    When I click the "edit" icon
    And I enter "$REMEMBERED" in "Enter first name"
    And I submit the form
    Then I should see the popup "User data updated successfully"
    When I search for "$USER"
    Then the first row should not contain "_PWEDIT"
    And I capture a screenshot "user name restored"

  Scenario: Edit user with empty first name is rejected
    When I search for "$USER"
    And I remember the first row
    And I click the "edit" icon
    And I clear "Enter first name"
    And I capture a screenshot "edit user empty first name"
    And I submit the form
    Then I should see the popup "All fields are mandatory"
    When I cancel the form
    And I search for "$USER"
    Then the first row should be unchanged

  Scenario: Edit user first name is limited to 50 characters
    When I search for "$USER"
    And I remember the first row
    And I click the "edit" icon
    And I type 60 characters in "Enter first name"
    Then "Enter first name" should hold at most 50 characters
    And I capture a screenshot "edit user first name max length"
    When I cancel the form
    And I search for "$USER"
    Then the first row should be unchanged

  Scenario: Cancel edit user leaves user unchanged
    When I search for "$USER"
    And I remember the first row
    And I click the "edit" icon
    And I append "_CANCELLED" to "Enter first name"
    And I cancel the form
    And I search for "$USER"
    Then the first row should be unchanged
    And I capture a screenshot "user unchanged after cancelled edit"

  # ---------- Assign / unassign (single user) ----------

  # ---------- Edit user: mobile and email validation, duplicate values ----------
  # Every case is rejected by the app; the form is cancelled and the user row must be unchanged.
  # Duplicates use the values of the second test user ($USER2).

  Scenario Outline: Edit user mobile with <digits> digits is rejected
    When I search for "$USER"
    And I remember the first row
    And I click the "edit" icon
    And I enter "<number>" in "Enter Mobile Number"
    And I capture a screenshot "mobile with <digits> digits"
    And I submit the form
    Then I should see the popup "All fields are mandatory"
    And "Enter Mobile Number" should be marked invalid
    And I capture a screenshot "mobile <digits> digits marked invalid"
    When I cancel the form
    And I search for "$USER"
    Then the first row should be unchanged

    Examples:
      | digits | number    |
      | 1      | 9         |
      | 5      | 98765     |
      | 9      | 987654321 |

  Scenario: Edit user mobile cannot exceed 10 digits
    When I search for "$USER"
    And I click the "edit" icon
    And I type "98765432101234" into "Enter Mobile Number"
    Then "Enter Mobile Number" should hold at most 10 characters
    And I capture a screenshot "mobile stops at 10 digits"
    When I cancel the form

  Scenario: Edit user mobile does not accept letters
    When I search for "$USER"
    And I click the "edit" icon
    And I type "abcdefghij" into "Enter Mobile Number"
    Then "Enter Mobile Number" should only contain digits
    And I capture a screenshot "mobile rejects letters"
    When I cancel the form

  Scenario: Edit user mobile with exactly 10 digits is valid
    # Checked in the form only: the test user's real mobile has 9 digits and could not be restored
    When I search for "$USER"
    And I click the "edit" icon
    And I enter "9123456780" in "Enter Mobile Number"
    Then "Enter Mobile Number" should not be marked invalid
    And I capture a screenshot "mobile with 10 digits is valid"
    When I cancel the form

  Scenario Outline: Edit user with a duplicate <field> is rejected
    When I search for "$USER2"
    And I click the "edit" icon
    And I remember the value of "<placeholder>"
    And I cancel the form
    And I search for "$USER"
    And I remember the first row
    And I click the "edit" icon
    And I enter "$REMEMBERED" in "<placeholder>"
    And I capture a screenshot "duplicate <field> entered"
    And I submit the form
    Then I should see the error popup "already mapped to a different user"
    When I cancel the form
    And I search for "$USER"
    Then the first row should be unchanged

    Examples:
      | field        | placeholder         |
      | mobile       | Enter Mobile Number |
      | email id     | Enter email id      |
      | employee id  | Enter employee id   |

  Scenario Outline: Edit user with <case> email is not submitted
    When I search for "$USER"
    And I remember the first row
    And I click the "edit" icon
    And I enter "<email>" in "Enter email id"
    And I capture a screenshot "<case> email entered"
    And I submit the form
    Then I should see the popup "All fields are mandatory"
    And "Enter email id" should be marked invalid
    And I capture a screenshot "<case> email marked invalid"
    When I cancel the form
    And I search for "$USER"
    Then the first row should be unchanged

    Examples:
      | case           | email        |
      | an empty       |              |
      | a malformed    | not-an-email |

  Scenario: Assign role with empty fields shows mandatory alert
    When I search for "$USER"
    And I open the assign role dialog
    And I capture a screenshot "assign role dialog"
    And I submit the form
    Then I should see the popup "All fields are mandatory"

  Scenario: Assign role with application but no role shows mandatory alert
    When I search for "$USER"
    And I open the assign role dialog
    And I choose "$EXISTING_APP" from the dropdown
    And I submit the form
    Then I should see the popup "All fields are mandatory"

  Scenario: Role list is empty for an application with no roles
    When I search for "$USER"
    And I open the assign role dialog
    And I choose "$EMPTY_APP" from the dropdown
    And I open the role list
    Then the role list should show "No data available"
    And I capture a screenshot "no roles for application"

  Scenario: Cancel assign role leaves user unchanged
    When I search for "$USER"
    And I remember the first row
    And I open the assign role dialog
    And I choose "$EXISTING_APP" from the dropdown
    And I cancel the form
    And I search for "$USER"
    Then the first row should be unchanged
    And I capture a screenshot "user unchanged after cancel"

  Scenario: Assign role to user
    When I search for "$USER"
    Then the first row should contain "$USER"
    And the first row should not contain "$ROLE"
    When I open the assign role dialog
    And I choose "$APP" from the dropdown
    And I select the role "$ROLE"
    And I capture a screenshot "assign role form filled"
    And I submit the form
    Then I should see a success popup
    When I search for "$USER"
    Then the first row should contain "$ROLE"
    And I capture a screenshot "user row with role"

  Scenario: Assigning a second role for the same application is blocked
    # The user already has $ROLE for $APP from the previous scenario
    When I search for "$USER"
    And I open the assign role dialog
    And I choose "$APP" from the dropdown
    Then I should see the popup "Multiple Roles Assignment Not Allowed for the Selected Application"
    When I cancel the form
    And I search for "$USER"
    Then the first row should contain "$ROLE" once
    And I capture a screenshot "role still assigned once"

  Scenario: Unassign with no role ticked keeps the role
    When I search for "$USER"
    And I open the unassign role dialog
    And I submit the form
    Then the dialog should still be open
    And I capture a screenshot "unassign with nothing ticked"
    When I cancel the form
    And I search for "$USER"
    Then the first row should contain "$ROLE"

  Scenario: Unassign role from user
    When I search for "$USER"
    Then the first row should contain "$ROLE"
    When I open the unassign role dialog
    And I tick the role "$ROLE"
    And I capture a screenshot "unassign role form filled"
    And I submit the form
    Then I should see a success popup
    When I search for "$USER"
    Then the first row should not contain "$ROLE"
    And I capture a screenshot "user row without role"

  # ---------- Multi-select with checkboxes ----------

  Scenario: Assign Role button appears only when users are selected
    When I search for "test_06_10"
    Then the "Assign Role" button should not be visible
    When I tick the checkbox for user "$USER"
    And I tick the checkbox for user "$USER2"
    Then the "Assign Role" button should be visible
    And I capture a screenshot "two users selected"
    When I untick the checkbox for user "$USER"
    And I untick the checkbox for user "$USER2"
    Then the "Assign Role" button should not be visible

  Scenario: Bulk assign with no application or role shows mandatory alert
    When I search for "test_06_10"
    And I tick the checkbox for user "$USER"
    And I tick the checkbox for user "$USER2"
    And I click the "Assign Role" button
    And I submit the form
    Then I should see the popup "All fields are mandatory"

  Scenario: Cancel bulk assign leaves users unchanged
    When I search for "test_06_10"
    And I tick the checkbox for user "$USER"
    And I tick the checkbox for user "$USER2"
    And I click the "Assign Role" button
    And I choose "$APP" from the dropdown
    And I cancel the form
    And I search for "test_06_10"
    Then the row for user "$USER" should not contain "$ROLE"
    And the row for user "$USER2" should not contain "$ROLE"
    And I capture a screenshot "users unchanged after cancelled bulk assign"

  Scenario: Bulk assign role to multiple selected users
    When I search for "test_06_10"
    And I tick the checkbox for user "$USER"
    And I tick the checkbox for user "$USER2"
    And I click the "Assign Role" button
    And I choose "$APP" from the dropdown
    And I select the role "$ROLE"
    And I capture a screenshot "bulk assign form filled"
    And I submit the form
    Then I should see a success popup
    When I search for "test_06_10"
    Then the row for user "$USER" should contain "$ROLE"
    And the row for user "$USER2" should contain "$ROLE"
    And I capture a screenshot "both users have the role"

  Scenario: No bulk unassign action exists for selected users
    # Documented gap: with several users ticked only "Assign Role" is offered.
    When I search for "test_06_10"
    And I tick the checkbox for user "$USER"
    And I tick the checkbox for user "$USER2"
    Then the "Assign Role" button should be visible
    And there should be no bulk unassign button
    And I capture a screenshot "no bulk unassign"
    When I untick the checkbox for user "$USER"
    And I untick the checkbox for user "$USER2"

  Scenario: Unassign role from each of the selected users
    When I search for "$USER"
    And I open the unassign role dialog
    And I tick the role "$ROLE"
    And I submit the form
    Then I should see a success popup
    When I search for "$USER2"
    And I open the unassign role dialog
    And I tick the role "$ROLE"
    And I submit the form
    Then I should see a success popup
    When I search for "test_06_10"
    Then the row for user "$USER" should not contain "$ROLE"
    And the row for user "$USER2" should not contain "$ROLE"
    And I capture a screenshot "role removed from both users"

  # ---------- Disable / enable ----------

  Scenario: Cancel disable keeps user active
    When I search for "$USER"
    And I click the "disable" icon
    Then I should see the confirmation "Are you sure you want to disable?"
    When I answer "No"
    And I search for "$USER"
    Then the first row should show status "true"
    And the first row should have the "edit" icon
    And I capture a screenshot "user still active"

  Scenario: Disable user then enable user
    When I search for "$USER"
    And I click the "disable" icon
    Then I should see the confirmation "Are you sure you want to disable?"
    When I answer "Yes"
    Then I should see the popup "User data updated successfully"
    When I search for "$USER"
    Then the first row should show status "false"
    And the first row should have the "enable" icon
    And the first row should not have the "edit" icon
    And I capture a screenshot "user disabled"
    When I click the "enable" icon
    Then I should see the confirmation "Are you sure you want to enable?"
    When I answer "Yes"
    Then I should see the popup "User data updated successfully"
    When I search for "$USER"
    Then the first row should show status "true"
    And the first row should have the "edit" icon
    And I capture a screenshot "user enabled again"
