"""
Management command to seed 50 fake global vendors with meaningful task types
"""
import random
from django.core.management.base import BaseCommand
from maintenance.models import Vendor, TaskType


class Command(BaseCommand):
    help = 'Seed the database with 50 fake global vendors'

    # Vendor data structure: (name, main_speciality, secondary_specialities)
    # Secondary specialities should relate well to main speciality
    VENDOR_DATA = [
        # Plumbing Vendors
        ("QuickFlow Plumbing", "Plumbing", ["General Maintenance", "Carpentry"]),
        ("Emergency Leak Pros", "Plumbing", ["Carpentry", "Flooring"]),
        ("PipeWorks Solutions", "Plumbing", ["General Maintenance"]),
        ("Clear Drain Specialists", "Plumbing", ["General Maintenance", "Other"]),
        ("ProFlow Repairs", "Plumbing", ["Carpentry", "Appliance Repair"]),

        # Electrical Vendors
        ("ElectriPro Solutions", "Electrical", ["General Maintenance", "Security Systems"]),
        ("WireWorks Inc", "Electrical", ["Security Systems", "Appliance Repair"]),
        ("Voltage Masters", "Electrical", ["HVAC", "Appliance Repair"]),
        ("SafeCircuit Electrical", "Electrical", ["General Maintenance", "Security Systems"]),
        ("PowerFlow Systems", "Electrical", ["HVAC", "Appliance Repair"]),

        # HVAC Vendors
        ("Cool Comforts HVAC", "HVAC", ["Electrical", "General Maintenance"]),
        ("Thermal Solutions Inc", "HVAC", ["Electrical", "Appliance Repair"]),
        ("AirFlow Experts", "HVAC", ["Electrical", "Roofing"]),
        ("Climate Control Pro", "HVAC", ["Electrical", "Carpentry"]),
        ("ComfortZone Services", "HVAC", ["Electrical", "General Maintenance"]),

        # Roofing Vendors
        ("RoofPro Specialists", "Roofing", ["Carpentry", "Painting"]),
        ("SkyShield Roofing", "Roofing", ["Carpentry", "Masonry"]),
        ("Peak Performance Roofing", "Roofing", ["Carpentry", "General Maintenance"]),
        ("WeatherGuard Roofs", "Roofing", ["Carpentry", "Painting"]),
        ("Shingle Pros", "Roofing", ["Carpentry", "Masonry"]),

        # Painting Vendors
        ("ColorBurst Painting", "Painting", ["Flooring", "General Maintenance"]),
        ("PerfectCoat Painters", "Painting", ["Carpentry", "Flooring"]),
        ("Artisan Paint Co", "Painting", ["Flooring", "Landscaping"]),
        ("Fresh Look Painting", "Painting", ["Carpentry", "General Maintenance"]),
        ("Premium Paint Services", "Painting", ["Flooring", "Carpentry"]),

        # Flooring Vendors
        ("FloorMaster Solutions", "Flooring", ["Painting", "Carpentry"]),
        ("Stone & Tile Experts", "Flooring", ["Masonry", "Painting"]),
        ("Wood Specialists Inc", "Flooring", ["Carpentry", "Painting"]),
        ("Surface Perfection", "Flooring", ["Cleaning", "Painting"]),
        ("ProSurface Flooring", "Flooring", ["Carpentry", "General Maintenance"]),

        # Carpentry Vendors
        ("Custom Woodworks", "Carpentry", ["Flooring", "Painting"]),
        ("BuildRight Carpentry", "Carpentry", ["Roofing", "Flooring"]),
        ("Quality Carpentry Co", "Carpentry", ["Windows/Doors", "Flooring"]),
        ("Precision Wood Works", "Carpentry", ["Flooring", "Painting"]),
        ("Craftsman Carpentry", "Carpentry", ["Roofing", "Painting"]),

        # Landscaping Vendors
        ("GreenScape Landscaping", "Landscaping", ["Fencing", "General Maintenance"]),
        ("Nature's Best Designs", "Landscaping", ["Fencing", "Cleaning"]),
        ("Outdoor Living Experts", "Landscaping", ["Fencing", "Cleaning"]),
        ("Professional Grounds Care", "Landscaping", ["Fencing", "General Maintenance"]),
        ("EverGreen Solutions", "Landscaping", ["Fencing", "Cleaning"]),

        # Appliance Repair Vendors
        ("ApplianceWorks Pro", "Appliance Repair", ["Electrical", "Plumbing"]),
        ("QuickRepair Services", "Appliance Repair", ["Electrical", "General Maintenance"]),
        ("Expert Appliance Care", "Appliance Repair", ["Electrical", "Carpentry"]),
        ("ReliableRepair Co", "Appliance Repair", ["Electrical", "Plumbing"]),
        ("ServiceMax Appliances", "Appliance Repair", ["Electrical", "HVAC"]),

        # General/Mixed Vendors
        ("HandyPro Services", "General Maintenance", ["Carpentry", "Plumbing", "Electrical"]),
        ("All-Around Maintenance", "General Maintenance", ["Carpentry", "Painting", "Cleaning"]),
        ("Complete Care Solutions", "General Maintenance", ["Carpentry", "Plumbing", "Flooring"]),
        ("TrustedPro Contractors", "General Maintenance", ["Electrical", "Plumbing", "HVAC"]),
        ("Expert Maintenance Inc", "General Maintenance", ["Carpentry", "Painting", "Roofing"]),
    ]

    def handle(self, *args, **options):
        # Get or create a system admin user for global vendors
        from django.contrib.auth.models import User
        
        # Check if global vendors already exist
        if Vendor.objects.filter(is_global=True).exists():
            self.stdout.write(
                self.style.WARNING(
                    f"Global vendors already exist ({Vendor.objects.filter(is_global=True).count()} found). Skipping seed."
                )
            )
            return

        created_count = 0
        premium_count = 0

        for vendor_name, main_speciality_name, secondary_specialities_names in self.VENDOR_DATA:
            try:
                # Get main speciality
                main_speciality = TaskType.objects.get(name=main_speciality_name)

                # Get secondary specialities
                secondary_specialities = []
                for secondary_name in secondary_specialities_names:
                    try:
                        secondary_speciality = TaskType.objects.get(name=secondary_name)
                        secondary_specialities.append(secondary_speciality)
                    except TaskType.DoesNotExist:
                        self.stdout.write(
                            self.style.WARNING(f"Secondary speciality '{secondary_name}' not found for vendor '{vendor_name}'")
                        )

                # Create vendor
                vendor = Vendor.objects.create(
                    name=vendor_name,
                    user=None,  # Global vendors have no owner
                    is_global=True,
                    is_premium=random.choice([True, False, False]),  # ~33% premium
                    speciality=main_speciality,
                    contact_person=self._generate_contact_person(),
                    phone=self._generate_phone(),
                    email=self._generate_email(vendor_name),
                    address=self._generate_address(),
                )

                # Add secondary specialities
                if secondary_specialities:
                    vendor.secondary_specialities.set(secondary_specialities)

                created_count += 1
                if vendor.is_premium:
                    premium_count += 1

                self.stdout.write(
                    self.style.SUCCESS(f"✓ Created: {vendor_name} ({main_speciality_name})")
                )

            except TaskType.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f"✗ Speciality '{main_speciality_name}' not found. Skipping vendor '{vendor_name}'")
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"✗ Error creating vendor '{vendor_name}': {str(e)}")
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\n{'='*60}\n"
                f"Successfully created {created_count} global vendors\n"
                f"Premium vendors: {premium_count}\n"
                f"Regular vendors: {created_count - premium_count}\n"
                f"{'='*60}"
            )
        )

    @staticmethod
    def _generate_contact_person():
        first_names = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'Robert', 'Lisa', 'James', 'Maria']
        last_names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez']
        return f"{random.choice(first_names)} {random.choice(last_names)}"

    @staticmethod
    def _generate_phone():
        return f"+354 {random.randint(400, 899)} {random.randint(1000, 9999)}"

    @staticmethod
    def _generate_email(vendor_name):
        domain = random.choice(['gmail.com', 'company.is', 'mail.is', 'outlook.com', 'info.is'])
        name_part = vendor_name.lower().replace(' ', '').replace('&', 'and')[:15]
        return f"{name_part}@{domain}"

    @staticmethod
    def _generate_address():
        streets = ['Main', 'Oak', 'Elm', 'Maple', 'Pine', 'Cedar', 'Birch', 'Ash']
        street_types = ['Street', 'Road', 'Avenue', 'Drive', 'Lane', 'Court', 'Way', 'Place']
        cities = ['Reykjavik', 'Kópavogur', 'Hafnarfjörður', 'Mosfellsbær', 'Garðabær']
        
        street = f"{random.randint(1, 999)} {random.choice(streets)} {random.choice(street_types)}"
        city = random.choice(cities)
        return f"{street}, {city}"
