from django.urls import path, include
from rest_framework.routers import DefaultRouter
from cms.authentication import Auth
from .views import MeetingViewSet, ActionPointViewSet, DashboardStatsView, DashboardMatrixView, MeetingMembersView

router = DefaultRouter()
router.register('meetings', MeetingViewSet, basename='meeting')
router.register('action-points', ActionPointViewSet, basename='action-point')

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('dashboard/matrix/', DashboardMatrixView.as_view(), name='dashboard-matrix'),
    path('meetings/<int:pk>/members/', MeetingMembersView.as_view(), name='meeting-members'),
]
