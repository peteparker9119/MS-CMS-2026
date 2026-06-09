from rest_framework import serializers
from .models import KPIDefinition, KPIEntry


class KPIEntrySerializer(serializers.ModelSerializer):
    entered_by_name = serializers.CharField(source='entered_by.get_full_name', read_only=True)

    class Meta:
        model = KPIEntry
        fields = ['id', 'kpi', 'value', 'date', 'notes', 'entered_by', 'entered_by_name', 'created_at']
        read_only_fields = ['id', 'entered_by', 'entered_by_name', 'created_at']


class KPIDefinitionSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source='assigned_to.get_full_name', read_only=True)
    assigned_by_name = serializers.CharField(source='assigned_by.get_full_name', read_only=True)
    unit_name = serializers.CharField(source='unit.name', read_only=True)
    latest_entry = serializers.SerializerMethodField()

    class Meta:
        model = KPIDefinition
        fields = [
            'id', 'title', 'description', 'metric_unit', 'target_value', 'frequency',
            'assigned_to', 'assigned_to_name',
            'assigned_by', 'assigned_by_name',
            'unit', 'unit_name',
            'active', 'created_at', 'latest_entry',
        ]
        read_only_fields = ['id', 'created_at']

    def get_latest_entry(self, obj):
        entry = obj.entries.order_by('-date').first()
        if entry:
            return KPIEntrySerializer(entry).data
        return None


class KPIDefinitionDetailSerializer(KPIDefinitionSerializer):
    entries = KPIEntrySerializer(many=True, read_only=True)

    class Meta(KPIDefinitionSerializer.Meta):
        fields = KPIDefinitionSerializer.Meta.fields + ['entries']
