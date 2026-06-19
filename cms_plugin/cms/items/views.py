from datetime import date
from django.db import models
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Item, ItemActionItem, SLAHistory, _next_item_aid
from .serializers import ItemSerializer, ItemActionItemSerializer, SLAHistorySerializer


def _notify(recipients, title, message, notif_type, object_id=None, action_type=None):
    try:
        from cms.notifications.utils import notify_users
        notify_users(recipients, title, message, notif_type,
                     object_id=object_id, action_type=action_type)
    except Exception:
        pass


class ItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ItemSerializer

    def get_queryset(self):
        qs = (Item.objects
              .select_related('raiser', 'assigned_to')
              .prefetch_related('targets', 'action_items', 'sla_history'))

        user = self.request.user
        if user.is_poc and user.unit:
            qs = qs.filter(Q(raiser=user.unit) | Q(targets=user.unit)).distinct()

        item_status = self.request.query_params.get('status')
        unit_slug   = self.request.query_params.get('unit')

        if item_status:
            qs = qs.filter(status=item_status)
        if unit_slug:
            qs = qs.filter(Q(raiser__slug=unit_slug) | Q(targets__slug=unit_slug)).distinct()

        return qs

    def perform_create(self, serializer):
        item = serializer.save(created_by=self.request.user)

        from django.contrib.auth import get_user_model
        User = get_user_model()
        target_slugs = [u.slug for u in item.targets.all()]
        recipients = list(User.objects.filter(
            Q(unit__slug__in=target_slugs) | Q(role='admin')
        ).distinct())

        _notify(
            recipients,
            f'New item {item.item_id}: {item.title}',
            f'A {item.get_type_display()} item "{item.title}" (priority: {item.priority}) '
            f'has been raised by {item.raiser.name}.',
            'item_created', object_id=item.id,
        )

        # Notify the assigned user if set at creation
        if item.assigned_to:
            _notify(
                [item.assigned_to],
                f'Item assigned to you: {item.item_id}',
                f'"{item.title}" has been assigned to you by '
                f'{self.request.user.get_full_name() or self.request.user.username}.',
                'item_assigned', object_id=item.id,
            )

    def perform_update(self, serializer):
        instance   = serializer.instance
        old_assign = instance.assigned_to_id
        old_sla_end = instance.sla_end

        updated = serializer.save()

        # Assignment change notification
        if old_assign != updated.assigned_to_id and updated.assigned_to:
            actor = self.request.user.get_full_name() or self.request.user.username
            _notify(
                [updated.assigned_to],
                f'Item assigned to you: {updated.item_id}',
                f'"{updated.title}" has been assigned to you by {actor}.',
                'item_assigned', object_id=updated.id,
            )

        # SLA breach notification (only once, when end date first passes)
        if updated.sla_end and updated.sla_end < date.today():
            if old_sla_end != updated.sla_end or old_sla_end is None:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                target_slugs = [u.slug for u in updated.targets.all()]
                breach_recipients = list(User.objects.filter(
                    Q(unit__slug__in=target_slugs) | Q(role='admin')
                ).distinct())
                if updated.assigned_to and updated.assigned_to not in breach_recipients:
                    breach_recipients.append(updated.assigned_to)
                _notify(
                    breach_recipients,
                    f'SLA breached: {updated.item_id}',
                    f'SLA end date {updated.sla_end} for "{updated.title}" has passed.',
                    'sla_breached', object_id=updated.id, action_type='acknowledge',
                )

    @action(detail=True, methods=['patch'], url_path='status')
    def set_status(self, request, pk=None):
        item = self.get_object()
        new_status = request.data.get('status')
        if new_status not in dict(Item.STATUS_CHOICES):
            return Response({'detail': 'Invalid status.'}, status=400)
        item.status = new_status
        item.save(update_fields=['status'])
        return Response(ItemSerializer(item).data)

    @action(detail=True, methods=['post'], url_path='action-items')
    def add_action_item(self, request, pk=None):
        item = self.get_object()
        text = request.data.get('text', '').strip()
        if not text:
            return Response({'detail': 'Text is required.'}, status=400)
        ai = ItemActionItem.objects.create(
            item=item,
            aid=_next_item_aid(),
            text=text,
            order=item.action_items.count(),
        )
        return Response(ItemActionItemSerializer(ai).data, status=201)

    @action(detail=True, methods=['patch'], url_path=r'action-items/(?P<aid>[^/.]+)')
    def toggle_action_item(self, request, pk=None, aid=None):
        item = self.get_object()
        try:
            if aid and not aid.isdigit():
                ai = item.action_items.get(aid=aid)
            else:
                ai = item.action_items.get(pk=aid)
        except ItemActionItem.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        ai.done = not ai.done
        ai.save(update_fields=['done'])
        return Response(ItemActionItemSerializer(ai).data)

    @action(detail=True, methods=['get'], url_path='sla-history')
    def sla_history(self, request, pk=None):
        item = self.get_object()
        history = item.sla_history.all()
        return Response(SLAHistorySerializer(history, many=True).data)
