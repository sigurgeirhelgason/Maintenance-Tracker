import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'property_maintenance.settings')
django.setup()

from maintenance.models import Vendor
from django.db.models import Count

print('GLOBAL VENDORS BY MAIN SPECIALITY:')
print('='*50)

vendors_by_type = Vendor.objects.filter(is_global=True).values('speciality__name').annotate(count=Count('id')).order_by('speciality__name')

speciality_counts = {}
for item in vendors_by_type:
    speciality_name = item.get('speciality__name', 'None')
    count = item['count']
    speciality_counts[speciality_name] = count
    print(f'{speciality_name}: {count} vendors')

total = Vendor.objects.filter(is_global=True).count()
premium = Vendor.objects.filter(is_global=True, is_premium=True).count()
regular = total - premium

print()
print(f'TOTAL GLOBAL VENDORS: {total}')
print(f'PREMIUM VENDORS: {premium}')
print(f'REGULAR VENDORS: {regular}')

print()
print('SAMPLE VENDOR WITH SECONDARY SPECIALITIES:')
print('='*50)
vendor = Vendor.objects.filter(is_global=True).first()
if vendor:
    secondary = ', '.join([t.name for t in vendor.secondary_specialities.all()]) if vendor.secondary_specialities.exists() else 'None'
    print(f'Name: {vendor.name}')
    print(f'Main Speciality: {vendor.speciality.name if vendor.speciality else "None"}')
    print(f'Secondary Specialities: {secondary}')
    print(f'Premium: {vendor.is_premium}')
    print(f'Contact: {vendor.contact_person}')
    print(f'Email: {vendor.email}')
    print(f'Phone: {vendor.phone}')
    print(f'Address: {vendor.address}')
