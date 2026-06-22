"""
Consolidated view surface for the CMS app.

Views (ViewSets, APIViews and function-based views) are imported (re-exported)
from the existing `apps.*` packages so the consolidated app reuses the exact
behaviour already in production. Nothing is reimplemented here — `urls.py` wires
these under the `api/cms/` prefix.
"""

# accounts
from apps.accounts.views import (
    me_view,
    user_list,
    user_create,
    user_update,
    user_delete,
    users_by_units,
)
# units
from apps.units.views import ConvergenceUnitViewSet, UnitPairViewSet
# meetings
from apps.meetings.views import (
    MeetingViewSet,
    ActionPointViewSet,
    meeting_members,
    dashboard_stats,
    dashboard_matrix,
)
# items
from apps.items.views import ItemViewSet
# worklog
from apps.worklog.views import WorkTaskViewSet
# kpi
from apps.kpi.views import KPIDefinitionViewSet, KPIEntryViewSet, kpi_summary
# gantt
from apps.gantt.views import GanttTaskViewSet
# reviews
from apps.reviews.views import (
    ReviewTemplateViewSet,
    ReviewEntryViewSet,
    reviews_summary,
)
# documents
from apps.documents.views import DOLetterViewSet, do_compliance
# notifications
from apps.notifications.views import NotificationViewSet
# menus
from apps.menus.views import CustomMenuViewSet
# taskboard
from apps.taskboard.views import (
    TaskViewSet,
    TaskAssignmentViewSet,
    board_users,
)

__all__ = [
    'me_view', 'user_list', 'user_create', 'user_update', 'user_delete',
    'users_by_units',
    'ConvergenceUnitViewSet', 'UnitPairViewSet',
    'MeetingViewSet', 'ActionPointViewSet', 'meeting_members',
    'dashboard_stats', 'dashboard_matrix',
    'ItemViewSet',
    'WorkTaskViewSet',
    'KPIDefinitionViewSet', 'KPIEntryViewSet', 'kpi_summary',
    'GanttTaskViewSet',
    'ReviewTemplateViewSet', 'ReviewEntryViewSet', 'reviews_summary',
    'DOLetterViewSet', 'do_compliance',
    'NotificationViewSet',
    'CustomMenuViewSet',
    'TaskViewSet', 'TaskAssignmentViewSet', 'board_users',
]
