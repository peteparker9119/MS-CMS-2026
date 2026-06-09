# MS-CMS API Reference

Base URL: `http://localhost:8000/api/`  
All endpoints (except `/auth/login/` and `/auth/refresh/`) require:
```
Authorization: Bearer <access_token>
```

---

## Authentication — `/api/auth/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login/` | Obtain access + refresh tokens |
| POST | `/auth/refresh/` | Refresh access token |
| POST | `/auth/logout/` | Blacklist refresh token |
| GET | `/auth/me/` | Current user profile |
| GET | `/auth/users/` | List all users *(admin)* |
| POST | `/auth/users/create/` | Create user *(admin)* |
| PATCH | `/auth/users/<id>/` | Update user *(admin)* |
| DELETE | `/auth/users/<id>/delete/` | Delete user *(admin)* |
| GET | `/auth/users-by-units/?unit_ids=1,2` | Users filtered by units |

**Login request:**
```json
{ "username": "admin", "password": "Admin@1234" }
```
**Login response includes:** `access`, `refresh`, and full `user` object.

---

## Units — `/api/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/units/` | List all 7 convergence units |
| GET | `/units/<id>/` | Unit detail |
| GET | `/pairs/` | List all 21 unit-pairs |

---

## Meetings — `/api/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/meetings/` | List meetings *(filter: `?unit=vp&status=scheduled`)* |
| POST | `/meetings/` | Schedule a meeting |
| GET | `/meetings/<id>/` | Meeting detail |
| PATCH | `/meetings/<id>/` | Update meeting |
| DELETE | `/meetings/<id>/` | Delete meeting |
| GET | `/meetings/<id>/minutes/` | Get filed minutes |
| POST | `/meetings/<id>/minutes/` | File meeting minutes |
| PATCH | `/meetings/<id>/not-held/` | Record meeting not held |
| GET | `/action-points/` | List action points *(filter: `?meeting=<id>&done=false`)* |
| POST | `/action-points/` | Create action point |
| PATCH | `/action-points/<id>/` | Update / mark done |
| POST | `/action-points/<id>/comments/` | Add comment to action point |
| GET | `/dashboard/stats/` | Dashboard stats *(filter: `?unit=vp&from=2025-01-01&to=2025-12-31`)* |
| GET | `/dashboard/matrix/` | 7×7 convergence matrix |

**Schedule meeting:**
```json
{
  "pair_id": 1,
  "date": "2025-06-15",
  "time": "10:00",
  "mtype": "In-person",
  "agenda": "Review beneficiary data sharing",
  "notify_unit_ids": [1, 2]
}
```

**File minutes:**
```json
{
  "attendees": "6 of 8",
  "summary": "Agreed on data format",
  "action_points": ["VP to share list by Friday", "SMC to validate"],
  "source": "written"
}
```

---

## Item Tracker — `/api/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/items/` | List items *(filter: `?status=pending&unit=vp`)* |
| POST | `/items/` | Create item |
| GET | `/items/<id>/` | Item detail |
| PATCH | `/items/<id>/` | Update item |
| PATCH | `/items/<id>/status/` | Change status (`pending`→`open`→`closed`) |
| POST | `/items/<id>/action-items/` | Add action item |
| PATCH | `/items/<id>/action-items/<aid>/` | Toggle action item done |
| GET | `/items/<id>/sla-history/` | SLA change log |

**Create item:**
```json
{
  "type": "support",
  "title": "School mapping data required",
  "description": "Need updated list from EMIS portal",
  "priority": "High",
  "raiser_id": 1,
  "target_ids": [2, 3]
}
```

**Item types:** `support` `request` `alert` `emergency` `need` `fund` `infra` `school` `student`  
**Priorities:** `Normal` `High` `Critical`  
**Statuses:** `pending` `open` `closed`

---

## D.O. Letters — `/api/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/do-letters/` | List letters *(filter: `?unit=vp&year=2025`)* |
| POST | `/do-letters/` | Upload letter *(multipart/form-data)* |
| GET | `/do-letters/<id>/` | Letter detail |
| DELETE | `/do-letters/<id>/` | Delete letter |

**Upload (multipart):** `title`, `reference_number`, `date`, `file`, `description`, `visible_to_all`

---

## KPI — `/api/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/kpis/` | List KPI definitions *(filter: `?unit=vp&active=true`)* |
| POST | `/kpis/` | Create KPI definition *(admin)* |
| GET | `/kpis/<id>/` | KPI detail with all entries |
| PATCH | `/kpis/<id>/` | Update KPI *(admin)* |
| DELETE | `/kpis/<id>/` | Delete KPI *(admin)* |
| GET | `/kpi-entries/` | List entries *(filter: `?kpi=1&date_from=2025-01-01`)* |
| POST | `/kpi-entries/` | Log a KPI entry |
| GET | `/kpis/<id>/entries/` | Entries for a specific KPI |
| POST | `/kpis/<id>/entries/` | Add entry for a specific KPI |
| GET | `/kpi-summary/` | 30-day compliance summary per user |

**Create KPI entry:**
```json
{ "kpi": 1, "value": 42.5, "date": "2025-06-09", "notes": "June count" }
```

---

## Work Log — `/api/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks/` | List tasks *(filter: `?status=in_progress&unit=vp`)* |
| POST | `/tasks/` | Create task *(admin)* |
| GET | `/tasks/<id>/` | Task detail with entries & comments |
| PATCH | `/tasks/<id>/` | Update task |
| POST | `/tasks/<id>/entries/` | Log work hours |
| POST | `/tasks/<id>/comments/` | Add comment |
| PATCH | `/tasks/<id>/transition/` | Transition status (`todo`→`in_progress`→`done`) |
| GET | `/tasks/summary/` | Per-user hours summary (last 7 days) |

**Log hours:**
```json
{ "description": "Completed data validation", "work_hours": 2.5 }
```

---

## Gantt / Planner — `/api/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/gantt/` | List tasks *(filter: `?academic_year=2025-2026&unit=vp`)* |
| POST | `/gantt/` | Create task |
| GET | `/gantt/<id>/` | Task detail with subtasks |
| PATCH | `/gantt/<id>/` | Update task |
| DELETE | `/gantt/<id>/` | Delete task |
| GET | `/gantt/years/` | Available academic years + current |

**Create Gantt task:**
```json
{
  "title": "School Visit Phase 1",
  "start_date": "2025-06-01",
  "end_date": "2025-06-30",
  "unit_id": 1,
  "progress": 0,
  "milestone": false,
  "academic_year": "2025-2026"
}
```

---

## Reviews — `/api/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/review-templates/` | List templates *(filter: `?unit=vp&active=true`)* |
| POST | `/review-templates/` | Create template *(admin)* |
| GET | `/review-templates/<id>/` | Template detail with criteria |
| PATCH | `/review-templates/<id>/` | Update template *(admin)* |
| GET | `/review-entries/` | List review entries |
| POST | `/review-entries/` | Submit a review |
| GET | `/reviews/summary/` | Average scores per template/unit (90 days) |

**Submit review:**
```json
{
  "template": 1,
  "reviewee_id": 5,
  "date": "2025-06-09",
  "overall_notes": "Good progress this quarter",
  "scores": [
    { "criterion": 1, "score": 8, "notes": "Consistent reporting" },
    { "criterion": 2, "score": 7, "notes": "Minor delays" }
  ]
}
```

---

## Notifications — `/api/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications/` | List user's notifications |
| GET | `/notifications/<id>/` | Notification detail |
| PATCH | `/notifications/<id>/read/` | Mark as read |
| POST | `/notifications/mark-all-read/` | Mark all as read |
| POST | `/notifications/<id>/respond/` | Respond (`accept`/`decline`/`acknowledge`) |

---

## Custom Menus — `/api/`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/custom-menus/` | List active menus |
| POST | `/custom-menus/` | Create menu *(admin)* |
| GET | `/custom-menus/<id>/` | Menu detail with fields |
| PATCH | `/custom-menus/<id>/` | Update menu *(admin)* |
| DELETE | `/custom-menus/<id>/` | Delete menu *(admin)* |
| POST | `/custom-menus/<id>/fields/` | Add field to menu *(admin)* |
| DELETE | `/custom-menus/<id>/fields/<field_id>/` | Remove field *(admin)* |
| GET | `/custom-menus/<id>/entries/` | List form submissions |
| POST | `/custom-menus/<id>/entries/` | Submit form entry |

---

## Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health/` | DB connectivity probe — returns `{"status":"ok"}` |

---

## Database Tables (40 total)

| App | Tables |
|-----|--------|
| accounts | `accounts_user` |
| units | `units_convergenceunit`, `units_unitpair` |
| meetings | `meetings_meeting`, `meetings_meetingminutes`, `meetings_actionpoint`, `meetings_actionpointcomment`, `meetings_meetingnotheld` |
| items | `items_item`, `items_itemactionitem`, `items_slahistory` |
| documents | `documents_doletter` |
| kpi | `kpi_kpidefinition`, `kpi_kpientry` |
| worklog | `worklog_worktask`, `worklog_workentry`, `worklog_workcomment` |
| gantt | `gantt_gantttask` |
| reviews | `reviews_reviewtemplate`, `reviews_reviewcriterion`, `reviews_reviewentry`, `reviews_reviewscore` |
| notifications | `notifications_notification` |
| menus | `menus_custommenu`, `menus_menufield`, `menus_menuentry` |
| Django internals | `auth_*`, `django_*`, `sessions_*`, `token_blacklist_*` |
