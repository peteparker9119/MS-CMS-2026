const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SAVE_DIR = 'C:/Users/Peter/AppData/Local/Temp/cms_screenshots';
const BASE_URL = 'http://localhost:5175';

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function navAndWait(page, url, ms = 1200) {
  await page.goto(BASE_URL + url);
  try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch (e) {}
  await wait(ms);
}

async function shot(page, filename) {
  const fpath = path.join(SAVE_DIR, filename);
  await page.screenshot({ path: fpath, fullPage: false });
  console.log('Saved:', fpath);
  return fpath;
}

async function loginAs(page, role /* 'admin' | 'poc' */) {
  await page.goto(BASE_URL + '/login');
  try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch (e) {}
  await wait(600);

  if (role === 'poc') {
    // Click "Unit POC" toggle button
    await page.click('button:has-text("Unit POC")');
    await wait(300);
  }
  // role 'admin' is already selected by default

  // Click Sign in
  await page.click('button[type="submit"]');

  try { await page.waitForURL('**/dashboard**', { timeout: 15000 }); } catch (e) {
    console.log('Dashboard URL wait failed:', e.message);
  }
  try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch (e) {}
  await wait(1200);
}

async function doLogout(page) {
  // Click the user avatar/role div which triggers logout
  try {
    await page.click('.usermenu', { timeout: 5000 });
    await wait(1000);
    try { await page.waitForURL('**/login**', { timeout: 8000 }); } catch (e) {}
    try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch (e) {}
    await wait(600);
  } catch (e) {
    console.log('Logout failed:', e.message);
  }
}

(async () => {
  if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // ─── LOGIN as Admin ───────────────────────────────────────────────────────
  await loginAs(page, 'admin');

  // 01 — Dashboard
  await shot(page, '01_dashboard.png');

  // 02 — Sidebar hover — force show and expand sidebar via JS
  await page.evaluate(() => {
    const s = document.querySelector('.cms-sidebar');
    if (s) {
      // Override all constraints to show expanded sidebar
      s.style.cssText += ';margin-left:0 !important;width:240px !important;transition:none !important;z-index:9999 !important;overflow:visible !important;';
      const labels = s.querySelectorAll('.sidebar-nav-label, .sidebar-brand-text');
      labels.forEach(el => {
        el.style.opacity = '1';
        el.style.width = 'auto';
        el.style.transition = 'none';
        el.style.overflow = 'visible';
      });
    }
    window.scrollTo(0, 0);
  });
  await wait(500);
  await shot(page, '02_sidebar_hover.png');
  // Reset
  await page.evaluate(() => {
    const s = document.querySelector('.cms-sidebar');
    if (s) {
      s.style.cssText = '';
      const labels = s.querySelectorAll('.sidebar-nav-label, .sidebar-brand-text');
      labels.forEach(el => { el.style.cssText = ''; });
    }
  });

  // 03 — Meetings
  await navAndWait(page, '/meetings');
  await shot(page, '03_meetings.png');

  // 04 — Click day "10" on the custom calendar grid
  await navAndWait(page, '/meetings');
  try {
    // Calendar cells have style containing "aspect-ratio"
    const calendarDays = page.locator('[style*="aspect-ratio"]');
    const count = await calendarDays.count();
    console.log('Calendar day cells found:', count);
    let clicked = false;
    for (let i = 0; i < count; i++) {
      const cell = calendarDays.nth(i);
      const numDiv = cell.locator('div').first();
      const txt = await numDiv.textContent();
      if (txt && txt.trim() === '10') {
        await cell.click();
        clicked = true;
        console.log('Clicked day 10');
        break;
      }
    }
    if (!clicked) {
      console.log('Aspect-ratio selector failed, trying grid cell text approach...');
      // Try parent grid approach: find div containing only "10" as first child
      const allCells = page.locator('.mb-3 [style*="aspect-ratio"], .card [style*="aspect-ratio"]');
      const cnt2 = await allCells.count();
      console.log('Card aspect-ratio cells:', cnt2);
      for (let i = 0; i < cnt2; i++) {
        const cell = allCells.nth(i);
        const txt = (await cell.textContent()).trim();
        if (txt.startsWith('10') && txt.length <= 4) {
          await cell.click();
          clicked = true;
          break;
        }
      }
    }
    await wait(800);
  } catch (e) {
    console.log('Day 10 click failed:', e.message);
  }
  await shot(page, '04_meetings_day_click.png');

  // 05 — Schedule modal
  await navAndWait(page, '/meetings');
  try {
    await page.click('button:has-text("+ Schedule")');
    // CModal: wait for modal content
    try {
      await page.waitForSelector('.modal-content', { timeout: 5000 });
    } catch (e) {
      console.log('Modal selector wait failed:', e.message);
    }
    await wait(800);
  } catch (e) {
    console.log('Schedule button failed:', e.message);
  }
  await shot(page, '05_schedule_modal.png');

  // 06 — Planner
  await navAndWait(page, '/planner');
  await shot(page, '06_planner.png');

  // 07 — Minutes
  await navAndWait(page, '/minutes');
  await shot(page, '07_minutes.png');

  // 08 — Worklog
  await navAndWait(page, '/worklog');
  await shot(page, '08_worklog.png');

  // 09 — Worklog new task form
  await navAndWait(page, '/worklog');
  try {
    await page.click('button:has-text("+ New Task")');
    await wait(600);
  } catch (e) {
    console.log('New Task button failed:', e.message);
  }
  await shot(page, '09_worklog_form.png');

  // 09b — Datepicker: click the deadline DateField button (📅 Pick a date)
  try {
    const dateBtn = page.locator('button:has-text("📅")').first();
    await dateBtn.click({ timeout: 5000 });
    try { await page.waitForSelector('.react-datepicker', { timeout: 4000 }); } catch (e) {}
    await wait(600);
  } catch (e) {
    console.log('DateField button click failed:', e.message);
  }
  await shot(page, '09b_datepicker.png');

  // 10 — KPI
  await navAndWait(page, '/kpi');
  await shot(page, '10_kpi.png');

  // 11 — Gantt
  await navAndWait(page, '/gantt');
  await shot(page, '11_gantt.png');

  // 12 — Documents
  await navAndWait(page, '/documents');
  await shot(page, '12_documents.png');

  // 13 — Admin panel
  await navAndWait(page, '/admin-panel');
  await shot(page, '13_admin.png');

  // 14 — Admin panel Units tab
  await navAndWait(page, '/admin-panel');
  try {
    await page.click('button:has-text("Units"), [role="tab"]:has-text("Units")');
    await wait(800);
  } catch (e) {
    console.log('Units tab failed:', e.message);
  }
  await shot(page, '14_admin_units.png');

  // 15 — Notifications bell
  try {
    await page.click('span:has-text("🔔")');
    await wait(800);
  } catch (e) {
    console.log('Bell click failed:', e.message);
    // Try the parent div
    try {
      const bellParent = page.locator('[style*="cursor: pointer"]:has(span:has-text("🔔"))').first();
      await bellParent.click({ timeout: 3000 });
      await wait(800);
    } catch (e2) {
      console.log('Bell parent click also failed:', e2.message);
    }
  }
  await shot(page, '15_notifications.png');

  // ─── LOGOUT ───────────────────────────────────────────────────────────────
  await doLogout(page);

  // ─── LOGIN as POC (VP unit) ───────────────────────────────────────────────
  await loginAs(page, 'poc');

  // 16 — POC dashboard
  await shot(page, '16_poc_dashboard.png');

  // 17 — Sidebar hover as POC (force show and expand)
  await page.evaluate(() => {
    const s = document.querySelector('.cms-sidebar');
    if (s) {
      s.style.cssText += ';margin-left:0 !important;width:240px !important;transition:none !important;z-index:9999 !important;overflow:visible !important;';
      const labels = s.querySelectorAll('.sidebar-nav-label, .sidebar-brand-text');
      labels.forEach(el => { el.style.opacity = '1'; el.style.width = 'auto'; el.style.transition = 'none'; el.style.overflow = 'visible'; });
    }
    window.scrollTo(0, 0);
  });
  await wait(400);
  await shot(page, '17_poc_sidebar.png');

  await browser.close();
  console.log('\nAll screenshots saved to:', SAVE_DIR);
})();
