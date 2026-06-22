from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MeetingViewSet, ActionPointViewSet, dashboard_stats, dashboard_matrix, meeting_members

router = DefaultRouter()
router.register('meetings', MeetingViewSet, basename='meeting')
router.register('action-points', ActionPointViewSet, basename='action-point')

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/stats/', dashboard_stats, name='dashboard-stats'),
    path('dashboard/matrix/', dashboard_matrix, name='dashboard-matrix'),
    path('meetings/<int:pk>/members/', meeting_members, name='meeting-members'),
]
