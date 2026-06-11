from rest_framework import viewsets
from rest_framework.parsers import MultiPartParser, FormParser
from apps.accounts.permissions import IsPOCUploadAdminView

from .models import DOLetter
from .serializers import DOLetterSerializer


class DOLetterViewSet(viewsets.ModelViewSet):
    permission_classes = [IsPOCUploadAdminView]
    serializer_class = DOLetterSerializer
    parser_classes = [MultiPartParser, FormParser]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = DOLetter.objects.select_related('uploaded_by').prefetch_related('units')
        user = self.request.user

        if user.is_poc:
            from django.db.models import Q
            # POC sees: letters they uploaded OR letters circulated to all teams
            qs = qs.filter(Q(uploaded_by=user) | Q(visible_to_all=True)).distinct()
        # admin sees everything

        unit = self.request.query_params.get('unit')
        year = self.request.query_params.get('year')
        if unit:
            qs = qs.filter(units__id=unit)
        if year:
            qs = qs.filter(date__year=year)
        return qs

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.role != 'admin' and instance.uploaded_by != request.user:
            from rest_framework.response import Response
            return Response({'detail': 'Not allowed'}, status=403)
        # Only allow updating visible_to_all and unit_ids
        allowed = {k: v for k, v in request.data.items() if k in ('visible_to_all', 'unit_ids')}
        ser = self.get_serializer(instance, data=allowed, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
