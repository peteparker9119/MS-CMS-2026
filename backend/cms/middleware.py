import logging
from django.db import OperationalError, DatabaseError
from django.http import JsonResponse

logger = logging.getLogger('cms')


class DatabaseErrorMiddleware:
    """
    EC-05: Catch database connectivity failures globally.
    Returns 503 JSON so the frontend can show a friendly message.
    Logs every failure so ops can be alerted.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            return self.get_response(request)
        except OperationalError as exc:
            logger.critical(
                'EC-05 DB connectivity failure: %s | path=%s',
                exc, request.path, exc_info=True,
            )
            return JsonResponse(
                {'detail': 'Service temporarily unavailable. Please try again shortly.'},
                status=503,
            )
        except DatabaseError as exc:
            logger.error(
                'EC-05 DB error: %s | path=%s',
                exc, request.path, exc_info=True,
            )
            return JsonResponse(
                {'detail': 'A database error occurred. Please try again.'},
                status=503,
            )
