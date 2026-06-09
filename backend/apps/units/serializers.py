from rest_framework import serializers
from .models import ConvergenceUnit, UnitPair


class ConvergenceUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConvergenceUnit
        fields = ['id', 'slug', 'abbr', 'name', 'color', 'member_name', 'order']


class UnitPairSerializer(serializers.ModelSerializer):
    unit_a = ConvergenceUnitSerializer(read_only=True)
    unit_b = ConvergenceUnitSerializer(read_only=True)
    label = serializers.SerializerMethodField()

    class Meta:
        model = UnitPair
        fields = ['id', 'unit_a', 'unit_b', 'label']

    def get_label(self, obj):
        return str(obj)
