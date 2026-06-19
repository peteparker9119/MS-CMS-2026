from django.urls import path, include
from rest_framework.routers import DefaultRouter
from cms.authentication import Auth
from .views import TaskViewSet, TaskAssignmentViewSet, TaskBoardUsersView

router = DefaultRouter()
router.register('taskboard/tasks',       TaskViewSet,           basename='taskboard-tasks')
router.register('taskboard/assignments', TaskAssignmentViewSet, basename='taskboard-assignments')
router.register('taskboard/users',       TaskBoardUsersView,    basename='taskboard-users')

urlpatterns = [
    path('', include(router.urls)),
]
