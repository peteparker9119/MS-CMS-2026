"""
Consolidated serializer surface for the CMS app.

Serializers are imported (re-exported) from the existing `apps.*` packages so
the consolidated app reuses the exact validation/representation logic already in
production. No serializer is redeclared here.
"""

from apps.accounts.serializers import (
    UserSerializer,
    AdminUserSerializer,
    AdminUserCreateSerializer,
)
from apps.units.serializers import (
    ConvergenceUnitSerializer,
    UnitPairSerializer,
)
from apps.meetings.serializers import (
    ActionPointCommentSerializer,
    ActionPointDeadlineHistorySerializer,
    ActionPointSerializer,
    MeetingHistorySerializer,
    MeetingNotHeldSerializer,
    MeetingMinutesSerializer,
    MeetingListSerializer,
)
from apps.items.serializers import (
    ItemActionItemSerializer,
    SLAHistorySerializer,
    ItemSerializer,
)
from apps.worklog.serializers import (
    WorkCommentSerializer,
    WorkEntrySerializer,
    WorkTaskListSerializer,
    WorkTaskDetailSerializer,
)
from apps.kpi.serializers import (
    KPIEntrySerializer,
    KPIDefinitionSerializer,
    KPIDefinitionDetailSerializer,
)
from apps.gantt.serializers import GanttTaskSerializer
from apps.reviews.serializers import (
    ReviewCriterionSerializer,
    ReviewScoreSerializer,
    ReviewTemplateSerializer,
    ReviewEntrySerializer,
)
from apps.documents.serializers import DOLetterSerializer
from apps.notifications.serializers import NotificationSerializer
from apps.menus.serializers import (
    MenuFieldSerializer,
    CustomMenuSerializer,
    CustomMenuWriteSerializer,
    MenuEntrySerializer,
)
from apps.taskboard.serializers import (
    TaskActivitySerializer,
    TaskAssignmentSerializer,
    TaskSerializer,
)

__all__ = [
    'UserSerializer', 'AdminUserSerializer', 'AdminUserCreateSerializer',
    'ConvergenceUnitSerializer', 'UnitPairSerializer',
    'ActionPointCommentSerializer', 'ActionPointDeadlineHistorySerializer',
    'ActionPointSerializer', 'MeetingHistorySerializer',
    'MeetingNotHeldSerializer', 'MeetingMinutesSerializer', 'MeetingListSerializer',
    'ItemActionItemSerializer', 'SLAHistorySerializer', 'ItemSerializer',
    'WorkCommentSerializer', 'WorkEntrySerializer', 'WorkTaskListSerializer',
    'WorkTaskDetailSerializer',
    'KPIEntrySerializer', 'KPIDefinitionSerializer', 'KPIDefinitionDetailSerializer',
    'GanttTaskSerializer',
    'ReviewCriterionSerializer', 'ReviewScoreSerializer',
    'ReviewTemplateSerializer', 'ReviewEntrySerializer',
    'DOLetterSerializer',
    'NotificationSerializer',
    'MenuFieldSerializer', 'CustomMenuSerializer', 'CustomMenuWriteSerializer',
    'MenuEntrySerializer',
    'TaskActivitySerializer', 'TaskAssignmentSerializer', 'TaskSerializer',
]
