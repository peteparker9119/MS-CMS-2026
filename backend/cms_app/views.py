"""
Consolidated view surface for the CMS app.

Views (ViewSets, APIViews and function-based views) are imported (re-exported)
from the existing `apps.*` packages so the consolidated app reuses the exact
behaviour already in production. Nothing is reimplemented here — `urls.py` wires
these under the `api/cms/` prefix.
"""

# accounts
from apps.accounts.views import (
    MeView,
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
    MeetingMembersView,
    DashboardStatsView,
    DashboardMatrixView,
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
from apps.documents.views import DOLetterViewSet, DOComplianceView
# notifications
from apps.notifications.views import NotificationViewSet
# menus
from apps.menus.views import CustomMenuViewSet
# taskboard
from apps.taskboard.views import (
    TaskViewSet,
    TaskAssignmentViewSet,
    TaskBoardUsersView,
)

__all__ = [
    'MeView', 'user_list', 'user_create', 'user_update', 'user_delete',
    'users_by_units',
    'ConvergenceUnitViewSet', 'UnitPairViewSet',
    'MeetingViewSet', 'ActionPointViewSet', 'MeetingMembersView',
    'DashboardStatsView', 'DashboardMatrixView',
    'ItemViewSet',
    'WorkTaskViewSet',
    'KPIDefinitionViewSet', 'KPIEntryViewSet', 'kpi_summary',
    'GanttTaskViewSet',
    'ReviewTemplateViewSet', 'ReviewEntryViewSet', 'reviews_summary',
    'DOLetterViewSet', 'DOComplianceView',
    'NotificationViewSet',
    'CustomMenuViewSet',
    'TaskViewSet', 'TaskAssignmentViewSet', 'TaskBoardUsersView',
]
