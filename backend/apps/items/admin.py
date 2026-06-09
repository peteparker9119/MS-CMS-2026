from django.contrib import admin
from .models import Item, ItemActionItem


class ItemActionItemInline(admin.TabularInline):
    model = ItemActionItem
    extra = 0


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ['item_id', 'type', 'title', 'priority', 'status', 'raiser', 'created_at']
    list_filter = ['type', 'priority', 'status', 'raiser']
    inlines = [ItemActionItemInline]
    readonly_fields = ['item_id', 'created_at']
