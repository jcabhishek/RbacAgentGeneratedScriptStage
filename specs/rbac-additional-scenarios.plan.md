# RBAC Additional Scenarios Test Plan

## Application Overview

Additional scenarios for the Sun Mobility RBAC Portal (staging), added to the ordered BDD flow (Login -> Application -> Pages -> Features -> Roles -> Users -> User Logs -> Logout). Findings from live exploration: (1) Users have an Edit dialog ("Action: update": First Name* maxlength 50, Last Name* maxlength 20, Employee Type, Employee Id, Mobile, Email, Legal Entity, Department); (2) Users have Disable (red times-circle -> "Are you sure you want to disable?" Yes/No) and disabled users show a green check-circle Enable icon, Status column true/false; (3) ticking user row checkboxes shows an "Assign Role" bulk button that opens the standard assignRole dialog - there is NO bulk unassign button, unassign is per user; (4) Applications have NO edit action (row click does nothing, only Delete); Roles have an Edit dialog (name and app locked; description and page/feature access editable); (5) Roles, Applications, Pages and Features have a "Delete" action (confirmation "Are you sure you want to delete <type>?" Yes/No) which performs a real HTTP DELETE, with a server rule "The last feature linked to Page X cannot be deleted." Test data: records created earlier in the same run ($APP, $PAGE, $FEATURE, $ROLE, plus an extra $FEATURE2/$ROLE2 created for delete tests); test users SUNMF00000630 ($USER) and SUNMF00000629 ($USER2). Every change to a user is reverted in the same scenario (name restored, user re-enabled, roles unassigned).

## Test Scenarios

### 1. 6a. Users - edit user name

**Seed:** `tests/seed.spec.ts`

#### 1.1. Edit user first name and restore it

**File:** `features/06-users.feature`

**Steps:**
  1. Open Users, search $USER, click the Edit (pencil) icon
    - expect: 'Action: update' dialog opens with First Name prefilled
  2. Replace First Name with '<original>_PWEDIT' and Submit
    - expect: Success popup is shown
    - expect: Searching $USER shows the new name in the User Name column
  3. Edit again, restore the original First Name and Submit
    - expect: Success popup
    - expect: User Name column shows the original name

#### 1.2. Edit user with empty first name is rejected

**File:** `features/06-users.feature`

**Steps:**
  1. Open Edit for $USER, clear First Name, Submit
    - expect: A validation message or mandatory-field popup is shown
    - expect: The user's name is unchanged after cancelling

#### 1.3. Edit user first name longer than 50 characters is truncated (edge)

**File:** `features/06-users.feature`

**Steps:**
  1. Open Edit for $USER, type 60 characters into First Name
    - expect: Field holds at most 50 characters (maxlength)
    - expect: Cancel leaves the user unchanged

#### 1.4. Cancel edit user leaves user unchanged

**File:** `features/06-users.feature`

**Steps:**
  1. Open Edit for $USER, change First Name, click Cancel
    - expect: Dialog closes
    - expect: User row is unchanged

### 2. 6b. Users - bulk assign with checkboxes

**Seed:** `tests/seed.spec.ts`

#### 2.1. Assign Role button appears only when users are selected

**File:** `features/06-users.feature`

**Steps:**
  1. Open Users with no rows ticked
    - expect: 'Assign Role' bulk button is not visible
  2. Tick the checkbox of $USER and $USER2
    - expect: 'Assign Role' button is visible
  3. Untick both
    - expect: 'Assign Role' button is hidden again

#### 2.2. Bulk assign role to multiple selected users

**File:** `features/06-users.feature`

**Steps:**
  1. Search 'test_06_10', tick $USER and $USER2, click 'Assign Role', choose $APP and $ROLE, Submit
    - expect: Success popup
    - expect: Both $USER and $USER2 rows show $ROLE in the Role column

#### 2.3. Bulk assign with no app or role selected shows mandatory alert

**File:** `features/06-users.feature`

**Steps:**
  1. Tick $USER and $USER2, click 'Assign Role', Submit empty
    - expect: 'All fields are mandatory' popup
    - expect: No role added to either user

#### 2.4. Cancel bulk assign leaves users unchanged

**File:** `features/06-users.feature`

**Steps:**
  1. Tick two users, open 'Assign Role', choose an app, Cancel
    - expect: Both rows unchanged

### 3. 6c. Users - unassign role from multiple users

**Seed:** `tests/seed.spec.ts`

#### 3.1. No bulk unassign action exists (documented gap)

**File:** `features/06-users.feature`

**Steps:**
  1. Tick $USER and $USER2 who both hold $ROLE
    - expect: Only the 'Assign Role' bulk button is offered; there is no bulk 'Unassign Role' button

#### 3.2. Unassign role from each selected user

**File:** `features/06-users.feature`

**Steps:**
  1. For $USER then $USER2: open the Unassign (unlink) dialog, tick $ROLE, Submit
    - expect: Success popup each time
    - expect: Neither row shows $ROLE afterwards

#### 3.3. Unassign with no role ticked is rejected

**File:** `features/06-users.feature`

**Steps:**
  1. Open Unassign for a user holding a role, Submit without ticking a role
    - expect: Validation popup is shown and the user keeps the role

### 4. 6d. Users - disable and enable

**Seed:** `tests/seed.spec.ts`

#### 4.1. Cancel disable keeps user active

**File:** `features/06-users.feature`

**Steps:**
  1. Search $USER, click the red Disable icon, click 'No' on 'Are you sure you want to disable?'
    - expect: Status stays 'true'
    - expect: Red Disable icon still shown

#### 4.2. Disable user then enable user

**File:** `features/06-users.feature`

**Steps:**
  1. Click Disable for $USER and confirm 'Yes'
    - expect: Success popup
    - expect: Status column shows 'false'
    - expect: Green Enable icon replaces the Edit/Assign/Disable icons
  2. Click the green Enable icon and confirm
    - expect: Success popup
    - expect: Status column shows 'true'
    - expect: Edit/Assign/Disable icons are back

#### 4.3. User logs record the disable and enable

**File:** `features/07-user-logs.feature`

**Steps:**
  1. Search the logs for $USER
    - expect: Entries for the disable and the enable are present

### 5. 2/3/4/5. Delete (disable) role, application, page and feature

**Seed:** `tests/seed.spec.ts`

#### 5.1. Edit application is not available (documented gap)

**File:** `features/02-applications.feature`

**Steps:**
  1. Search $APP in Applications and inspect the Action column; click the row
    - expect: Only the Delete action is present; no edit dialog opens

#### 5.2. Cancel delete keeps the record (each of role, application, page, feature)

**File:** `features/0x-*.feature`

**Steps:**
  1. Click Delete on the record and answer 'No'
    - expect: Record still listed with Status 'true'

#### 5.3. Delete the last feature of a page is blocked

**File:** `features/04-features.feature`

**Steps:**
  1. Delete $FEATURE (the only feature of $PAGE) and confirm 'Yes'
    - expect: Popup 'The last feature linked to Page $PAGE cannot be deleted.'
    - expect: Feature still listed

#### 5.4. Delete role

**File:** `features/08-cleanup.feature`

**Steps:**
  1. After User Logs: delete $ROLE (no longer assigned) and confirm
    - expect: Success popup
    - expect: Searching $ROLE shows no matching records

#### 5.5. Delete page, feature and application (cleanup order)

**File:** `features/08-cleanup.feature`

**Steps:**
  1. Delete $PAGE, then $FEATURE if still present, then $APP, confirming each
    - expect: Success popup for each, or the server's dependency message if a parent still has children
    - expect: Records are no longer listed (or show Status 'false')

#### 5.6. Delete an application that still has pages is blocked or cascades (edge)

**File:** `features/02-applications.feature`

**Steps:**
  1. Try deleting $APP while $PAGE exists
    - expect: Either a dependency error popup, or the app is removed together with its pages - behaviour recorded
