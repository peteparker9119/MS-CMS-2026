from rest_framework import serializers
from apps.units.serializers import ConvergenceUnitSerializer
from .models import DOLetter


class DOLetterSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    units = ConvergenceUnitSerializer(many=True, read_only=True)
    unit_ids = serializers.PrimaryKeyRelatedField(
        source='units',
        many=True,
        queryset=__import__('apps.units.models', fromlist=['ConvergenceUnit']).ConvergenceUnit.objects.all(),
        write_only=True,
        required=False,
    )
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = DOLetter
        fields = [
            'id', 'title', 'reference_number', 'tracking_number', 'date', 'file', 'file_url',
            'description', 'uploaded_by', 'uploaded_by_name',
            'units', 'unit_ids', 'visible_to_all', 'uploaded_at',
        ]
        read_only_fields = ['id', 'uploaded_by', 'uploaded_by_name', 'uploaded_at', 'file_url', 'tracking_number']
        extra_kwargs = {'file': {'write_only': True}}

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None

    def create(self, validated_data):
        units = validated_data.pop('units', [])
        letter = DOLetter.objects.create(**validated_data)
        letter.units.set(units)
        return letter

    def update(self, instance, validated_data):
        units = validated_data.pop('units', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if units is not None:
            instance.units.set(units)
        return instance
