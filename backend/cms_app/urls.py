"""
Consolidated URL surface for the CMS app — mounted under `api/cms/`.

Every existing endpoint is re-registered here against the SAME views, so the
consolidated app exposes the full CMS feature set under one prefix without
touching the original `apps.*` routes (which remain mounted under `api/`).

Auth: the project applies `cms.authentication.TNEmisAuth` globally via
REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES'] (it reads the `Authorization`
and `Token` request headers and returns the {dataStatus,status,message}
envelope on failure). That is the CMS equivalent of the reference `Auth` class,
so no per-endpoint authentication_classes are required here.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()

# units
router.register('units', views.ConvergenceUnitViewSet, basename='cms-units')
router.register('pairs', views.UnitPairViewSet, basename='cms-pairs')
# meetings
router.register('meetings', views.MeetingViewSet, basename='cms-meeting')
router.register('action-points', views.ActionPointViewSet, basename='cms-action-point')
# items
router.register('items', views.ItemViewSet, basename='cms-item')
# worklog
router.register('tasks', views.WorkTaskViewSet, basename='cms-worktask')
# kpi
router.register('kpis', views.KPIDefinitionViewSet, basename='cms-kpidefinition')
router.register('kpi-entries', views.KPIEntryViewSet, basename='cms-kpientry')
# gantt
router.register('gantt', views.GanttTaskViewSet, basename='cms-gantttask')
# reviews
router.register('review-templates', views.ReviewTemplateViewSet, basename='cms-reviewtemplate')
router.register('review-entries', views.ReviewEntryViewSet, basename='cms-reviewentry')
# documents
router.register('do-letters', views.DOLetterViewSet, basename='cms-doletter')
# notifications
router.register('notifications', views.NotificationViewSet, basename='cms-notification')
# menus
router.register('custom-menus', views.CustomMenuViewSet, basename='cms-custom-menus')
# taskboard
router.register('taskboard/tasks', views.TaskViewSet, basename='cms-taskboard-tasks')
router.register('taskboard/assignments', views.TaskAssignmentViewSet, basename='cms-taskboard-assignments')
router.register('taskboard/users', views.TaskBoardUsersView, basename='cms-taskboard-users')

# Standalone (non-router) endpoints — declared before the router include so the
# explicit paths take precedence over any router-generated ones.
urlpatterns = [
    # accounts
    path('me/', views.MeView.as_view(), name='cms-auth-me'),
    path('users/', views.user_list, name='cms-user-list'),
    path('users/create/', views.user_create, name='cms-user-create'),
    path('users/<int:pk>/', views.user_update, name='cms-user-update'),
    path('users/<int:pk>/delete/', views.user_delete, name='cms-user-delete'),
    path('users-by-units/', views.users_by_units, name='cms-users-by-units'),
    # meetings extras
    path('dashboard/stats/', views.DashboardStatsView.as_view(), name='cms-dashboard-stats'),
    path('dashboard/matrix/', views.DashboardMatrixView.as_view(), name='cms-dashboard-matrix'),
    path('meetings/<int:pk>/members/', views.MeetingMembersView.as_view(), name='cms-meeting-members'),
    # kpi extras
    path('kpi-summary/', views.kpi_summary, name='cms-kpi-summary'),
    # reviews extras
    path('reviews/summary/', views.reviews_summary, name='cms-reviews-summary'),
    # documents extras
    path('do-compliance/', views.DOComplianceView.as_view(), name='cms-do-compliance'),

    # router-generated CRUD endpoints
    path('', include(router.urls)),
]
