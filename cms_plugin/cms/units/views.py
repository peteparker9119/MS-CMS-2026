from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import ConvergenceUnit, UnitPair
from .serializers import ConvergenceUnitSerializer, UnitPairSerializer


class ConvergenceUnitViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ConvergenceUnit.objects.all()
    serializer_class = ConvergenceUnitSerializer
    permission_classes = [IsAuthenticated]


class UnitPairViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = UnitPair.objects.select_related('unit_a', 'unit_b').all()
    serializer_class = UnitPairSerializer
    permission_classes = [IsAuthenticated]
