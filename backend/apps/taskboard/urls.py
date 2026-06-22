from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, TaskAssignmentViewSet, board_users

router = DefaultRouter()
router.register('taskboard/tasks',       TaskViewSet,           basename='taskboard-tasks')
router.register('taskboard/assignments', TaskAssignmentViewSet, basename='taskboard-assignments')

urlpatterns = [
    path('', include(router.urls)),
    path('taskboard/users/', board_users, name='taskboard-users'),
]
