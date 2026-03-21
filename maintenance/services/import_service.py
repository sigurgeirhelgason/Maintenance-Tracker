import csv
import io
import logging
import os
import zipfile
import json
from datetime import datetime
from django.core.files.base import ContentFile
from django.db import transaction
from ..models import Property, Area, MaintenanceTask, Vendor, Attachment, TaskType

logger = logging.getLogger(__name__)


class DatapackImporter:
    """Service to import datapack ZIP files containing CSV exports of user data."""
    
    REQUIRED_CSV_FILES = ['properties.csv', 'areas.csv', 'vendors.csv', 'tasks.csv', 'task_areas.csv', 'attachments.csv']
    
    def __init__(self, user):
        self.user = user
        self.import_summary = {
            'properties_created': 0,
            'properties_updated': 0,
            'areas_created': 0,
            'areas_updated': 0,
            'vendors_created': 0,
            'vendors_updated': 0,
            'tasks_created': 0,
            'tasks_updated': 0,
            'attachments_created': 0,
            'attachments_updated': 0,
            'files_restored': 0,
            'errors': []
        }
        # Map old IDs to new IDs for relationship fixing
        self.id_mapping = {
            'properties': {},
            'areas': {},
            'vendors': {},
            'tasks': {},
        }
    
    def import_datapack(self, zip_file):
        """
        Import a ZIP datapack file for the current user.
        Returns import_summary dict with counts and any errors.
        """
        try:
            with zipfile.ZipFile(zip_file, 'r') as zf:
                # Validate ZIP structure
                self._validate_zip_structure(zf)
                
                # Use transaction to rollback everything if any error occurs
                with transaction.atomic():
                    # Import in dependency order
                    self._import_properties(zf)
                    self._import_areas(zf)
                    self._import_vendors(zf)
                    self._import_tasks(zf)
                    self._import_task_areas(zf)
                    self._import_attachments(zf)
        except Exception as e:
            logger.warning("Datapack import failed for user %s: %s", self.user.pk, e)
            self.import_summary['errors'].append(str(e))
            raise e

        return self.import_summary
    
    def _validate_zip_structure(self, zf):
        """Validate that all required CSV files exist in the ZIP."""
        zip_files = zf.namelist()
        for required_file in self.REQUIRED_CSV_FILES:
            if required_file not in zip_files:
                raise ValueError(f"Missing required file in datapack: {required_file}")
    
    def _import_properties(self, zf):
        """Import properties from CSV. Create new or update existing."""
        csv_content = zf.read('properties.csv').decode('utf-8')
        csv_buffer = io.StringIO(csv_content)
        reader = csv.DictReader(csv_buffer)
        
        for row in reader:
            try:
                old_id = int(row['id'])
                property_data = {
                    'name': row['name'],
                    'address': row['address'],
                    'num_floors': int(row['num_floors']),
                    'has_garden': row['has_garden'].lower() == 'true',
                    'user': self.user,
                }
                
                # Try to find existing property by name + user
                existing = Property.objects.filter(user=self.user, name=row['name']).first()
                
                if existing:
                    # Update existing
                    for key, value in property_data.items():
                        setattr(existing, key, value)
                    existing.save()
                    self.id_mapping['properties'][old_id] = existing.id
                    self.import_summary['properties_updated'] += 1
                else:
                    # Create new
                    prop = Property.objects.create(**property_data)
                    self.id_mapping['properties'][old_id] = prop.id
                    self.import_summary['properties_created'] += 1
                
                # Handle property image if it exists
                image_filename = row.get('image', '')
                if image_filename:
                    self._restore_file(zf, f'property_images/{os.path.basename(image_filename)}', 
                                     existing if existing else prop, 'image')
            except Exception as e:
                self.import_summary['errors'].append(f"Error importing property {row.get('name', 'unknown')}: {str(e)}")
    
    def _import_areas(self, zf):
        """Import areas from CSV. Create new or update existing."""
        csv_content = zf.read('areas.csv').decode('utf-8')
        csv_buffer = io.StringIO(csv_content)
        reader = csv.DictReader(csv_buffer)
        
        for row in reader:
            try:
                old_id = int(row['id'])
                old_property_id = int(row['property_id'])
                
                # Map old property ID to new
                new_property_id = self.id_mapping['properties'].get(old_property_id)
                if not new_property_id:
                    self.import_summary['errors'].append(f"Property ID {old_property_id} not found for area {row.get('name', 'unknown')}")
                    continue
                
                property_obj = Property.objects.get(id=new_property_id)
                
                area_data = {
                    'property': property_obj,
                    'type': row['type'],
                    'name': row.get('name', '') or None,
                    'floor': int(row['floor']),
                    'description': row.get('description', ''),
                }
                
                # Try to find existing area by property + type + name + floor
                existing = Area.objects.filter(
                    property=property_obj,
                    type=row['type'],
                    name=row.get('name', '') or None,
                    floor=int(row['floor'])
                ).first()
                
                if existing:
                    # Update existing
                    for key, value in area_data.items():
                        setattr(existing, key, value)
                    existing.save()
                    self.id_mapping['areas'][old_id] = existing.id
                    self.import_summary['areas_updated'] += 1
                else:
                    # Create new
                    area = Area.objects.create(**area_data)
                    self.id_mapping['areas'][old_id] = area.id
                    self.import_summary['areas_created'] += 1
            except Exception as e:
                self.import_summary['errors'].append(f"Error importing area {row.get('name', 'unknown')}: {str(e)}")
    
    def _import_vendors(self, zf):
        """Import vendors from CSV. Create new or update existing."""
        csv_content = zf.read('vendors.csv').decode('utf-8')
        csv_buffer = io.StringIO(csv_content)
        reader = csv.DictReader(csv_buffer)
        
        for row in reader:
            try:
                old_id = int(row['id'])
                
                vendor_data = {
                    'name': row['name'],
                    'contact_person': row.get('contact_person', ''),
                    'phone': row.get('phone', ''),
                    'email': row.get('email', ''),
                    'address': row.get('address', ''),
                    'favorite': row.get('favorite', 'false').lower() == 'true',
                    'user': self.user,
                }
                
                # Add task_type if it was set (by ID, assuming it still exists)
                task_type_id = row.get('task_type_id', '')
                if task_type_id:
                    try:
                        vendor_data['task_type'] = TaskType.objects.get(id=int(task_type_id))
                    except (TaskType.DoesNotExist, ValueError):
                        # Task type doesn't exist in this system, skip it
                        pass
                
                # Try to find existing vendor by email + user (if email exists), else by name + user
                existing = None
                if vendor_data['email']:
                    existing = Vendor.objects.filter(
                        user=self.user,
                        email=vendor_data['email']
                    ).first()
                
                if not existing:
                    existing = Vendor.objects.filter(
                        user=self.user,
                        name=vendor_data['name']
                    ).first()
                
                if existing:
                    # Update existing
                    for key, value in vendor_data.items():
                        setattr(existing, key, value)
                    existing.save()
                    self.id_mapping['vendors'][old_id] = existing.id
                    self.import_summary['vendors_updated'] += 1
                else:
                    # Create new
                    vendor = Vendor.objects.create(**vendor_data)
                    self.id_mapping['vendors'][old_id] = vendor.id
                    self.import_summary['vendors_created'] += 1
            except Exception as e:
                self.import_summary['errors'].append(f"Error importing vendor {row.get('name', 'unknown')}: {str(e)}")
    
    def _import_tasks(self, zf):
        """Import maintenance tasks from CSV. Create new or update existing."""
        csv_content = zf.read('tasks.csv').decode('utf-8')
        csv_buffer = io.StringIO(csv_content)
        reader = csv.DictReader(csv_buffer)
        
        for row in reader:
            try:
                old_id = int(row['id'])
                
                task_data = {
                    'description': row.get('description', ''),
                    'status': row.get('status', 'pending'),
                    'priority': row.get('priority', 'medium'),
                    'vat_refund_claimed': row.get('vat_refund_claimed', 'false').lower() == 'true',
                    'currency': row.get('currency', 'Kr.'),
                    'notes': row.get('notes', ''),
                    'user': self.user,
                }
                
                # Map optional foreign keys
                property_id = row.get('property_id', '')
                if property_id:
                    new_property_id = self.id_mapping['properties'].get(int(property_id))
                    if new_property_id:
                        task_data['property'] = Property.objects.get(id=new_property_id)
                
                task_type_id = row.get('task_type_id', '')
                if task_type_id:
                    try:
                        task_data['task_type'] = TaskType.objects.get(id=int(task_type_id))
                    except (TaskType.DoesNotExist, ValueError):
                        pass
                
                vendor_id = row.get('vendor_id', '')
                if vendor_id:
                    new_vendor_id = self.id_mapping['vendors'].get(int(vendor_id))
                    if new_vendor_id:
                        task_data['vendor'] = Vendor.objects.get(id=new_vendor_id)
                
                # Handle date fields
                if row.get('due_date'):
                    task_data['due_date'] = row['due_date']
                
                if row.get('created_date'):
                    task_data['created_date'] = row['created_date']
                
                if row.get('completed_date'):
                    task_data['completed_date'] = row['completed_date']
                
                # Handle numeric fields
                if row.get('estimated_price'):
                    task_data['estimated_price'] = int(row['estimated_price'])
                
                if row.get('final_price'):
                    task_data['final_price'] = int(row['final_price'])
                
                # Handle JSON fields
                if row.get('price_breakdown'):
                    try:
                        task_data['price_breakdown'] = json.loads(row['price_breakdown'])
                    except json.JSONDecodeError:
                        task_data['price_breakdown'] = []
                
                if row.get('custom_field_values'):
                    try:
                        task_data['custom_field_values'] = json.loads(row['custom_field_values'])
                    except json.JSONDecodeError:
                        task_data['custom_field_values'] = {}
                
                # Try to find existing task by property + description (if available)
                existing = None
                if 'property' in task_data:
                    existing = MaintenanceTask.objects.filter(
                        user=self.user,
                        property=task_data['property'],
                        description=task_data['description']
                    ).first()
                
                if not existing and task_data['description']:
                    # Try by description + created_date
                    from django.db.models import Q
                    existing = MaintenanceTask.objects.filter(
                        user=self.user,
                        description=task_data['description']
                    ).first()
                
                if existing:
                    # Update existing
                    for key, value in task_data.items():
                        setattr(existing, key, value)
                    existing.save()
                    self.id_mapping['tasks'][old_id] = existing.id
                    self.import_summary['tasks_updated'] += 1
                else:
                    # Create new
                    task = MaintenanceTask.objects.create(**task_data)
                    self.id_mapping['tasks'][old_id] = task.id
                    self.import_summary['tasks_created'] += 1
            except Exception as e:
                self.import_summary['errors'].append(f"Error importing task {row.get('description', 'unknown')}: {str(e)}")
    
    def _import_task_areas(self, zf):
        """Restore M:M relationships between tasks and areas."""
        csv_content = zf.read('task_areas.csv').decode('utf-8')
        csv_buffer = io.StringIO(csv_content)
        reader = csv.DictReader(csv_buffer)
        
        for row in reader:
            try:
                old_task_id = int(row['task_id'])
                old_area_id = int(row['area_id'])
                
                new_task_id = self.id_mapping['tasks'].get(old_task_id)
                new_area_id = self.id_mapping['areas'].get(old_area_id)
                
                if new_task_id and new_area_id:
                    task = MaintenanceTask.objects.get(id=new_task_id)
                    area = Area.objects.get(id=new_area_id)
                    task.areas.add(area)
            except Exception as e:
                self.import_summary['errors'].append(f"Error importing task-area relationship: {str(e)}")
    
    def _import_attachments(self, zf):
        """Import attachments from CSV and restore files."""
        csv_content = zf.read('attachments.csv').decode('utf-8')
        csv_buffer = io.StringIO(csv_content)
        reader = csv.DictReader(csv_buffer)
        
        for row in reader:
            try:
                old_task_id = row.get('task_id', '')
                
                attachment_data = {
                    'user': self.user,
                }
                
                # Map task ID if it exists
                if old_task_id:
                    new_task_id = self.id_mapping['tasks'].get(int(old_task_id))
                    if new_task_id:
                        attachment_data['task'] = MaintenanceTask.objects.get(id=new_task_id)
                
                # Create attachment
                attachment = Attachment.objects.create(**attachment_data)
                
                # Restore file if it exists
                file_filename = row.get('file', '')
                if file_filename:
                    self._restore_file(zf, f'attachments/{os.path.basename(file_filename)}', 
                                     attachment, 'file')
                    self.import_summary['files_restored'] += 1
                
                self.import_summary['attachments_created'] += 1
            except Exception as e:
                self.import_summary['errors'].append(f"Error importing attachment: {str(e)}")
    
    def _restore_file(self, zf, zip_path, model_instance, field_name):
        """Restore a file from ZIP to the file field of a model instance."""
        try:
            if zip_path not in zf.namelist():
                return
            
            file_content = zf.read(zip_path)
            original_filename = os.path.basename(zip_path)
            
            file_field = getattr(model_instance, field_name)
            file_field.save(original_filename, ContentFile(file_content), save=True)
        except Exception as e:
            logger.warning("Error restoring file %s during import: %s", zip_path, e)
            self.import_summary['errors'].append(f"Error restoring file {zip_path}: {str(e)}")
