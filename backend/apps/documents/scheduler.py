import logging
logger = logging.getLogger('cms')
_scheduler = None


def start():
    global _scheduler
    if _scheduler and _scheduler.running:
        return
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
        from django.core.management import call_command

        _scheduler = BackgroundScheduler(timezone='Asia/Kolkata')
        _scheduler.add_job(
            lambda: call_command('check_do_compliance'),
            CronTrigger(day=13, hour=9, minute=0),
            id='do_compliance_check', replace_existing=True,
        )
        _scheduler.add_job(
            lambda: call_command('notify_ap_deadlines'),
            CronTrigger(hour=8, minute=0),
            id='ap_deadline_notify', replace_existing=True,
        )
        _scheduler.start()
        logger.info('APScheduler started')
    except ImportError:
        logger.warning('APScheduler not installed — scheduled jobs disabled')
    except Exception as exc:
        logger.error('APScheduler start failed: %s', exc)
