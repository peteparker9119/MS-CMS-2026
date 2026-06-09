from datetime import date
from rest_framework import serializers
from apps.units.serializers import ConvergenceUnitSerializer
from .models import Item, ItemActionItem, SLAHistory, _next_item_aid


class ItemActionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemActionItem
        fields = ['id', 'aid', 'text', 'done', 'order', 'created_at']
        read_only_fields = ['id', 'aid', 'created_at']


class SLAHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SLAHistory
        fields = ['id', 'old_start', 'old_end', 'new_start', 'new_end',
                  'changed_by_name', 'changed_at', 'note']

    def get_changed_by_name(self, obj):
        if not obj.changed_by:
            return 'System'
        return obj.changed_by.get_full_name() or obj.changed_by.username


class ItemSerializer(serializers.ModelSerializer):
    raiser = ConvergenceUnitSerializer(read_only=True)
    raiser_id = serializers.PrimaryKeyRelatedField(
        source='raiser',
        queryset=__import__('apps.units.models', fromlist=['ConvergenceUnit']).ConvergenceUnit.objects.all(),
        write_only=True,
    )
    targets = ConvergenceUnitSerializer(many=True, read_only=True)
    target_ids = serializers.PrimaryKeyRelatedField(
        source='targets',
        many=True,
        queryset=__import__('apps.units.models', fromlist=['ConvergenceUnit']).ConvergenceUnit.objects.all(),
        write_only=True,
    )

    # Assignment
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source='assigned_to',
        queryset=__import__('django.contrib.auth', fromlist=['get_user_model']).get_user_model().objects.filter(is_active=True),
        write_only=True,
        required=False,
        allow_null=True,
    )
    assigned_to_name = serializers.SerializerMethodField()

    action_items    = ItemActionItemSerializer(many=True, read_only=True)
    sla_history     = SLAHistorySerializer(many=True, read_only=True)
    type_code       = serializers.SerializerMethodField()
    type_color      = serializers.SerializerMethodField()
    sla_status      = serializers.SerializerMethodField()
    sla_metrics     = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = [
            'id', 'item_id', 'type', 'type_code', 'type_color',
            'title', 'description', 'priority', 'status',
            'raiser', 'raiser_id', 'targets', 'target_ids',
            'assigned_to_id', 'assigned_to_name',
            'sla_start', 'sla_end', 'sla_status', 'sla_metrics', 'sla_history',
            'action_items', 'created_at',
        ]
        read_only_fields = ['id', 'item_id', 'created_at']

    def get_type_code(self, obj):
        return Item.TYPE_CODES.get(obj.type, 'IT')

    def get_type_color(self, obj):
        return Item.TYPE_COLORS.get(obj.type, '#1A1A1F')

    def get_sla_metrics(self, obj):
        """Derive all SLA metrics from sla_start and sla_end."""
        if not obj.sla_start or not obj.sla_end:
            return None
        today    = date.today()
        total    = (obj.sla_end - obj.sla_start).days
        if total <= 0:
            return None
        elapsed   = (today - obj.sla_start).days
        remaining = (obj.sla_end - today).days
        progress  = max(0, min(100, round(elapsed / total * 100)))

        if today < obj.sla_start:
            status = 'not_started'
        elif today > obj.sla_end:
            status = 'breached'
        elif remaining == 0:
            status = 'due_today'
        elif progress >= 80:
            status = 'warning'
        else:
            status = 'on_track'

        return {
            'total_days':     total,
            'elapsed_days':   max(0, elapsed),
            'remaining_days': max(0, remaining),
            'overdue_days':   max(0, -remaining),
            'progress_pct':   progress,
            'status':         status,
        }

    def get_sla_status(self, obj):
        m = self.get_sla_metrics(obj)
        if m:
            return m['status']
        # Fallback when only sla_end is set (no start)
        if not obj.sla_end:
            return None
        diff = (obj.sla_end - date.today()).days
        if diff < 0:   return 'breached'
        if diff == 0:  return 'due_today'
        if diff <= 3:  return 'warning'
        return 'ok'

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to:
            return None
        return obj.assigned_to.get_full_name() or obj.assigned_to.username

    def create(self, validated_data):
        targets = validated_data.pop('targets', [])
        item = Item.objects.create(**validated_data)
        item.targets.set(targets)
        return item

    def update(self, instance, validated_data):
        targets = validated_data.pop('targets', None)

        # Detect SLA changes before saving
        old_sla_start = instance.sla_start
        old_sla_end   = instance.sla_end
        new_sla_start = validated_data.get('sla_start', instance.sla_start)
        new_sla_end   = validated_data.get('sla_end',   instance.sla_end)

        sla_changed = (old_sla_start != new_sla_start) or (old_sla_end != new_sla_end)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if targets is not None:
            instance.targets.set(targets)

        # Record SLA history entry on any SLA date change
        if sla_changed:
            request = self.context.get('request')
            SLAHistory.objects.create(
                item=instance,
                old_start=old_sla_start,
                old_end=old_sla_end,
                new_start=new_sla_start,
                new_end=new_sla_end,
                changed_by=request.user if request else None,
            )

        return instance
