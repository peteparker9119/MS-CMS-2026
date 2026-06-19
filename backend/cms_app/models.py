"""
Consolidated model surface for the CMS app.

Models are NOT redeclared here — they are imported (re-exported) from their
existing `apps.*` packages so there is a single source of truth and no duplicate
tables/migrations. This mirrors the reference pattern where the integration app
reuses models from another app instead of defining its own.
"""

from apps.accounts.models import User
from apps.units.models import ConvergenceUnit, UnitPair
from apps.meetings.models import (
    Meeting,
    MeetingMinutes,
    ActionPoint,
    ActionPointComment,
    ActionPointDeadlineHistory,
    MeetingNotHeld,
    MeetingHistory,
)
from apps.items.models import Item, ItemActionItem, SLAHistory
from apps.worklog.models import WorkTask, WorkEntry, WorkComment
from apps.kpi.models import KPIDefinition, KPIEntry
from apps.gantt.models import GanttTask
from apps.reviews.models import (
    ReviewTemplate,
    ReviewCriterion,
    ReviewEntry,
    ReviewScore,
)
from apps.documents.models import DOLetter, DOLetterCompliance
from apps.notifications.models import Notification
from apps.menus.models import CustomMenu, MenuField, MenuEntry
from apps.taskboard.models import Task, TaskAssignment, TaskActivity

__all__ = [
    'User',
    'ConvergenceUnit', 'UnitPair',
    'Meeting', 'MeetingMinutes', 'ActionPoint', 'ActionPointComment',
    'ActionPointDeadlineHistory', 'MeetingNotHeld', 'MeetingHistory',
    'Item', 'ItemActionItem', 'SLAHistory',
    'WorkTask', 'WorkEntry', 'WorkComment',
    'KPIDefinition', 'KPIEntry',
    'GanttTask',
    'ReviewTemplate', 'ReviewCriterion', 'ReviewEntry', 'ReviewScore',
    'DOLetter', 'DOLetterCompliance',
    'Notification',
    'CustomMenu', 'MenuField', 'MenuEntry',
    'Task', 'TaskAssignment', 'TaskActivity',
]
