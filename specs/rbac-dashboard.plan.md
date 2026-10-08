# RBAC Dashboard Test Plan

## Application Overview

Sun Mobility RBAC Portal (Angular SPA, Firebase auth) at https://sm-rbac-dashboard-staging.azurewebsites.net/. After login the app redirects to /home, which shows a sidebar (Users, Roles, Applications, Pages, Features, Logs), an "RBAC Admin" profile menu with a Logout link, and a Welcome image. The Users module (/home/rbac-users) is a DataTables grid (~958 users) with a live Search box, a "Show entries" page-size selector, sortable columns and paging. Notes: deep-linking to /home returns a server 404 (SPA fallback not configured), so tests must navigate from the root URL; an empty login submit shows no message and stays on the login page. All tests are read-only (no user creation/edit/delete) and run serially in one worker.

## Test Scenarios

### 1. RBAC Dashboard

**Seed:** `tests/seed.spec.ts`

#### 1.1. login with valid credentials lands on dashboard

**File:** `tests/rbac/login-valid.spec.js`

**Steps:**
  1. Navigate to https://sm-rbac-dashboard-staging.azurewebsites.net/
    - expect: The "Login" heading is visible
    - expect: "Enter Email ID" and "Enter Password" textboxes and the "LOGIN" button are visible
  2. Fill "Enter Email ID" with softwaredco@sunmobility.com and "Enter Password" with the valid password, then click "LOGIN"
    - expect: URL changes to /home
    - expect: The "RBAC Admin" profile name is visible in the header
    - expect: The "Welcome" image is visible
    - expect: The sidebar "Users" link is visible

#### 1.2. login with invalid password shows error

**File:** `tests/rbac/login-invalid-password.spec.js`

**Steps:**
  1. Navigate to the login page
    - expect: The "Login" heading is visible
  2. Fill email with softwaredco@sunmobility.com and password with "WrongPass@000", then click "LOGIN"
    - expect: Text "Invalid password. please enter correct password." is visible
    - expect: URL stays at the root (not /home)

#### 1.3. login with empty fields stays on login page

**File:** `tests/rbac/login-empty-fields.spec.js`

**Steps:**
  1. Navigate to the login page and click "LOGIN" without entering anything
    - expect: URL stays at the root (not /home)
    - expect: The "Login" heading and both textboxes are still visible

#### 1.4. users module search filters the grid

**File:** `tests/rbac/users-search.spec.js`

**Steps:**
  1. Log in with valid credentials
    - expect: URL is /home
  2. Click the sidebar "Users" link
    - expect: URL is /home/rbac-users
    - expect: The grid with column headers "User Id", "User Name", "Email Id", "Role", "Status" is visible
    - expect: The status text matches "Showing 1 to N of N entries"
  3. Type "SUNMP00000791" in the "Search:" box
    - expect: Exactly one data row is shown
    - expect: That row contains "SUNMP00000791"

#### 1.5. users module search with no match shows empty state

**File:** `tests/rbac/users-search-no-match.spec.js`

**Steps:**
  1. Log in and click the sidebar "Users" link
    - expect: URL is /home/rbac-users
  2. Type "zzz_no_such_user_999" in the "Search:" box
    - expect: Grid shows "No matching records found"
    - expect: Status text contains "Showing 0 to 0 of 0 entries"

#### 1.6. logout returns to login page

**File:** `tests/rbac/logout.spec.js`

**Steps:**
  1. Log in with valid credentials
    - expect: URL is /home
  2. Open the profile menu next to "RBAC Admin" and click the link titled "Logout"
    - expect: URL returns to the root
    - expect: The "Login" heading and the "LOGIN" button are visible
