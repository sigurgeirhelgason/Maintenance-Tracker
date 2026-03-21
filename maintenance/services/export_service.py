import csv
import io
import logging
import os
import zipfile
import json
from datetime import datetime
from django.core.files.storage import default_storage
from django.conf import settings
from ..models import Property, Area, MaintenanceTask, Vendor, Attachment

logger = logging.getLogger(__name__)


class DatapackExporter:
    """Service to export all user data into a ZIP-packaged datapack with CSV files."""
    
    def __init__(self, user):
        self.user = user
        self.zip_buffer = io.BytesIO()
        self.zip_file = zipfile.ZipFile(self.zip_buffer, 'w', zipfile.ZIP_DEFLATED)
        
    def export(self):
        """
        Export all user data (Properties, Areas, Tasks, Vendors, Attachments) to a ZIP file.
        Returns the ZIP file buffer.
        """
        try:
            # Export metadata first
            self._export_metadata()
            
            # Export data in dependency order
            self._export_properties()
            self._export_areas()
            self._export_vendors()
            self._export_tasks()
            self._export_task_areas()  # Junction table for M:M relationship
            self._export_attachments()
            
            self.zip_file.close()
            self.zip_buffer.seek(0)
            return self.zip_buffer
        except Exception as e:
            self.zip_file.close()
            raise e
    
    def _export_metadata(self):
        """Export metadata about the datapack."""
        metadata = {
            "export_date": datetime.now().isoformat(),
            "django_version": "4.2",  # or detect from Django
            "app_version": "1.0",
            "user_id": self.user.id,
            "username": self.user.username,
        }
        metadata_json = json.dumps(metadata, indent=2)
        self.zip_file.writestr('DatapackMetadata.json', metadata_json)
    
    def _export_properties(self):
        """Export all user properties to CSV."""
        properties = Property.objects.filter(user=self.user).order_by('id')
        
        if not properties.exists():
            # Still create empty CSV with headers
            self._write_properties_csv([])
            return
        
        self._write_properties_csv(properties)
    
    def _write_properties_csv(self, properties):
        """Write properties to CSV file."""
        csv_buffer = io.StringIO()
        fieldnames = ['id', 'name', 'address', 'num_floors', 'has_garden', 'image', 'created_at', 'updated_at']
        writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames)
        writer.writeheader()
        
        for prop in properties:
            # Get image filename if exists, else empty
            image_filename = prop.image.name if prop.image else ''
            
            writer.writerow({
                'id': prop.id,
                'name': prop.name,
                'address': prop.address,
                'num_floors': prop.num_floors,
                'has_garden': prop.has_garden,
                'image': image_filename,
                'created_at': prop.created_at.isoformat(),
                'updated_at': prop.updated_at.isoformat(),
            })
            
            # Add image file to zip if it exists
            if prop.image:
                self._add_file_to_zip(prop.image, 'property_images/')
        
        self.zip_file.writestr('properties.csv', csv_buffer.getvalue())
    
    def _export_areas(self):
        """Export all user areas to CSV."""
        areas = Area.objects.filter(property__user=self.user).order_by('id')
        
        csv_buffer = io.StringIO()
        fieldnames = ['id', 'property_id', 'type', 'name', 'floor', 'description', 'created_at', 'updated_at']
        writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames)
        writer.writeheader()
        
        for area in areas:
            writer.writerow({
                'id': area.id,
                'property_id': area.property_id,
                'type': area.type,
                'name': area.name or '',
                'floor': area.floor,
                'description': area.description or '',
                'created_at': area.created_at.isoformat(),
                'updated_at': area.updated_at.isoformat(),
            })
        
        self.zip_file.writestr('areas.csv', csv_buffer.getvalue())
    
    def _export_vendors(self):
        """Export all user vendors to CSV."""
        vendors = Vendor.objects.filter(user=self.user).order_by('id')
        
        csv_buffer = io.StringIO()
        fieldnames = ['id', 'name', 'contact_person', 'phone', 'email', 'address', 'favorite', 'task_type_id', 'created_at', 'updated_at']
        writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames)
        writer.writeheader()
        
        for vendor in vendors:
            writer.writerow({
                'id': vendor.id,
                'name': vendor.name,
                'contact_person': vendor.contact_person or '',
                'phone': vendor.phone or '',
                'email': vendor.email or '',
                'address': vendor.address or '',
                'favorite': vendor.favorite,
                'task_type_id': vendor.task_type_id or '',
                'created_at': vendor.created_at.isoformat(),
                'updated_at': vendor.updated_at.isoformat(),
            })
        
        self.zip_file.writestr('vendors.csv', csv_buffer.getvalue())
    
    def _export_tasks(self):
        """Export all user maintenance tasks to CSV."""
        tasks = MaintenanceTask.objects.filter(user=self.user).order_by('id')
        
        csv_buffer = io.StringIO()
        fieldnames = [
            'id', 'property_id', 'description', 'task_type_id', 'vendor_id', 'status',
            'priority', 'due_date', 'estimated_price', 'final_price', 'vat_refund_claimed',
            'price_breakdown', 'currency', 'custom_field_values', 'created_date', 'completed_date',
            'notes', 'created_at', 'updated_at'
        ]
        writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames)
        writer.writeheader()
        
        for task in tasks:
            writer.writerow({
                'id': task.id,
                'property_id': task.property_id or '',
                'description': task.description or '',
                'task_type_id': task.task_type_id or '',
                'vendor_id': task.vendor_id or '',
                'status': task.status,
                'priority': task.priority,
                'due_date': task.due_date.isoformat() if task.due_date else '',
                'estimated_price': task.estimated_price or '',
                'final_price': task.final_price or '',
                'vat_refund_claimed': task.vat_refund_claimed,
                'price_breakdown': json.dumps(task.price_breakdown) if task.price_breakdown else '[]',
                'currency': task.currency or '',
                'custom_field_values': json.dumps(task.custom_field_values) if task.custom_field_values else '{}',
                'created_date': task.created_date.isoformat() if task.created_date else '',
                'completed_date': task.completed_date.isoformat() if task.completed_date else '',
                'notes': task.notes or '',
                'created_at': task.created_at.isoformat(),
                'updated_at': task.updated_at.isoformat(),
            })
        
        self.zip_file.writestr('tasks.csv', csv_buffer.getvalue())
    
    def _export_task_areas(self):
        """Export M:M relationship between tasks and areas to CSV."""
        tasks = MaintenanceTask.objects.filter(user=self.user).prefetch_related('areas')
        
        csv_buffer = io.StringIO()
        fieldnames = ['task_id', 'area_id']
        writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames)
        writer.writeheader()
        
        for task in tasks:
            for area in task.areas.all():
                writer.writerow({
                    'task_id': task.id,
                    'area_id': area.id,
                })
        
        self.zip_file.writestr('task_areas.csv', csv_buffer.getvalue())
    
    def _export_attachments(self):
        """Export all user attachments to CSV and include files."""
        attachments = Attachment.objects.filter(user=self.user).order_by('id')
        
        csv_buffer = io.StringIO()
        fieldnames = ['id', 'task_id', 'file', 'uploaded_at']
        writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames)
        writer.writeheader()
        
        for attachment in attachments:
            # Get file filename
            file_filename = attachment.file.name if attachment.file else ''
            
            writer.writerow({
                'id': attachment.id,
                'task_id': attachment.task_id or '',
                'file': file_filename,
                'uploaded_at': attachment.uploaded_at.isoformat(),
            })
            
            # Add file to zip if it exists
            if attachment.file:
                self._add_file_to_zip(attachment.file, 'attachments/')
        
        self.zip_file.writestr('attachments.csv', csv_buffer.getvalue())
    
    def _add_file_to_zip(self, file_field, folder_prefix):
        """Add a file to the ZIP archive, preserving folder structure."""
        if not file_field:
            return
        
        # Get the relative path of the file
        file_path = file_field.name
        # Create zip path with folder prefix
        zip_path = f"{folder_prefix}{os.path.basename(file_path)}"
        
        # Read file content
        try:
            file_content = file_field.read()
            self.zip_file.writestr(zip_path, file_content)
        except Exception as e:
            logger.warning("Could not add file %s to export ZIP: %s", zip_path, e)
