
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'property_maintenance.settings')
django.setup()

from maintenance.models import TaskType

def init_tasktypes():
    task_types = [
        ("Plumbing", []),
        ("Electrical", []),
        ("HVAC", ["Unit Model", "Last Service Date"]),
        ("Roofing", ["Material Type"]),
        ("Painting", ["Brand", "Color Name", "Color Code"]),
        ("Flooring", ["Material", "Total Square Meters"]),
        ("Carpentry", ["Wood Type"]),
        ("Landscaping", []),
        ("Cleaning", []),
        ("General Maintenance", []),
        ("Pest Control", []),
        ("Appliance Repair", ["Appliance Style", "Model Number"]),
        ("Windows/Doors", ["Glazing Type"]),
        ("Masonry", []),
        ("Fencing", ["Height", "Material"]),
        ("Pool Maintenance", []),
        ("Security Systems", ["System Brand"]),
        ("Other", [])
    ]

    for name, fields in task_types:
        obj, created = TaskType.objects.get_or_create(
            name=name,
            defaults={'is_predefined': True, 'custom_field_definitions': fields}
        )
        if not created:
            # Update fields if it was predefined
            obj.custom_field_definitions = fields
            obj.is_predefined = True
            obj.save()
            print(f"Updated task type: {name}")
        else:
            print(f"Created task type: {name}")

if __name__ == "__main__":
    init_tasktypes()
