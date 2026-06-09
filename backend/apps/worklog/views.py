from django.utils import timezone
from django.db.models import Sum, Count, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.accounts.permissions import IsAdmin

from .models import WorkTask, WorkEntry, WorkComment
from .serializers import (
    WorkTaskListSerializer, WorkTaskDetailSerializer,
    WorkEntrySerializer, WorkCommentSerializer,
)


class WorkTaskViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = WorkTask.objects.select_related('assigned_to', 'created_by', 'unit')
        assigned_to = self.request.query_params.get('assigned_to')
        status_filter = self.request.query_params.get('status')
        unit = self.request.query_params.get('unit')
        if assigned_to:
            qs = qs.filter(assigned_to_id=assigned_to)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if unit:
            qs = qs.filter(unit_id=unit)
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return WorkTaskDetailSerializer
        return WorkTaskListSerializer

    def perform_create(self, serializer):
        assigned_to = serializer.validated_data.get('assigned_to') or self.request.user
        serializer.save(created_by=self.request.user, assigned_to=assigned_to)

    @action(detail=True, methods=['post'], url_path='entries')
    def add_entry(self, request, pk=None):
        task = self.get_object()
        serializer = WorkEntrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(task=task, user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='comments')
    def add_comment(self, request, pk=None):
        task = self.get_object()
        serializer = WorkCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(task=task, user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='transition')
    def transition(self, request, pk=None):
        task = self.get_object()
        new_status = request.data.get('status')
        if new_status == 'in_progress' and task.status == 'todo':
            task.status = 'in_progress'
            task.started_at = timezone.now()
            task.save()
        elif new_status == 'done' and task.status in ('todo', 'in_progress'):
            task.status = 'done'
            task.completed_at = timezone.now()
            hours = request.data.get('hours_taken')
            if hours:
                task.hours_taken = hours
            elif task.started_at:
                delta = task.completed_at - task.started_at
                task.hours_taken = round(delta.total_seconds() / 3600, 1)
            task.save()
        elif new_status == 'todo':
            task.status = 'todo'
            task.started_at = None
            task.completed_at = None
            task.hours_taken = None
            task.save()
        serializer = WorkTaskListSerializer(task)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        now = timezone.now()
        week_start = now - timezone.timedelta(days=7)

        from django.contrib.auth import get_user_model
        User = get_user_model()

        users = User.objects.all()
        result = []
        for user in users:
            total_tasks = WorkTask.objects.filter(assigned_to=user).count()
            done_count = WorkTask.objects.filter(assigned_to=user, status='done').count()
            hours_this_week = WorkEntry.objects.filter(
                user=user,
                logged_at__gte=week_start,
            ).aggregate(total=Sum('work_hours'))['total'] or 0

            result.append({
                'user_id': user.id,
                'username': user.username,
                'full_name': user.get_full_name(),
                'total_tasks': total_tasks,
                'done_count': done_count,
                'hours_this_week': float(hours_this_week),
            })

        return Response(result)
