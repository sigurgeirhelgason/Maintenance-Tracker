/**
 * E2E test: Edit Task dialog — vendor Select renders correct value (no MUI out-of-range warning)
 *
 * Bug reproduced: When opening the Edit Task dialog for a task that had a vendor assigned,
 * MUI's Select fired a console warning:
 *   "MUI: You have provided an out-of-range value for the select component."
 * The vendor field displayed as blank / "None" instead of the assigned vendor's name.
 * Root cause: the Select's value was set before the vendor list MenuItem children were
 * mounted (race condition between async vendor fetch and dialog open), causing MUI's child
 * traversal to find no matching option.
 *
 * Fix verified here: the dialog must show the correct vendor name and emit no out-of-range
 * console warning.
 *
 * ---------------------------------------------------------------------------
 * SETUP — Playwright is NOT yet installed in this project.
 * Run the following commands from the `frontend/` directory to install it:
 *
 *   npm install --save-dev @playwright/test
 *   npx playwright install chromium          # installs the browser binary
 *
 * Then create a minimal Playwright config alongside this file:
 *   frontend/playwright.config.js
 *
 *   import { defineConfig } from '@playwright/test';
 *   export default defineConfig({
 *     testDir: './e2e',
 *     use: {
 *       baseURL: 'http://localhost:3000',   // Vite dev server port (vite.config.js)
 *       headless: true,
 *     },
 *   });
 *
 * Run the test (with both servers running):
 *   cd frontend
 *   npx playwright test e2e/editTask.spec.js
 *
 * To run headed (visible browser) for debugging:
 *   npx playwright test e2e/editTask.spec.js --headed
 * ---------------------------------------------------------------------------
 *
 * Credentials: set via environment variables to keep them out of source control.
 *   TEST_USERNAME=<your-email>   (the app's Login form uses an "email" field)
 *   TEST_PASSWORD=<your-password>
 *
 * Example:
 *   TEST_USERNAME=admin@example.com TEST_PASSWORD=secret npx playwright test e2e/editTask.spec.js
 */

// @ts-check
const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Log in via the Login page UI.
 * The Login component renders:
 *   <TextField name="email"    label="Email"    type="email" />
 *   <TextField name="password" label="Password" type="password" />
 *   <Button type="submit">Sign In</Button>
 */
async function loginViaUI(page, username, password) {
  await page.goto('/login');

  // MUI TextFields render an <input> whose `name` attribute matches the prop.
  await page.locator('input[name="email"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  // Wait for redirect away from /login — the app navigates to '/' on success.
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Edit Task dialog — vendor Select', () => {
  let consoleWarnings;

  // Collect every browser console warning/error so we can assert on them later.
  test.beforeEach(async ({ page }) => {
    consoleWarnings = [];

    page.on('console', (msg) => {
      const type = msg.type(); // 'log' | 'warning' | 'error' | 'info' | ...
      if (type === 'warning' || type === 'error') {
        consoleWarnings.push({ type, text: msg.text() });
      }
    });
  });

  test('vendor Select shows the assigned vendor name and emits no out-of-range MUI warning', async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // 1. Authenticate
    // -----------------------------------------------------------------------
    const username = process.env.TEST_USERNAME;
    const password = process.env.TEST_PASSWORD;

    if (!username || !password) {
      test.skip(
        true,
        'TEST_USERNAME and TEST_PASSWORD environment variables are required. ' +
          'Set them before running: TEST_USERNAME=you@example.com TEST_PASSWORD=secret npx playwright test'
      );
    }

    await loginViaUI(page, username, password);

    // -----------------------------------------------------------------------
    // 2. Navigate to the Tasks page
    // -----------------------------------------------------------------------
    await page.goto('/tasks');

    // Wait for the task table to appear (the component renders a <table> once data loads).
    // We accept either the table itself or the "No tasks found." empty-state text.
    const tableOrEmpty = page.locator('table, text=No tasks found.');
    await tableOrEmpty.first().waitFor({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 3. Find a task row that has a vendor assigned
    //
    // The task list is rendered as a <Table>. Each row is a <TableRow>.
    // The vendor column (Tasks.js ~line 950-972) renders task.vendor_details?.name.
    // We look for any table row whose text includes a non-empty vendor cell.
    //
    // Strategy: query the API directly to find a task with a vendor, then use
    // the task description to locate its row in the UI. This is more resilient
    // than trying to parse arbitrary cell positions.
    // -----------------------------------------------------------------------

    // Retrieve tasks via the API using the authenticated browser session (cookies/JWT
    // are already set from the UI login, so axios interceptors in the app will have
    // stored the token in localStorage — we read it back and use fetch here).
    const taskWithVendor = await page.evaluate(async () => {
      // The React app stores the JWT access token in localStorage under the key 'access_token'
      // (confirmed in AuthContext.js — localStorage.setItem('access_token', access)).
      const token =
        localStorage.getItem('access_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('authToken');

      if (!token) return null;

      // Fetch all properties first so we can query tasks per property.
      const propsResp = await fetch('/api/properties/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!propsResp.ok) return null;
      const properties = await propsResp.json();
      if (!properties.length) return null;

      // Iterate over properties looking for a task that has a vendor assigned.
      for (const prop of properties) {
        const tasksResp = await fetch(`/api/tasks/?property=${prop.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!tasksResp.ok) continue;
        const tasks = await tasksResp.json();

        const found = tasks.find(
          (t) =>
            (t.vendor != null && t.vendor !== '') ||
            (t.vendor_details && t.vendor_details.id)
        );
        if (found) {
          return {
            id: found.id,
            description: found.description,
            vendorId: found.vendor ?? found.vendor_details?.id,
            vendorName: found.vendor_details?.name ?? null,
            propertyId: prop.id,
          };
        }
      }

      return null; // No task with vendor found across all properties.
    });

    // -----------------------------------------------------------------------
    // 3a. Skip gracefully if no suitable task exists
    // -----------------------------------------------------------------------
    if (!taskWithVendor) {
      test.skip(
        true,
        'No task with an assigned vendor was found in any property. ' +
          'Create at least one task with a vendor assigned and re-run this test.'
      );
    }

    const { description: taskDescription, vendorName, vendorId } = taskWithVendor;

    // -----------------------------------------------------------------------
    // 4. Make sure the correct property is selected in the property dropdown
    //    so the target task's row is visible in the table.
    //
    // The component auto-selects the first property. If the task lives in a
    // different property we need to switch to it.
    // -----------------------------------------------------------------------

    // The property selector is a MUI Select with label "Property" (Tasks.js renders
    // a property dropdown at the top of the page). We change it via the hidden <select>
    // that MUI renders under the hood, or by clicking the visible combobox.
    // We use the combobox role which MUI Select exposes.
    const propertyCombobox = page.locator('[role="combobox"]').first();
    await propertyCombobox.waitFor({ timeout: 10_000 });

    // Switch property if needed (the page shows a property selector).
    // We locate the property <select> element MUI renders (it has a sibling input with
    // the selected value) and set it to the correct property id.
    await page.evaluate(async (propertyId) => {
      // Dispatch a native change event on the hidden MUI select input for property.
      // MUI's Select renders a <select> element with display:none whose value we can set.
      const selects = Array.from(document.querySelectorAll('select'));
      // The property select should be the first native select on the page.
      if (selects.length > 0) {
        const nativeSelect = selects[0];
        // Programmatically change the value.
        Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(
          nativeSelect,
          String(propertyId)
        );
        nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, taskWithVendor.propertyId);

    // Wait for the task table to re-render after the property change.
    await page.waitForTimeout(1_500);

    // -----------------------------------------------------------------------
    // 5. Locate and click the Edit button for the target task row
    //
    // Tasks are rendered in a <Table>. Each row contains the task description
    // in a TableCell and an edit IconButton (<EditIcon>).
    // We find the row by its description text, then click its edit button.
    // -----------------------------------------------------------------------
    const taskRow = page
      .locator('table tbody tr')
      .filter({ hasText: taskDescription });

    const rowCount = await taskRow.count();
    if (rowCount === 0) {
      // The task exists in the API response but isn't visible — possibly filtered out.
      // Clear the default status filter (which hides 'finished' tasks) by removing filters.
      // For robustness we just fail with a clear message.
      throw new Error(
        `Task with description "${taskDescription}" is not visible in the task table. ` +
          'It may be hidden by the default status filter (pending/in_progress only). ' +
          'Ensure the task has status "pending" or "in_progress" for this test.'
      );
    }

    // Clear any accumulated warnings before clicking Edit (login and navigation
    // can produce unrelated warnings we don't want to fail on).
    consoleWarnings = [];

    // The edit button is the first IconButton in each row (Tasks.js line 975,
    // color="primary"). The delete button is the second (color="error").
    // There is no aria-label on either button, so we rely on position.
    const rowButtons = taskRow.first().locator('button');
    await expect(rowButtons.first()).toBeVisible({ timeout: 5_000 });
    await rowButtons.first().click();

    // -----------------------------------------------------------------------
    // 6. Assert the Edit Task dialog opens
    // -----------------------------------------------------------------------
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // The dialog title is "Edit Task" (Tasks.js line 994).
    await expect(dialog.locator('text=Edit Task')).toBeVisible();

    // -----------------------------------------------------------------------
    // 7. Wait for vendors to load inside the dialog
    //
    // The vendor Select populates after fetchInitialData() completes. The fix
    // ensures the correct MenuItem is present before MUI validates the value.
    // We wait until the Select's displayed text is NOT empty / "None".
    // -----------------------------------------------------------------------

    // The vendor Select (Tasks.js line 1117) is identified by the label "Vendor (Optional)".
    // MUI renders the selected text inside a <span> that is a sibling of the hidden input.
    // The FormControl wrapping it contains an InputLabel with text "Vendor (Optional)".
    const vendorFormControl = dialog.locator('div.MuiFormControl-root').filter({
      has: page.locator('label', { hasText: 'Vendor (Optional)' }),
    });
    await expect(vendorFormControl).toBeVisible({ timeout: 5_000 });

    // The currently displayed value sits in the MUI Select's presentation span.
    const vendorSelectDisplay = vendorFormControl.locator('.MuiSelect-select');
    await expect(vendorSelectDisplay).toBeVisible();

    // Give the async vendor list up to 5 s to load.
    await expect(async () => {
      const displayedText = await vendorSelectDisplay.textContent();
      // The text must not be empty and must not be exactly "None" (the placeholder).
      expect(displayedText).toBeTruthy();
      expect(displayedText.trim()).not.toBe('None');
      expect(displayedText.trim()).not.toBe('');
    }).toPass({ timeout: 5_000, intervals: [300, 500, 800] });

    // -----------------------------------------------------------------------
    // 8. Assert the correct vendor name is shown (if we know it from the API)
    // -----------------------------------------------------------------------
    if (vendorName) {
      const displayedText = await vendorSelectDisplay.textContent();
      expect(displayedText).toContain(vendorName);
    }

    // -----------------------------------------------------------------------
    // 9. Assert the underlying Select input has a non-empty numeric value
    //
    // The MUI Select renders a hidden <input> whose value reflects the selected
    // MenuItem value. For the vendor Select that value is the vendor's numeric id.
    // -----------------------------------------------------------------------
    const vendorHiddenInput = vendorFormControl.locator('input[name="vendor"]');
    const hiddenValue = await vendorHiddenInput.inputValue();
    expect(hiddenValue).toBeTruthy();
    expect(hiddenValue.trim()).not.toBe('');
    // The value should be parseable as a positive integer (the vendor id).
    expect(parseInt(hiddenValue, 10)).toBeGreaterThan(0);

    // -----------------------------------------------------------------------
    // 10. Assert NO MUI out-of-range warning was emitted
    //
    // The bug produced this exact console warning:
    //   "MUI: You have provided an out-of-range value `<id>` for the select component."
    // We assert that no such message appears in the captured console output.
    // -----------------------------------------------------------------------
    const outOfRangeWarnings = consoleWarnings.filter((msg) =>
      msg.text.toLowerCase().includes('out-of-range')
    );

    expect(
      outOfRangeWarnings,
      `Expected no MUI out-of-range Select warnings, but got:\n${outOfRangeWarnings
        .map((w) => `  [${w.type}] ${w.text}`)
        .join('\n')}`
    ).toHaveLength(0);

    // -----------------------------------------------------------------------
    // 11. Close the dialog — no changes made
    // -----------------------------------------------------------------------
    const cancelButton = dialog.locator('button', { hasText: /cancel/i });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
    } else {
      // Fall back to pressing Escape.
      await page.keyboard.press('Escape');
    }

    await expect(dialog).not.toBeVisible({ timeout: 3_000 });
  });

  // ---------------------------------------------------------------------------
  // Bonus: verify that opening Edit on a task WITHOUT a vendor also works fine
  // (the Select should display "None" and no warnings should appear).
  // ---------------------------------------------------------------------------
  test('vendor Select shows "None" and no out-of-range warning for a task without a vendor', async ({
    page,
  }) => {
    const username = process.env.TEST_USERNAME;
    const password = process.env.TEST_PASSWORD;

    if (!username || !password) {
      test.skip(
        true,
        'TEST_USERNAME and TEST_PASSWORD environment variables are required.'
      );
    }

    await loginViaUI(page, username, password);
    await page.goto('/tasks');

    const tableOrEmpty = page.locator('table, text=No tasks found.');
    await tableOrEmpty.first().waitFor({ timeout: 15_000 });

    // Find a task that has NO vendor.
    const taskWithoutVendor = await page.evaluate(async () => {
      const token =
        localStorage.getItem('access_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('authToken');
      if (!token) return null;

      const propsResp = await fetch('/api/properties/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!propsResp.ok) return null;
      const properties = await propsResp.json();
      if (!properties.length) return null;

      for (const prop of properties) {
        const tasksResp = await fetch(`/api/tasks/?property=${prop.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!tasksResp.ok) continue;
        const tasks = await tasksResp.json();

        const found = tasks.find(
          (t) =>
            (t.vendor == null || t.vendor === '') &&
            (!t.vendor_details || !t.vendor_details.id) &&
            (t.status === 'pending' || t.status === 'in_progress')
        );
        if (found) {
          return { description: found.description, propertyId: prop.id };
        }
      }
      return null;
    });

    if (!taskWithoutVendor) {
      test.skip(true, 'No task without a vendor found. Skipping this scenario.');
    }

    // Switch to the correct property if needed.
    await page.evaluate(async (propertyId) => {
      const selects = Array.from(document.querySelectorAll('select'));
      if (selects.length > 0) {
        const nativeSelect = selects[0];
        Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(
          nativeSelect,
          String(propertyId)
        );
        nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, taskWithoutVendor.propertyId);

    await page.waitForTimeout(1_500);

    const taskRow = page
      .locator('table tbody tr')
      .filter({ hasText: taskWithoutVendor.description });

    if ((await taskRow.count()) === 0) {
      test.skip(true, `Task "${taskWithoutVendor.description}" not visible in current view.`);
    }

    // Clear warnings before opening the dialog.
    consoleWarnings = [];

    const rowButtons = taskRow.first().locator('button');
    await rowButtons.first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.locator('text=Edit Task')).toBeVisible();

    const vendorFormControl = dialog.locator('div.MuiFormControl-root').filter({
      has: page.locator('label', { hasText: 'Vendor (Optional)' }),
    });

    const vendorSelectDisplay = vendorFormControl.locator('.MuiSelect-select');
    await expect(vendorSelectDisplay).toBeVisible({ timeout: 5_000 });

    // For a task without a vendor the displayed text should be "None" (the placeholder MenuItem).
    const displayedText = await vendorSelectDisplay.textContent();
    expect(displayedText.trim()).toBe('None');

    // Still no out-of-range warnings.
    const outOfRangeWarnings = consoleWarnings.filter((msg) =>
      msg.text.toLowerCase().includes('out-of-range')
    );
    expect(
      outOfRangeWarnings,
      `Unexpected MUI out-of-range warning:\n${outOfRangeWarnings
        .map((w) => `  [${w.type}] ${w.text}`)
        .join('\n')}`
    ).toHaveLength(0);

    // Close cleanly.
    const cancelButton = dialog.locator('button', { hasText: /cancel/i });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    await expect(dialog).not.toBeVisible({ timeout: 3_000 });
  });
});
