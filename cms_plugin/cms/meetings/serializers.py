from rest_framework import serializers
from django.contrib.auth import get_user_model
from cms.units.serializers import UnitPairSerializer, ConvergenceUnitSerializer
from cms.units.models import UnitPair, ConvergenceUnit
from .models import Meeting, MeetingMinutes, ActionPoint, ActionPointComment, MeetingNotHeld, ActionPointDeadlineHistory, MeetingHistory

User = get_user_model()


class ActionPointCommentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = ActionPointComment
        fields = ['id', 'text', 'created_by_name', 'created_at']
        read_only_fields = ['id', 'created_at', 'created_by_name']


class ActionPointDeadlineHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ActionPointDeadlineHistory
        fields = ['id', 'changed_by_name', 'old_deadline', 'new_deadline', 'changed_at']

    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.get_full_name() or obj.changed_by.username
        return 'System'


class ActionPointSerializer(serializers.ModelSerializer):
    comments = ActionPointCommentSerializer(many=True, read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    deadline_history = ActionPointDeadlineHistorySerializer(many=True, read_only=True)
    assigned_to = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), allow_null=True, required=False,
    )

    class Meta:
        model = ActionPoint
        fields = [
            'id', 'aid', 'text', 'done', 'order',
            'assigned_to', 'assigned_to_name', 'start_date', 'deadline',
            'deadline_history', 'comments',
        ]

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None


class MeetingHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MeetingHistory
        fields = ['id', 'action', 'reason', 'old_date', 'new_date', 'old_time', 'new_time', 'changed_by_name', 'changed_at']

    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.get_full_name() or obj.changed_by.username
        return 'System'


class MeetingNotHeldSerializer(serializers.ModelSerializer):
    class Meta:
        model = MeetingNotHeld
        fields = ['id', 'status', 'reason']
        read_only_fields = ['id']


class MeetingMinutesSerializer(serializers.ModelSerializer):
    action_points = ActionPointSerializer(many=True, read_only=True)
    action_points_input = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )

    class Meta:
        model = MeetingMinutes
        fields = [
            'id', 'attendees', 'summary', 'source', 'filename',
            'uploaded_file', 'uploaded_at', 'action_points', 'action_points_input',
        ]
        read_only_fields = ['id', 'uploaded_at']


class MeetingListSerializer(serializers.ModelSerializer):
    pair = UnitPairSerializer(read_only=True)
    pair_id = serializers.PrimaryKeyRelatedField(
        source='pair', queryset=UnitPair.objects.all(),
        write_only=True
    )
    notify_units = ConvergenceUnitSerializer(many=True, read_only=True)
    notify_unit_ids = serializers.PrimaryKeyRelatedField(
        source='notify_units',
        many=True,
        queryset=ConvergenceUnit.objects.all(),
        write_only=True,
        required=False,
    )
    minutes = MeetingMinutesSerializer(read_only=True)
    not_held = MeetingNotHeldSerializer(read_only=True)
    history = MeetingHistorySerializer(many=True, read_only=True)
    action_points_done = serializers.SerializerMethodField()
    action_points_total = serializers.SerializerMethodField()

    class Meta:
        model = Meeting
        fields = [
            'id', 'pair', 'pair_id', 'date', 'time', 'end_time', 'status', 'mtype', 'agenda',
            'title', 'description', 'meet_link', 'recurrence',
            'notify_units', 'notify_unit_ids', 'deadline', 'recorded_at',
            'minutes', 'not_held', 'history',
            'action_points_done', 'action_points_total',
        ]
        read_only_fields = ['id', 'recorded_at']

    def get_action_points_done(self, obj):
        try:
            return obj.minutes.action_points.filter(done=True).count()
        except MeetingMinutes.DoesNotExist:
            return 0

    def get_action_points_total(self, obj):
        try:
            return obj.minutes.action_points.count()
        except MeetingMinutes.DoesNotExist:
            return 0

    def create(self, validated_data):
        notify_units = validated_data.pop('notify_units', [])
        meeting = Meeting.objects.create(**validated_data)
        meeting.notify_units.set(notify_units)
        return meeting

    def update(self, instance, validated_data):
        notify_units = validated_data.pop('notify_units', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if notify_units is not None:
            instance.notify_units.set(notify_units)
        return instance
