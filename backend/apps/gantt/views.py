from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import GanttTask
from .serializers import GanttTaskSerializer


class GanttTaskViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = GanttTaskSerializer

    def get_queryset(self):
        qs = GanttTask.objects.select_related('unit', 'assigned_to', 'created_by', 'parent').prefetch_related('subtasks')
        academic_year = self.request.query_params.get('academic_year')
        unit = self.request.query_params.get('unit')
        if academic_year:
            qs = qs.filter(academic_year=academic_year)
        if unit:
            qs = qs.filter(unit_id=unit)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='years')
    def years(self, request):
        """Return distinct academic years present plus the current one."""
        existing = list(
            GanttTask.objects.values_list('academic_year', flat=True).distinct().order_by('academic_year')
        )
        # Compute current academic year (Indian system: April start)
        today = timezone.now().date()
        if today.month >= 4:
            current_year = f'{today.year}-{today.year + 1}'
        else:
            current_year = f'{today.year - 1}-{today.year}'

        if current_year not in existing:
            existing.append(current_year)
            existing.sort()

        return Response({'years': existing, 'current': current_year})
