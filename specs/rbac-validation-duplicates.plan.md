# RBAC Dashboard - Validation and Duplicate Checks Test Plan

## Application Overview

Additional validation and duplicate-data scenarios for the Sun Mobility RBAC Portal (staging), added to the ordered BDD flow (Login -> Application -> Pages -> Features -> Roles -> Users -> User Logs -> Cleanup -> Logout).

Behaviour observed during live exploration (2026-10-08) on test user SUNMF00000630, using test user SUNMF00000629's values as the duplicates, and on the run's own "Indofast Test Automation ..." records. Every probe change was reverted.

- **Edit user > Mobile** (`Enter Mobile Number`, maxlength 10, digits only): fewer than 10 digits is rejected client-side with the popup "All fields are mandatory" and the field marked invalid (`ng-invalid`). More than 10 digits cannot be typed (the field stops at 10). Letters cannot be typed (the field stays empty).
- **Edit user > Email** (`Enter email id`): empty or a malformed address is rejected client-side with "All fields are mandatory" and the field marked invalid.
- **Duplicates on a user** (mobile, email or employee id of another user): rejected server-side (PATCH 422) with an "Error" popup, "The following values are already mapped to a different user: mobileNumber: ..., emailAddress: ..., userId: ...". The message lists the submitted values, not which one clashed.
- **Duplicate role assignment**: once a user has a role for an application, choosing that application again in Assign Role shows "Warning! Multiple Roles Assignment Not Allowed for the Selected Application." immediately.
- **Duplicate role** (same name, same application): "Error" popup, "RoleName mapped to the same application already exists: RoleName: <name>".
- **Duplicate application**: exact name and name with a trailing space are rejected, "Error" popup, "Invalid applicationName provided. Specified applicationName already exists: <name>". **Finding:** the same name in a different letter case is ACCEPTED (case-sensitive duplicate check).
- **Duplicate page** (same application): popup without a title, "Invalid PageName provided. Specified PageName already exists: <name>".
- **Duplicate feature** (same page): "Error" popup, "Invalid featureName provided. Specified featureName already exists: <name>". **Finding:** the same feature name on a different page is ACCEPTED.

Not automated: saving a new valid 10-digit mobile. Test user SUNMF00000630's real mobile has only 9 digits (786390018) and the form rejects 9 digits once the field is edited, so the original value could not be restored. The positive case checks that a 10-digit value is valid in the form and then cancels.

Data safety: user edits are always cancelled (or rejected by the app), and each user scenario checks the user row is unchanged afterwards. Records accepted by a "finding" scenario are deleted in the same scenario, using the exact row (name + page / exact case), never the first search result.

## Test Scenarios

### 1. Users - edit validation (06-users.feature, @users)

**Seed:** `tests/seed.spec.ts`

#### 1.1. Edit user mobile with fewer than 10 digits is rejected (negative, Scenario Outline: 1, 5, 9 digits)

**File:** `features/06-users.feature`

**Steps:**
  1. Search for $USER, remember the first row, click the edit icon
  2. Enter the short number in "Enter Mobile Number"; capture a screenshot
  3. Submit the form
    - expect: popup "All fields are mandatory" (screenshot taken on the popup)
    - expect: "Enter Mobile Number" is marked invalid
  4. Cancel the form, search for $USER
    - expect: the first row is unchanged

#### 1.2. Edit user mobile cannot exceed 10 digits (edge)

**Steps:**
  1. Search for $USER, click the edit icon
  2. Type "98765432101234" (14 digits) into "Enter Mobile Number"; capture a screenshot
    - expect: "Enter Mobile Number" holds at most 10 characters
  3. Cancel the form

#### 1.3. Edit user mobile does not accept letters (negative)

**Steps:**
  1. Search for $USER, click the edit icon
  2. Type "abcdefghij" into "Enter Mobile Number"; capture a screenshot
    - expect: "Enter Mobile Number" contains only digits
  3. Cancel the form

#### 1.4. Edit user mobile with exactly 10 digits is valid (positive, not saved)

**Steps:**
  1. Search for $USER, click the edit icon
  2. Enter "9123456780" in "Enter Mobile Number"; capture a screenshot
    - expect: "Enter Mobile Number" is not marked invalid
  3. Cancel the form (not saved, see overview)

#### 1.5. Edit user with a duplicate mobile number is rejected (negative)

**Steps:**
  1. Search for $USER2, click the edit icon, remember the value of "Enter Mobile Number", cancel
  2. Search for $USER, remember the first row, click the edit icon
  3. Enter the remembered mobile; capture a screenshot; submit
    - expect: "Error" popup containing "already mapped to a different user" (screenshot)
  4. Cancel the form, search for $USER
    - expect: the first row is unchanged

#### 1.6. Edit user with empty email is not submitted (negative)

**Steps:**
  1. Search for $USER, remember the first row, click the edit icon
  2. Clear "Enter email id"; capture a screenshot; submit
    - expect: popup "All fields are mandatory"; "Enter email id" is marked invalid
  3. Cancel, search for $USER
    - expect: the first row is unchanged

#### 1.7. Edit user with an invalid email format is rejected (negative)

**Steps:**
  1. As 1.6, entering "not-an-email"
    - expect: popup "All fields are mandatory"; "Enter email id" is marked invalid; row unchanged

#### 1.8. Edit user with a duplicate email id is rejected (negative)

**Steps:**
  1. Remember $USER2's "Enter email id", then enter it for $USER and submit
    - expect: "Error" popup containing "already mapped to a different user"; row unchanged

#### 1.9. Edit user with a duplicate employee id is rejected (negative)

**Steps:**
  1. Remember $USER2's "Enter employee id", then enter it for $USER and submit
    - expect: "Error" popup containing "already mapped to a different user"; row unchanged

#### 1.10. Assigning a role for an application the user already has a role for is blocked (negative)

Runs after "Assign role to user" (the user has $ROLE) and before "Unassign role from user".

**Steps:**
  1. Search for $USER, open the assign role dialog, choose $APP
    - expect: popup "Warning! Multiple Roles Assignment Not Allowed for the Selected Application." (screenshot)
  2. Cancel the dialog, search for $USER
    - expect: the first row contains $ROLE exactly once

### 2. Roles (05-roles.feature)

#### 2.1. Add role with a duplicate name for the same application is rejected (negative)

**Steps:**
  1. Open "Add Role", enter $ROLE, a description, choose $APP, grant $PAGE / $FEATURE; submit
    - expect: "Error" popup "RoleName mapped to the same application already exists: RoleName: $ROLE"
  2. Cancel the form, search for $ROLE
    - expect: the grid has 1 row

### 3. Application (02-applications.feature)

#### 3.1. Add duplicate application shows error (existing scenario, kept)

#### 3.2. Add duplicate application with a trailing space is rejected (edge)

**Steps:**
  1. Open "Add Application", enter "$APP " (trailing space) and a description; submit
    - expect: "Error" popup "Specified applicationName already exists: $APP"
  2. Cancel the form

#### 3.3. Duplicate application name in a different letter case is accepted (finding)

**Steps:**
  1. Open "Add Application", enter $APP in lower case and a description; submit
    - expect: popup "Application created successfully" (documents the missing case-insensitive check)
  2. Delete the row whose name is exactly the lower-case name (confirm "Yes")
    - expect: popup "Application deleted successfully"
  3. Search for $APP
    - expect: only the original $APP remains (1 row)

### 4. Pages (03-pages.feature)

#### 4.1. Add page with a duplicate name in the same application is rejected (negative)

**Steps:**
  1. Open "Add Page", enter $PAGE, a description, choose $APP; submit
    - expect: message "Invalid PageName provided. Specified PageName already exists: $PAGE"
  2. Cancel the form, search for $PAGE
    - expect: the grid has 1 row

### 5. Features (04-features.feature)

#### 5.1. Add feature with a duplicate name on the same page is rejected (negative)

**Steps:**
  1. Open "Add Feature", enter $FEATURE, a description, choose $PAGE; submit
    - expect: "Error" popup "Invalid featureName provided. Specified featureName already exists: $FEATURE"
  2. Cancel the form, search for $FEATURE
    - expect: the grid has 1 row

#### 5.2. Same feature name on a different page is accepted (finding)

Runs after "Delete the last feature of a page is blocked", because the extra row would otherwise match that scenario's page search.

**Steps:**
  1. Open "Add Feature", enter $FEATURE, a description, choose $PAGE2; submit
    - expect: popup "Feature added successfully" (documents that feature names are only unique per page)
  2. Delete the row containing both $FEATURE and $PAGE2 (confirm "Yes")
    - expect: a success popup
  3. Search for $FEATURE
    - expect: 1 row, mapped to $PAGE
