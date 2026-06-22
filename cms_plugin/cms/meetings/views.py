import logging
from django.db import transaction
from django.db.models import Q, Count, Case, When, IntegerField
from rest_framework import viewsets, status

logger = logging.getLogger('cms')
from rest_framework.decorators import action, api_view
from rest_framework.decorators import permission_classes as permission_classes_dec
from rest_framework.permissions import IsAuthenticated
from cms.accounts.permissions import IsAdminOrReadOnly
from rest_framework.response import Response

from cms.units.models import ConvergenceUnit, UnitPair
from .models import Meeting, MeetingMinutes, ActionPoint, ActionPointComment, MeetingNotHeld, MeetingHistory
from .serializers import (
    MeetingListSerializer, MeetingMinutesSerializer,
    ActionPointSerializer, ActionPointCommentSerializer, MeetingNotHeldSerializer,
)


def _next_aid():
    last = ActionPoint.objects.order_by('-id').first()
    n = (last.id if last else 0) + 1
    return f'AI-{n:03d}'


class MeetingViewSet(viewsets.ModelViewSet):
    serializer_class = MeetingListSerializer

    def get_permissions(self):
        # POC users can submit minutes and record not-held for their own meetings
        if self.action in ('minutes', 'not_held'):
            return [IsAuthenticated()]
        return [IsAdminOrReadOnly()]

    def get_queryset(self):
        qs = Meeting.objects.select_related(
            'pair__unit_a', 'pair__unit_b',
            'minutes', 'not_held',
        ).prefetch_related(
            'notify_units',
            'minutes__action_points__comments',
            'history',
        )

        user = self.request.user
        if not user.is_admin and user.unit:
            qs = qs.filter(Q(pair__unit_a=user.unit) | Q(pair__unit_b=user.unit))

        # filters
        pair_id = self.request.query_params.get('pair')
        unit_slug = self.request.query_params.get('unit')
        meeting_status = self.request.query_params.get('status')
        date_from = self.request.query_params.get('from')
        date_to = self.request.query_params.get('to')

        if pair_id:
            qs = qs.filter(pair_id=pair_id)
        if unit_slug:
            qs = qs.filter(Q(pair__unit_a__slug=unit_slug) | Q(pair__unit_b__slug=unit_slug))
        if meeting_status:
            qs = qs.filter(status=meeting_status)
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        return qs

    def perform_update(self, serializer):
        old = self.get_object()
        old_date = old.date
        old_time = old.time
        instance = serializer.save()
        if instance.date != old_date or instance.time != old_time:
            MeetingHistory.objects.create(
                meeting=instance, action='rescheduled',
                changed_by=self.request.user,
                old_date=old_date, new_date=instance.date,
                old_time=old_time, new_time=instance.time,
            )

    def perform_create(self, serializer):
        meeting = serializer.save(created_by=self.request.user)
        MeetingHistory.objects.create(meeting=meeting, action='scheduled', changed_by=self.request.user)
        from cms.notifications.utils import notify_users
        from django.contrib.auth import get_user_model
        User = get_user_model()
        pair = meeting.pair
        unit_slugs = [pair.unit_a.slug, pair.unit_b.slug]
        recipients = User.objects.filter(unit__slug__in=unit_slugs)
        title = f'Meeting scheduled: {pair.unit_a.abbr} × {pair.unit_b.abbr}'
        message = f'A meeting between {pair.unit_a.name} and {pair.unit_b.name} has been scheduled for {meeting.date}.'
        notify_users(
            list(recipients), title, message, 'meeting_scheduled',
            object_id=meeting.id,
            action_type='rsvp',
            action_data={
                'date': str(meeting.date),
                'time': str(meeting.time) if meeting.time else '',
                'units': f'{pair.unit_a.abbr} × {pair.unit_b.abbr}',
                'mtype': meeting.mtype or 'In-person',
            },
        )

    @action(detail=True, methods=['post'], url_path='cancel', permission_classes=[IsAdminOrReadOnly])
    def cancel(self, request, pk=None):
        meeting = self.get_object()
        reason = request.data.get('reason', '')
        old_date = meeting.date
        old_time = meeting.time
        meeting.status = Meeting.STATUS_CANCELLED
        meeting.save(update_fields=['status'])
        MeetingHistory.objects.create(
            meeting=meeting, action='cancelled',
            changed_by=request.user, reason=reason,
            old_date=old_date, old_time=old_time,
        )
        return Response({'status': 'cancelled'})

    @action(detail=True, methods=['get', 'post'], url_path='minutes')
    def minutes(self, request, pk=None):
        meeting = self.get_object()

        # Verify POC is part of this meeting's pair
        user = request.user
        if user.is_poc and user.unit:
            if meeting.pair.unit_a != user.unit and meeting.pair.unit_b != user.unit:
                return Response({'detail': 'You are not part of this meeting.'}, status=403)

        if request.method == 'GET':
            try:
                ser = MeetingMinutesSerializer(meeting.minutes)
                return Response(ser.data)
            except MeetingMinutes.DoesNotExist:
                return Response({'detail': 'No minutes filed yet.'}, status=404)

        # POST — submit MoM
        action_points_input = request.data.get('action_points', [])
        ser = MeetingMinutesSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        validated = ser.validated_data
        validated.pop('action_points_input', None)

        from django.contrib.auth import get_user_model
        User = get_user_model()

        # EC-07: wrap all MoM writes in a single transaction so a mid-write
        # failure can't leave minutes saved but action points or status missing.
        with transaction.atomic():
            mom, created = MeetingMinutes.objects.update_or_create(
                meeting=meeting,
                defaults={**validated, 'created_by': request.user},
            )

            if action_points_input:
                mom.action_points.all().delete()
                for i, ap_data in enumerate(action_points_input):
                    # Support both plain strings (legacy) and structured dicts
                    if isinstance(ap_data, str):
                        text = ap_data.strip()
                        assigned_to_id = None
                        deadline = None
                    else:
                        text = (ap_data.get('text') or '').strip()
                        assigned_to_id = ap_data.get('assigned_to')
                        start_date = ap_data.get('start_date') or None
                        deadline = ap_data.get('deadline') or None
                    if text:
                        assigned_to = User.objects.filter(pk=assigned_to_id).first() if assigned_to_id else None
                        ActionPoint.objects.create(
                            minutes=mom,
                            aid=_next_aid(),
                            text=text,
                            order=i,
                            assigned_to=assigned_to,
                            start_date=start_date,
                            deadline=deadline,
                        )

            meeting.status = Meeting.STATUS_CONDUCTED
            meeting.save(update_fields=['status'])

        return Response(MeetingMinutesSerializer(mom).data, status=201 if created else 200)

    @action(detail=True, methods=['patch'], url_path='not-held')
    def not_held(self, request, pk=None):
        meeting = self.get_object()

        # Verify POC is part of this meeting's pair
        user = request.user
        if user.is_poc and user.unit:
            if meeting.pair.unit_a != user.unit and meeting.pair.unit_b != user.unit:
                return Response({'detail': 'You are not part of this meeting.'}, status=403)

        nh_status = request.data.get('status', MeetingNotHeld.STATUS_POSTPONED)
        reason = request.data.get('reason', '')

        # EC-07: keep not-held record and meeting status in sync atomically
        with transaction.atomic():
            nh, _ = MeetingNotHeld.objects.update_or_create(
                meeting=meeting,
                defaults={'status': nh_status, 'reason': reason, 'created_by': request.user},
            )
            meeting.status = nh_status
            meeting.save(update_fields=['status'])
        return Response(MeetingNotHeldSerializer(nh).data)


class ActionPointViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ActionPointSerializer

    def get_queryset(self):
        qs = ActionPoint.objects.select_related(
            'minutes__meeting__pair__unit_a',
            'minutes__meeting__pair__unit_b',
        ).prefetch_related('comments')

        user = self.request.user
        if not user.is_admin and user.unit:
            qs = qs.filter(
                Q(minutes__meeting__pair__unit_a=user.unit) |
                Q(minutes__meeting__pair__unit_b=user.unit)
            )

        done = self.request.query_params.get('done')
        if done is not None:
            qs = qs.filter(done=done.lower() == 'true')

        pair_id = self.request.query_params.get('pair')
        if pair_id:
            qs = qs.filter(minutes__meeting__pair_id=pair_id)

        return qs

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if 'deadline' in request.data:
            new_dl = request.data.get('deadline') or None
            old_dl = str(instance.deadline) if instance.deadline else None
            if str(new_dl or '') != str(old_dl or ''):
                from .models import ActionPointDeadlineHistory
                ActionPointDeadlineHistory.objects.create(
                    action_point=instance,
                    changed_by=request.user,
                    old_deadline=old_dl,
                    new_deadline=new_dl,
                )
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='comments')
    def add_comment(self, request, pk=None):
        ap = self.get_object()
        ser = ActionPointCommentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        comment = ser.save(action_point=ap, created_by=request.user)
        return Response(ActionPointCommentSerializer(comment).data, status=201)

    @action(detail=True, methods=['post'], url_path='ask-status', permission_classes=[IsAuthenticated])
    def ask_status(self, request, pk=None):
        """Admin sends in-app notification to POC users asking why item is still pending."""
        from cms.notifications.models import Notification
        from django.contrib.auth import get_user_model
        User = get_user_model()

        ap = self.get_object()
        if request.user.role != 'admin':
            return Response({'detail': 'Admin only'}, status=403)

        meeting = ap.minutes.meeting
        unit_a  = meeting.pair.unit_a
        unit_b  = meeting.pair.unit_b

        poc_users = User.objects.filter(role='poc', unit__in=[unit_a, unit_b])
        note = request.data.get('note', '')
        msg = f'Action item "{ap.text}" is still pending. {note}'.strip()

        created = 0
        for user in poc_users:
            Notification.objects.create(
                user=user,
                title='Status update requested',
                message=msg,
                notif_type='item_created',
                object_id=ap.id,
                action_type='acknowledge',
            )
            created += 1

        return Response({'sent': created})


@api_view(['GET'])
@permission_classes_dec([IsAuthenticated])
def meeting_members(request, pk):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        meeting = Meeting.objects.select_related('pair__unit_a', 'pair__unit_b').get(pk=pk)
    except Meeting.DoesNotExist:
        return Response({'detail': 'Not found'}, status=404)
    unit_a = meeting.pair.unit_a
    unit_b = meeting.pair.unit_b
    users = User.objects.filter(unit__in=[unit_a, unit_b], is_active=True).select_related('unit')
    data = [
        {
            'id': u.id,
            'name': u.get_full_name() or u.username,
            'unit_abbr': u.unit.abbr if u.unit else '',
        }
        for u in users
    ]
    return Response(data)


@api_view(['GET'])
@permission_classes_dec([IsAuthenticated])
def dashboard_stats(request):
    unit_slug = request.query_params.get('unit')
    date_from = request.query_params.get('from')
    date_to = request.query_params.get('to')

    meeting_qs = Meeting.objects.all()
    if unit_slug and unit_slug != 'all':
        meeting_qs = meeting_qs.filter(
            Q(pair__unit_a__slug=unit_slug) | Q(pair__unit_b__slug=unit_slug)
        )
    # Scope to user's unit for non-admin roles (poc + team)
    if not request.user.is_admin and request.user.unit:
        meeting_qs = meeting_qs.filter(
            Q(pair__unit_a=request.user.unit) | Q(pair__unit_b=request.user.unit)
        )
    if date_from:
        meeting_qs = meeting_qs.filter(date__gte=date_from)
    if date_to:
        meeting_qs = meeting_qs.filter(date__lte=date_to)

    planned = meeting_qs.count()
    conducted = meeting_qs.filter(status=Meeting.STATUS_CONDUCTED).count()
    postponed = meeting_qs.filter(status=Meeting.STATUS_POSTPONED).count()
    missed = meeting_qs.filter(status=Meeting.STATUS_MISSED).count()
    moms = MeetingMinutes.objects.filter(meeting__in=meeting_qs).count()

    ap_qs = ActionPoint.objects.filter(minutes__meeting__in=meeting_qs)
    a_tot = ap_qs.count()
    a_done = ap_qs.filter(done=True).count()
    a_pend = a_tot - a_done

    return Response({
        'planned': planned,
        'conducted': conducted,
        'postponed': postponed,
        'missed': missed,
        'moms': moms,
        'a_tot': a_tot,
        'a_done': a_done,
        'a_pend': a_pend,
        'act_pct': round(a_done / a_tot * 100, 1) if a_tot else 0,
    })


@api_view(['GET'])
@permission_classes_dec([IsAuthenticated])
def dashboard_matrix(request):
    """Returns per-pair conducted/planned counts for the convergence tile grid."""
    date_from = request.query_params.get('from')
    date_to = request.query_params.get('to')

    pairs = UnitPair.objects.select_related('unit_a', 'unit_b').all()

    # Scope to user's unit for non-admin roles (poc + team)
    user = request.user
    if not user.is_admin and user.unit:
        pairs = pairs.filter(Q(unit_a=user.unit) | Q(unit_b=user.unit))

    result = []
    for pair in pairs:
        qs = pair.meetings.all()
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        planned = qs.count()
        conducted = qs.filter(status=Meeting.STATUS_CONDUCTED).count()
        result.append({
            'pair_id': pair.id,
            'unit_a': pair.unit_a.slug,
            'unit_b': pair.unit_b.slug,
            'planned': planned,
            'conducted': conducted,
            'rate': round(conducted / planned, 3) if planned else None,
        })
    return Response(result)
