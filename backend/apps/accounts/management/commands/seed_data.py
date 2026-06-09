"""
Management command: python manage.py seed_data

Creates the 7 convergence units, all 21 unit-pairs,
one admin user, and one POC user per unit.
"""
from itertools import combinations
from django.core.management.base import BaseCommand
from apps.units.models import ConvergenceUnit, UnitPair
from apps.accounts.models import User


UNITS = [
    {'slug': 'vp',    'abbr': 'VP',      'name': 'VETRI Palligal',   'color': '#1A1A1F', 'member_name': 'VETRI Palligal Lead',  'order': 0},
    {'slug': 'smc',   'abbr': 'SMC',     'name': 'SMC',              'color': '#1D9E75', 'member_name': 'SMC Coordinator',      'order': 1},
    {'slug': 'cg',    'abbr': 'CG',      'name': 'Career Guidance',  'color': '#378ADD', 'member_name': 'Career Guidance Lead', 'order': 2},
    {'slug': 'acis',  'abbr': 'ACIS',    'name': 'ACIS',             'color': '#D85A30', 'member_name': 'ACIS Coordinator',     'order': 3},
    {'slug': 'nsnop', 'abbr': 'NSNOP',   'name': 'NSNOP',            'color': '#7F77DD', 'member_name': 'NSNOP Officer',        'order': 4},
    {'slug': 'alum',  'abbr': 'Alumni',  'name': 'Alumni',           'color': '#E0A21C', 'member_name': 'Alumni Cell',          'order': 5},
    {'slug': 'man',   'abbr': 'Manarkeni','name': 'Manarkeni',       'color': '#D4537E', 'member_name': 'Manarkeni Lead',       'order': 6},
]


class Command(BaseCommand):
    help = 'Seed convergence units, pairs, and default users'

    def handle(self, *args, **options):
        self.stdout.write('Seeding convergence units...')
        unit_objs = {}
        for data in UNITS:
            unit, created = ConvergenceUnit.objects.update_or_create(
                slug=data['slug'],
                defaults=data,
            )
            unit_objs[data['slug']] = unit
            self.stdout.write(f'  {"Created" if created else "Updated"} unit: {unit.name}')

        self.stdout.write('Seeding unit pairs...')
        slugs = [u['slug'] for u in UNITS]
        pair_count = 0
        for slug_a, slug_b in combinations(slugs, 2):
            pair, created = UnitPair.objects.get_or_create(
                unit_a=unit_objs[slug_a],
                unit_b=unit_objs[slug_b],
            )
            if created:
                pair_count += 1
        self.stdout.write(f'  {pair_count} new pairs created (21 total expected)')

        self.stdout.write('Seeding default users...')

        # Admin
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser(
                username='admin',
                email='admin@tnschools.gov.in',
                password='Admin@1234',
                role=User.ROLE_ADMIN,
                first_name='CMS',
                last_name='Admin',
            )
            self.stdout.write('  Created admin user: admin / Admin@1234')
        else:
            self.stdout.write('  Admin user already exists')

        # One POC per unit
        for slug, unit in unit_objs.items():
            username = f'poc_{slug}'
            if not User.objects.filter(username=username).exists():
                User.objects.create_user(
                    username=username,
                    email=f'{slug}@tnschools.gov.in',
                    password='Poc@1234',
                    role=User.ROLE_POC,
                    unit=unit,
                    first_name=unit.abbr,
                    last_name='POC',
                )
                self.stdout.write(f'  Created POC: {username} / Poc@1234')

        self.stdout.write(self.style.SUCCESS('Seed complete.'))
