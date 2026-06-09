from rest_framework import serializers
from apps.units.serializers import UnitPairSerializer, ConvergenceUnitSerializer
from .models import Meeting, MeetingMinutes, ActionPoint, ActionPointComment, MeetingNotHeld


class ActionPointCommentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = ActionPointComment
        fields = ['id', 'text', 'created_by_name', 'created_at']
        read_only_fields = ['id', 'created_at', 'created_by_name']


class ActionPointSerializer(serializers.ModelSerializer):
    comments = ActionPointCommentSerializer(many=True, read_only=True)
    comment_count = serializers.IntegerField(source='comments.count', read_only=True)

    class Meta:
        model = ActionPoint
        fields = ['id', 'aid', 'text', 'done', 'order', 'comments', 'comment_count']
        read_only_fields = ['id', 'aid']


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
        source='pair', queryset=__import__('apps.units.models', fromlist=['UnitPair']).UnitPair.objects.all(),
        write_only=True
    )
    notify_units = ConvergenceUnitSerializer(many=True, read_only=True)
    notify_unit_ids = serializers.PrimaryKeyRelatedField(
        source='notify_units',
        many=True,
        queryset=__import__('apps.units.models', fromlist=['ConvergenceUnit']).ConvergenceUnit.objects.all(),
        write_only=True,
        required=False,
    )
    minutes = MeetingMinutesSerializer(read_only=True)
    not_held = MeetingNotHeldSerializer(read_only=True)
    action_points_done = serializers.SerializerMethodField()
    action_points_total = serializers.SerializerMethodField()

    class Meta:
        model = Meeting
        fields = [
            'id', 'pair', 'pair_id', 'date', 'time', 'status', 'mtype', 'agenda',
            'notify_units', 'notify_unit_ids', 'deadline', 'recorded_at',
            'minutes', 'not_held',
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
