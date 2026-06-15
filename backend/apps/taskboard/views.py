from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model

from apps.accounts.permissions import IsAdminOrReadOnly
from .models import Task, TaskAssignment, TaskActivity
from .serializers import TaskSerializer, TaskAssignmentSerializer, TaskActivitySerializer

User = get_user_model()


class IsAdminUser(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role in ('admin', 'super_admin')


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    permission_classes = [IsAdminUser]

    def perform_create(self, serializer):
        # Auto-assign order as max+1
        last = Task.objects.order_by('-order').first()
        order = (last.order + 1) if last else 0
        serializer.save(created_by=self.request.user, order=order)


class TaskAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = TaskAssignmentSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = TaskAssignment.objects.select_related(
            'task', 'assigned_to', 'assigned_to__unit',
        ).prefetch_related('activities__created_by')
        task_id = self.request.query_params.get('task')
        user_id = self.request.query_params.get('user')
        if task_id:
            qs = qs.filter(task_id=task_id)
        if user_id:
            qs = qs.filter(assigned_to_id=user_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='activities')
    def add_activity(self, request, pk=None):
        assignment = self.get_object()
        ser = TaskActivitySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        activity = ser.save(assignment=assignment, created_by=request.user)

        # If closing, mark assignment completed
        if activity.activity_type == 'close' and not activity.support_needed:
            assignment.status = TaskAssignment.STATUS_COMPLETED
            assignment.save(update_fields=['status'])

        return Response(TaskActivitySerializer(activity).data, status=201)


class TaskBoardUsersView(viewsets.ViewSet):
    """Return all active users for the task board matrix rows."""
    permission_classes = [IsAdminUser]

    def list(self, request):
        users = User.objects.filter(is_active=True).select_related('unit').order_by('unit__abbr', 'first_name', 'username')
        data = [
            {
                'id':        u.id,
                'name':      u.get_full_name() or u.username,
                'username':  u.username,
                'role':      u.role,
                'unit_id':   u.unit.id   if u.unit else None,
                'unit_abbr': u.unit.abbr if u.unit else '',
                'unit_color':u.unit.color if u.unit else '#6366f1',
            }
            for u in users
        ]
        return Response(data)
