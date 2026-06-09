from django.utils import timezone
from datetime import timedelta
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import KPIDefinition, KPIEntry
from .serializers import KPIDefinitionSerializer, KPIDefinitionDetailSerializer, KPIEntrySerializer


class KPIDefinitionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = KPIDefinition.objects.select_related('assigned_to', 'assigned_by', 'unit')
        active = self.request.query_params.get('active')
        unit = self.request.query_params.get('unit')
        assigned_to = self.request.query_params.get('assigned_to')
        if active is not None:
            qs = qs.filter(active=active.lower() == 'true')
        if unit:
            qs = qs.filter(unit_id=unit)
        if assigned_to:
            qs = qs.filter(assigned_to_id=assigned_to)
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return KPIDefinitionDetailSerializer
        return KPIDefinitionSerializer

    def perform_create(self, serializer):
        serializer.save(assigned_by=self.request.user)

    @action(detail=True, methods=['get', 'post'], url_path='entries')
    def entries(self, request, pk=None):
        kpi = self.get_object()
        if request.method == 'GET':
            entries = kpi.entries.all()
            date_from = request.query_params.get('date_from')
            date_to = request.query_params.get('date_to')
            if date_from:
                entries = entries.filter(date__gte=date_from)
            if date_to:
                entries = entries.filter(date__lte=date_to)
            serializer = KPIEntrySerializer(entries, many=True)
            return Response(serializer.data)
        else:
            serializer = KPIEntrySerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(kpi=kpi, entered_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)


class KPIEntryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = KPIEntrySerializer

    def get_queryset(self):
        qs = KPIEntry.objects.select_related('kpi', 'entered_by')
        kpi = self.request.query_params.get('kpi')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if kpi:
            qs = qs.filter(kpi_id=kpi)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return qs

    def perform_create(self, serializer):
        serializer.save(entered_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save()


from rest_framework.decorators import api_view, permission_classes as pc
from rest_framework.permissions import IsAuthenticated as IA


@api_view(['GET'])
@pc([IA])
def kpi_summary(request):
    """Per-user KPI compliance summary for the last 30 days."""
    from django.contrib.auth import get_user_model
    User = get_user_model()

    today = timezone.now().date()
    thirty_days_ago = today - timedelta(days=30)

    users = User.objects.all()
    result = []

    for user in users:
        active_kpis = KPIDefinition.objects.filter(assigned_to=user, active=True)
        kpi_data = []

        for kpi in active_kpis:
            # Expected entries in last 30 days based on frequency
            if kpi.frequency == 'daily':
                expected = 30
            elif kpi.frequency == 'weekly':
                expected = 4
            else:  # monthly
                expected = 1

            entries_in_period = kpi.entries.filter(date__gte=thirty_days_ago, date__lte=today)
            actual_count = entries_in_period.count()
            met_target = entries_in_period.filter(value__gte=kpi.target_value).count()
            hit_rate = round(met_target / expected * 100, 1) if expected > 0 else 0

            latest_entry = kpi.entries.order_by('-date').first()

            kpi_data.append({
                'kpi_id': kpi.id,
                'kpi_title': kpi.title,
                'metric_unit': kpi.metric_unit,
                'target_value': kpi.target_value,
                'frequency': kpi.frequency,
                'expected_entries': expected,
                'actual_entries': actual_count,
                'hit_rate': hit_rate,
                'latest_entry': KPIEntrySerializer(latest_entry).data if latest_entry else None,
            })

        result.append({
            'user_id': user.id,
            'username': user.username,
            'full_name': user.get_full_name(),
            'kpis': kpi_data,
        })

    return Response(result)
