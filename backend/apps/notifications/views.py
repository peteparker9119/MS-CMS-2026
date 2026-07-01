from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Notification
from .serializers import NotificationSerializer

VALID_RESPONSES = {'accept', 'decline', 'acknowledge'}


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class   = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=True, methods=['patch'], url_path='read')
    def mark_read(self, request, pk=None):
        n = self.get_object()
        n.read = True
        n.save()
        return Response(NotificationSerializer(n).data)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        Notification.objects.filter(user=request.user, read=False).update(read=True)
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'], url_path='respond')
    def respond(self, request, pk=None):
        n = self.get_object()
        resp = request.data.get('response', '').strip().lower()
        if resp not in VALID_RESPONSES:
            return Response(
                {'detail': f"Invalid response. Choose from: {', '.join(sorted(VALID_RESPONSES))}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        n.responded = True
        n.response  = resp
        n.read      = True
        n.save(update_fields=['responded', 'response', 'read'])

        # Notify admins about the RSVP response
        if n.action_type == 'rsvp' and resp in ('accept', 'decline'):
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user_name = request.user.get_full_name() or request.user.username
            emoji = '✅' if resp == 'accept' else '❌'
            units = n.action_data.get('units', '')
            date  = n.action_data.get('date', '')
            admins = User.objects.filter(role__in=['admin', 'super_admin'])
            for admin in admins:
                Notification.objects.create(
                    user=admin,
                    title=f'{emoji} {user_name} {resp}ed meeting',
                    message=f'{user_name} has {resp}ed the meeting {units} on {date}.',
                    notif_type='meeting_scheduled',
                    object_id=n.object_id,
                )

        return Response(NotificationSerializer(n).data)
