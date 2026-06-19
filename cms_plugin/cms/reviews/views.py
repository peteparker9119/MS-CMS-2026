from django.utils import timezone
from datetime import timedelta
from django.db.models import Avg
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes as pc
from rest_framework.permissions import IsAuthenticated, IsAuthenticated as IA
from rest_framework.response import Response

from .models import ReviewTemplate, ReviewEntry, ReviewScore
from .serializers import ReviewTemplateSerializer, ReviewEntrySerializer


class ReviewTemplateViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReviewTemplateSerializer

    def get_queryset(self):
        qs = ReviewTemplate.objects.select_related('unit', 'created_by').prefetch_related('criteria')
        unit = self.request.query_params.get('unit')
        active = self.request.query_params.get('active')
        if unit:
            qs = qs.filter(unit_id=unit)
        if active is not None:
            qs = qs.filter(active=active.lower() == 'true')
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ReviewEntryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReviewEntrySerializer

    def get_queryset(self):
        qs = ReviewEntry.objects.select_related('template', 'reviewer', 'reviewee', 'unit').prefetch_related('scores')
        template = self.request.query_params.get('template')
        reviewer = self.request.query_params.get('reviewer')
        reviewee = self.request.query_params.get('reviewee')
        unit = self.request.query_params.get('unit')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if template:
            qs = qs.filter(template_id=template)
        if reviewer:
            qs = qs.filter(reviewer_id=reviewer)
        if reviewee:
            qs = qs.filter(reviewee_id=reviewee)
        if unit:
            qs = qs.filter(unit_id=unit)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return qs

    def perform_create(self, serializer):
        serializer.save(reviewer=self.request.user)


@api_view(['GET'])
@pc([IA])
def reviews_summary(request):
    """Average score per template per unit over the last 90 days."""
    today = timezone.now().date()
    ninety_days_ago = today - timedelta(days=90)

    templates = ReviewTemplate.objects.prefetch_related('entries__scores', 'entries__unit')
    result = []

    for template in templates:
        entries = template.entries.filter(date__gte=ninety_days_ago)
        # Group by unit
        units_seen = {}
        for entry in entries:
            unit_id = entry.unit_id
            unit_name = entry.unit.name if entry.unit else None
            key = unit_id if unit_id is not None else 'none'
            if key not in units_seen:
                units_seen[key] = {
                    'unit_id': unit_id,
                    'unit_name': unit_name,
                    'scores': [],
                    'entry_count': 0,
                }
            units_seen[key]['entry_count'] += 1
            for score in entry.scores.all():
                units_seen[key]['scores'].append(score.score)

        unit_stats = []
        for key, data in units_seen.items():
            scores = data['scores']
            avg = round(sum(scores) / len(scores), 2) if scores else None
            unit_stats.append({
                'unit_id': data['unit_id'],
                'unit_name': data['unit_name'],
                'entry_count': data['entry_count'],
                'average_score': avg,
            })

        result.append({
            'template_id': template.id,
            'template_title': template.title,
            'frequency': template.frequency,
            'units': unit_stats,
        })

    return Response(result)
