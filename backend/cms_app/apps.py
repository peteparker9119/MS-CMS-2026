from django.apps import AppConfig


class CmsAppConfig(AppConfig):
    """
    Consolidated CMS app.

    This package re-exports the models, serializers and views that currently
    live in the individual `apps.*` packages and surfaces them through a single
    `cms` folder mounted under the `api/cms/` URL prefix. It declares no models
    of its own (see migrations/ — intentionally empty), so it is additive and
    does not alter the existing `apps.*` tables or routes.

    Structured to be dropped into the TNEMIS `django-web-api` project as `cms`.
    """

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'cms_app'
    label = 'cms_app'
    verbose_name = 'CMS (consolidated)'
