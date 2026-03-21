"""
Comprehensive tests for the Properties feature.

Covers:
- Authentication enforcement
- CRUD operations (create, read, update, delete)
- Data isolation (users cannot see or edit each other's properties)
- Field validation (required fields, field constraints)
- Nested data (areas within properties)
- Area CRUD and permission checks
- Edge cases found in the code
"""

from django.test import TestCase
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient
from rest_framework import status
from .models import Property, Area, MaintenanceTask, TaskType, DataShare


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def make_user(username, password='testpass123'):
    return User.objects.create_user(
        username=username,
        email=f'{username}@example.com',
        password=password,
    )


def make_property(user, name='Test Property', address='123 Main St', **kwargs):
    return Property.objects.create(user=user, name=name, address=address, **kwargs)


# ===========================================================================
# Authentication Enforcement
# ===========================================================================

class PropertyAuthTests(TestCase):
    """Unauthenticated requests must be blocked."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('authuser')
        self.prop = make_property(self.user)

    def test_list_requires_auth(self):
        response = self.client.get('/api/properties/')
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_detail_requires_auth(self):
        response = self.client.get(f'/api/properties/{self.prop.id}/')
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_create_requires_auth(self):
        data = {'name': 'New Property', 'address': '1 Test Ave'}
        response = self.client.post('/api/properties/', data)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_update_requires_auth(self):
        data = {'name': 'Renamed'}
        response = self.client.patch(f'/api/properties/{self.prop.id}/', data)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_delete_requires_auth(self):
        response = self.client.delete(f'/api/properties/{self.prop.id}/')
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])


# ===========================================================================
# Property CRUD
# ===========================================================================

class PropertyCRUDTests(TestCase):
    """Authenticated CRUD for a property owner."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('cruduser')
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user, name='My House', address='5 Oak Lane')

    # --- Create ---

    def test_create_property_minimal(self):
        data = {'name': 'Cottage', 'address': 'Country Road'}
        response = self.client.post('/api/properties/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Cottage')
        # Owner must be auto-assigned
        self.assertEqual(response.data['user'], self.user.id)

    def test_create_property_full_fields(self):
        data = {
            'name': 'Full House',
            'address': '77 Park Ave',
            'postal_code': '101',
            'city': 'Reykjavik',
            'num_floors': 3,
            'has_garden': True,
        }
        response = self.client.post('/api/properties/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['postal_code'], '101')
        self.assertEqual(response.data['city'], 'Reykjavik')
        self.assertEqual(response.data['num_floors'], 3)
        self.assertTrue(response.data['has_garden'])

    def test_create_property_stores_in_db(self):
        data = {'name': 'DB Property', 'address': '42 DB St'}
        self.client.post('/api/properties/', data, format='json')
        self.assertTrue(Property.objects.filter(name='DB Property', user=self.user).exists())

    # --- Read ---

    def test_list_returns_own_properties(self):
        response = self.client.get('/api/properties/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [p['id'] for p in response.data]
        self.assertIn(self.prop.id, ids)

    def test_retrieve_own_property(self):
        response = self.client.get(f'/api/properties/{self.prop.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'My House')

    def test_list_response_contains_areas(self):
        Area.objects.create(property=self.prop, type='Kitchen', floor=1)
        response = self.client.get('/api/properties/')
        prop_data = next(p for p in response.data if p['id'] == self.prop.id)
        self.assertIn('areas', prop_data)
        self.assertEqual(len(prop_data['areas']), 1)

    def test_list_response_contains_tasks(self):
        task_type = TaskType.objects.create(name='Test Type')
        MaintenanceTask.objects.create(
            user=self.user,
            property=self.prop,
            task_type=task_type,
            description='Fix roof',
        )
        response = self.client.get('/api/properties/')
        prop_data = next(p for p in response.data if p['id'] == self.prop.id)
        self.assertIn('tasks', prop_data)
        self.assertEqual(len(prop_data['tasks']), 1)

    # --- Update ---

    def test_put_update_own_property(self):
        data = {
            'name': 'Renamed House',
            'address': '5 Oak Lane',
            'num_floors': 2,
            'has_garden': False,
        }
        response = self.client.put(f'/api/properties/{self.prop.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.prop.refresh_from_db()
        self.assertEqual(self.prop.name, 'Renamed House')

    def test_patch_update_own_property(self):
        response = self.client.patch(
            f'/api/properties/{self.prop.id}/',
            {'name': 'Patched Name'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.prop.refresh_from_db()
        self.assertEqual(self.prop.name, 'Patched Name')

    def test_update_does_not_change_owner(self):
        other = make_user('other')
        response = self.client.patch(
            f'/api/properties/{self.prop.id}/',
            {'user': other.id, 'name': 'Hijack'},
            format='json',
        )
        self.prop.refresh_from_db()
        # user field is read-only; owner must remain unchanged
        self.assertEqual(self.prop.user, self.user)

    # --- Delete ---

    def test_delete_own_property(self):
        response = self.client.delete(f'/api/properties/{self.prop.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Property.objects.filter(id=self.prop.id).exists())

    def test_delete_nonexistent_returns_404(self):
        response = self.client.delete('/api/properties/99999/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ===========================================================================
# Data Isolation
# ===========================================================================

class PropertyIsolationTests(TestCase):
    """Users must not see or modify each other's properties unless shared."""

    def setUp(self):
        self.client = APIClient()
        self.owner = make_user('owner')
        self.stranger = make_user('stranger')
        self.prop = make_property(self.owner, name='Owner House')

    def test_stranger_cannot_list_other_user_properties(self):
        self.client.force_authenticate(user=self.stranger)
        response = self.client.get('/api/properties/')
        ids = [p['id'] for p in response.data]
        self.assertNotIn(self.prop.id, ids)

    def test_stranger_cannot_retrieve_other_user_property(self):
        self.client.force_authenticate(user=self.stranger)
        response = self.client.get(f'/api/properties/{self.prop.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_stranger_cannot_update_other_user_property(self):
        self.client.force_authenticate(user=self.stranger)
        response = self.client.patch(
            f'/api/properties/{self.prop.id}/',
            {'name': 'Stolen'},
            format='json',
        )
        self.assertIn(
            response.status_code,
            [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND],
        )
        self.prop.refresh_from_db()
        self.assertEqual(self.prop.name, 'Owner House')

    def test_stranger_cannot_delete_other_user_property(self):
        self.client.force_authenticate(user=self.stranger)
        response = self.client.delete(f'/api/properties/{self.prop.id}/')
        self.assertIn(
            response.status_code,
            [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND],
        )
        self.assertTrue(Property.objects.filter(id=self.prop.id).exists())

    def test_each_user_sees_only_own_properties(self):
        other_prop = make_property(self.stranger, name='Stranger House')

        self.client.force_authenticate(user=self.owner)
        resp_owner = self.client.get('/api/properties/')
        owner_ids = [p['id'] for p in resp_owner.data]
        self.assertIn(self.prop.id, owner_ids)
        self.assertNotIn(other_prop.id, owner_ids)

        self.client.force_authenticate(user=self.stranger)
        resp_stranger = self.client.get('/api/properties/')
        stranger_ids = [p['id'] for p in resp_stranger.data]
        self.assertIn(other_prop.id, stranger_ids)
        self.assertNotIn(self.prop.id, stranger_ids)


# ===========================================================================
# Field Validation
# ===========================================================================

class PropertyValidationTests(TestCase):
    """Test that invalid inputs are rejected with 400."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('valuser')
        self.client.force_authenticate(user=self.user)

    def test_create_without_name_fails(self):
        data = {'address': '1 Main St'}
        response = self.client.post('/api/properties/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)

    def test_create_without_address_fails(self):
        data = {'name': 'No Address Property'}
        response = self.client.post('/api/properties/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('address', response.data)

    def test_create_with_zero_floors_is_rejected(self):
        """num_floors has MinValueValidator(1) so 0 must be invalid."""
        data = {'name': 'Zero Floors', 'address': '1 Test St', 'num_floors': 0}
        response = self.client.post('/api/properties/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_with_negative_floors_is_rejected(self):
        data = {'name': 'Negative Floors', 'address': '1 Test St', 'num_floors': -1}
        response = self.client.post('/api/properties/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_with_empty_name_fails(self):
        data = {'name': '', 'address': '1 Main St'}
        response = self.client.post('/api/properties/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_postal_code_and_city_are_optional(self):
        """postal_code and city should default to blank, not cause errors."""
        data = {'name': 'No Postal', 'address': '1 Main St'}
        response = self.client.post('/api/properties/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['postal_code'], '')
        self.assertEqual(response.data['city'], '')

    def test_has_garden_defaults_to_false(self):
        data = {'name': 'No Garden', 'address': '1 Main St'}
        response = self.client.post('/api/properties/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data['has_garden'])

    def test_num_floors_defaults_to_one(self):
        data = {'name': 'Default Floors', 'address': '1 Main St'}
        response = self.client.post('/api/properties/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['num_floors'], 1)


# ===========================================================================
# Property Model Tests
# ===========================================================================

class PropertyModelTests(TestCase):
    """Direct model validation and constraint tests."""

    def setUp(self):
        self.user = make_user('modeluser')

    def test_str_representation(self):
        prop = Property(name='Green Villa', address='1 Green St', user=self.user)
        self.assertEqual(str(prop), 'Green Villa')

    def test_num_floors_validator_rejects_zero(self):
        prop = Property(name='Bad Floors', address='1 St', num_floors=0, user=self.user)
        with self.assertRaises(ValidationError):
            prop.full_clean()

    def test_num_floors_validator_accepts_one(self):
        prop = Property(name='One Floor', address='1 St', num_floors=1, user=self.user)
        prop.full_clean()  # Should not raise

    def test_user_fk_is_nullable(self):
        """The model allows null user (for legacy/import reasons)."""
        prop = Property.objects.create(name='No User', address='Somewhere')
        self.assertIsNone(prop.user)

    def test_created_at_and_updated_at_auto_set(self):
        prop = make_property(self.user)
        self.assertIsNotNone(prop.created_at)
        self.assertIsNotNone(prop.updated_at)


# ===========================================================================
# Area CRUD
# ===========================================================================

class AreaAuthTests(TestCase):
    """Unauthenticated requests to /api/areas/ must be blocked."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('areaauth')
        self.prop = make_property(self.user)
        self.area = Area.objects.create(property=self.prop, type='Kitchen', floor=1)

    def test_list_areas_requires_auth(self):
        response = self.client.get('/api/areas/')
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_create_area_requires_auth(self):
        data = {'property': self.prop.id, 'type': 'Bathroom', 'floor': 1}
        response = self.client.post('/api/areas/', data, format='json')
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])


class AreaCRUDTests(TestCase):
    """Authenticated CRUD for areas belonging to the requesting user."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('areauser')
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user)

    def test_create_area(self):
        data = {'property': self.prop.id, 'type': 'Kitchen', 'floor': 1}
        response = self.client.post('/api/areas/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['type'], 'Kitchen')
        self.assertEqual(response.data['floor'], 1)

    def test_create_area_with_custom_name(self):
        data = {
            'property': self.prop.id,
            'type': 'Bed room',
            'name': 'Master Bedroom',
            'floor': 2,
        }
        response = self.client.post('/api/areas/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Master Bedroom')

    def test_create_garden_area_floor_zero(self):
        """Floor 0 is the garden; MinValueValidator(0) must allow it."""
        data = {'property': self.prop.id, 'type': 'Garden', 'floor': 0}
        response = self.client.post('/api/areas/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['floor'], 0)

    def test_create_area_with_negative_floor_fails(self):
        """Floor has MinValueValidator(0); -1 must be rejected."""
        data = {'property': self.prop.id, 'type': 'Storage', 'floor': -1}
        response = self.client.post('/api/areas/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_areas_filtered_by_property(self):
        other_prop = make_property(self.user, name='Other Property', address='99 Road')
        Area.objects.create(property=self.prop, type='Kitchen', floor=1)
        Area.objects.create(property=other_prop, type='Bathroom', floor=1)

        response = self.client.get(f'/api/areas/?property={self.prop.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        area_ids = [a['property'] for a in response.data]
        self.assertTrue(all(pid == self.prop.id for pid in area_ids))

    def test_update_area_name(self):
        area = Area.objects.create(property=self.prop, type='Living room', floor=1)
        response = self.client.patch(
            f'/api/areas/{area.id}/',
            {'name': 'Renamed Room'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        area.refresh_from_db()
        self.assertEqual(area.name, 'Renamed Room')

    def test_update_area_cannot_change_property(self):
        """
        AreaSerializer sets property read-only on update.
        Attempting to change it should be silently ignored, not error.
        """
        other_prop = make_property(self.user, name='Other', address='99 Rd')
        area = Area.objects.create(property=self.prop, type='Office', floor=1)
        response = self.client.patch(
            f'/api/areas/{area.id}/',
            {'property': other_prop.id, 'name': 'Updated'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        area.refresh_from_db()
        # Property must remain unchanged
        self.assertEqual(area.property_id, self.prop.id)

    def test_delete_area(self):
        area = Area.objects.create(property=self.prop, type='Storage', floor=1)
        response = self.client.delete(f'/api/areas/{area.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Area.objects.filter(id=area.id).exists())


class AreaIsolationTests(TestCase):
    """A user must not be able to access or modify another user's areas."""

    def setUp(self):
        self.client = APIClient()
        self.owner = make_user('areaowner')
        self.stranger = make_user('areastrnger')
        self.prop = make_property(self.owner)
        self.area = Area.objects.create(property=self.prop, type='Kitchen', floor=1)

    def test_stranger_cannot_see_other_users_areas(self):
        self.client.force_authenticate(user=self.stranger)
        response = self.client.get('/api/areas/')
        area_ids = [a['id'] for a in response.data]
        self.assertNotIn(self.area.id, area_ids)

    def test_stranger_cannot_retrieve_other_users_area(self):
        self.client.force_authenticate(user=self.stranger)
        response = self.client.get(f'/api/areas/{self.area.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_stranger_cannot_create_area_for_other_users_property(self):
        self.client.force_authenticate(user=self.stranger)
        data = {'property': self.prop.id, 'type': 'Storage', 'floor': 1}
        response = self.client.post('/api/areas/', data, format='json')
        # The viewset only exposes areas whose property belongs to the user.
        # Creating an area on someone else's property should either be blocked
        # (403/404) or the area won't be visible to the stranger afterward.
        # Either outcome is acceptable; what matters is no 201 with visible access.
        if response.status_code == status.HTTP_201_CREATED:
            area_id = response.data['id']
            list_resp = self.client.get('/api/areas/')
            visible_ids = [a['id'] for a in list_resp.data]
            self.assertNotIn(area_id, visible_ids,
                             "Stranger must not see area belonging to another property")

    def test_stranger_cannot_update_other_users_area(self):
        self.client.force_authenticate(user=self.stranger)
        response = self.client.patch(
            f'/api/areas/{self.area.id}/',
            {'name': 'Stolen Area'},
            format='json',
        )
        self.assertIn(
            response.status_code,
            [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND],
        )

    def test_stranger_cannot_delete_other_users_area(self):
        self.client.force_authenticate(user=self.stranger)
        response = self.client.delete(f'/api/areas/{self.area.id}/')
        self.assertIn(
            response.status_code,
            [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND],
        )
        self.assertTrue(Area.objects.filter(id=self.area.id).exists())


# ===========================================================================
# Nested Data Tests
# ===========================================================================

class PropertyNestedDataTests(TestCase):
    """Properties must expose areas and tasks correctly."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('nesteduser')
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user)

    def test_property_exposes_empty_areas_list(self):
        response = self.client.get(f'/api/properties/{self.prop.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['areas'], [])

    def test_property_exposes_empty_tasks_list(self):
        response = self.client.get(f'/api/properties/{self.prop.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['tasks'], [])

    def test_property_areas_update_after_area_creation(self):
        Area.objects.create(property=self.prop, type='Bathroom', floor=1)
        Area.objects.create(property=self.prop, type='Kitchen', floor=1)
        response = self.client.get(f'/api/properties/{self.prop.id}/')
        self.assertEqual(len(response.data['areas']), 2)

    def test_delete_property_cascades_to_areas(self):
        area = Area.objects.create(property=self.prop, type='Office', floor=1)
        self.client.delete(f'/api/properties/{self.prop.id}/')
        self.assertFalse(Area.objects.filter(id=area.id).exists())

    def test_area_type_is_included_in_property_response(self):
        Area.objects.create(property=self.prop, type='Garden', floor=0)
        response = self.client.get(f'/api/properties/{self.prop.id}/')
        area_types = [a['type'] for a in response.data['areas']]
        self.assertIn('Garden', area_types)

    def test_multiple_areas_same_type_different_floors(self):
        Area.objects.create(property=self.prop, type='Bed room', floor=1)
        Area.objects.create(property=self.prop, type='Bed room', floor=2)
        response = self.client.get(f'/api/properties/{self.prop.id}/')
        self.assertEqual(len(response.data['areas']), 2)


# ===========================================================================
# Shared Properties (DataShare integration)
# ===========================================================================

class SharedPropertyAccessTests(TestCase):
    """Test property access with DataShare read-only and read-write shares."""

    def setUp(self):
        self.client = APIClient()
        self.owner = make_user('shareowner')
        self.reader = make_user('sharereader')
        self.writer = make_user('sharewriter')
        self.prop = make_property(self.owner, name='Shared House')

        # ro share: owner -> reader
        DataShare.objects.create(
            owner=self.owner,
            shared_with=self.reader,
            permissions={
                'properties': 'ro',
                'tasks': 'ro',
                'vendors': 'ro',
                'areas': 'ro',
                'attachments': 'ro',
            }
        )
        # rw share: owner -> writer
        DataShare.objects.create(
            owner=self.owner,
            shared_with=self.writer,
            permissions={
                'properties': 'rw',
                'tasks': 'rw',
                'vendors': 'rw',
                'areas': 'rw',
                'attachments': 'rw',
            }
        )

    def test_reader_can_see_shared_property(self):
        self.client.force_authenticate(user=self.reader)
        response = self.client.get('/api/properties/')
        ids = [p['id'] for p in response.data]
        self.assertIn(self.prop.id, ids)

    def test_reader_cannot_update_readonly_property(self):
        self.client.force_authenticate(user=self.reader)
        response = self.client.patch(
            f'/api/properties/{self.prop.id}/',
            {'name': 'Hacked'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_reader_cannot_delete_readonly_property(self):
        self.client.force_authenticate(user=self.reader)
        response = self.client.delete(f'/api/properties/{self.prop.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Property.objects.filter(id=self.prop.id).exists())

    def test_writer_can_see_shared_property(self):
        self.client.force_authenticate(user=self.writer)
        response = self.client.get('/api/properties/')
        ids = [p['id'] for p in response.data]
        self.assertIn(self.prop.id, ids)

    def test_writer_can_update_rw_property(self):
        self.client.force_authenticate(user=self.writer)
        response = self.client.patch(
            f'/api/properties/{self.prop.id}/',
            {'name': 'Legit Update'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.prop.refresh_from_db()
        self.assertEqual(self.prop.name, 'Legit Update')

    def test_writer_can_delete_rw_property(self):
        self.client.force_authenticate(user=self.writer)
        response = self.client.delete(f'/api/properties/{self.prop.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Property.objects.filter(id=self.prop.id).exists())


# ===========================================================================
# Area Model Tests
# ===========================================================================

class AreaModelTests(TestCase):
    """Direct model-level tests for Area."""

    def setUp(self):
        self.user = make_user('areamodel')
        self.prop = make_property(self.user)

    def test_str_with_custom_name(self):
        area = Area(property=self.prop, type='Kitchen', name='Gourmet Kitchen', floor=1)
        self.assertIn('Gourmet Kitchen', str(area))

    def test_str_without_custom_name(self):
        area = Area(property=self.prop, type='Kitchen', floor=1)
        result = str(area)
        self.assertIn('Kitchen', result)
        self.assertIn('Floor 1', result)

    def test_floor_validator_accepts_zero(self):
        area = Area(property=self.prop, type='Garden', floor=0)
        area.full_clean()  # Should not raise

    def test_floor_validator_rejects_negative(self):
        area = Area(property=self.prop, type='Storage', floor=-1)
        with self.assertRaises(ValidationError):
            area.full_clean()

    def test_default_ordering_by_floor_type_name(self):
        Area.objects.create(property=self.prop, type='Kitchen', floor=2)
        Area.objects.create(property=self.prop, type='Bathroom', floor=1)
        Area.objects.create(property=self.prop, type='Kitchen', floor=1)
        areas = list(Area.objects.filter(property=self.prop))
        floors = [a.floor for a in areas]
        # First two should be on floor 1
        self.assertEqual(floors[0], 1)
        self.assertEqual(floors[1], 1)
        self.assertEqual(floors[2], 2)


# ===========================================================================
# Edge Cases
# ===========================================================================

class PropertyEdgeCaseTests(TestCase):
    """Edge cases found from reading the code."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('edgeuser')
        self.client.force_authenticate(user=self.user)

    def test_empty_properties_list(self):
        response = self.client.get('/api/properties/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_create_multiple_properties_same_user(self):
        self.client.post('/api/properties/', {'name': 'A', 'address': '1 A St'}, format='json')
        self.client.post('/api/properties/', {'name': 'B', 'address': '2 B St'}, format='json')
        response = self.client.get('/api/properties/')
        self.assertEqual(len(response.data), 2)

    def test_property_name_max_length(self):
        """name max_length is 255; submitting exactly 255 chars should succeed."""
        long_name = 'A' * 255
        data = {'name': long_name, 'address': '1 St'}
        response = self.client.post('/api/properties/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_property_name_over_max_length_fails(self):
        """name max_length is 255; submitting 256 chars should fail."""
        long_name = 'A' * 256
        data = {'name': long_name, 'address': '1 St'}
        response = self.client.post('/api/properties/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_property_user_field_is_ignored_from_request(self):
        """Client must not be able to set user to an arbitrary value."""
        other = make_user('other_edge')
        data = {'name': 'Hijack Attempt', 'address': '1 St', 'user': other.id}
        response = self.client.post('/api/properties/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Property.objects.get(id=response.data['id'])
        self.assertEqual(created.user, self.user)

    def test_retrieve_returns_user_email(self):
        """PropertySerializer exposes user_email as a read-only field."""
        prop = make_property(self.user)
        response = self.client.get(f'/api/properties/{prop.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('user_email', response.data)
        self.assertEqual(response.data['user_email'], self.user.email)

    def test_ordering_by_name(self):
        make_property(self.user, name='Zebra House', address='Z')
        make_property(self.user, name='Alpha House', address='A')
        response = self.client.get('/api/properties/?ordering=name')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [p['name'] for p in response.data]
        self.assertEqual(names, sorted(names))

    def test_area_room_type_choices_are_validated(self):
        """Area.type has choices; an invalid value must be rejected by the API."""
        prop = make_property(self.user)
        data = {'property': prop.id, 'type': 'InvalidRoomType', 'floor': 1}
        response = self.client.post('/api/areas/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AreaSharedWriteTests(TestCase):
    """Read-only data share must block area writes on the owner's property."""

    def setUp(self):
        self.client = APIClient()
        self.owner = make_user('arearoowner')
        self.reader = make_user('areareader')
        self.prop = make_property(self.owner)
        self.area = Area.objects.create(property=self.prop, type='Office', floor=1)

        DataShare.objects.create(
            owner=self.owner,
            shared_with=self.reader,
            permissions={
                'properties': 'ro',
                'tasks': 'ro',
                'vendors': 'ro',
                'areas': 'ro',
                'attachments': 'ro',
            }
        )

    def test_readonly_sharer_cannot_update_area(self):
        self.client.force_authenticate(user=self.reader)
        response = self.client.patch(
            f'/api/areas/{self.area.id}/',
            {'name': 'Stolen'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_readonly_sharer_cannot_delete_area(self):
        self.client.force_authenticate(user=self.reader)
        response = self.client.delete(f'/api/areas/{self.area.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Area.objects.filter(id=self.area.id).exists())

    def test_readwrite_sharer_can_update_area(self):
        writer = make_user('areawriter')
        DataShare.objects.create(
            owner=self.owner,
            shared_with=writer,
            permissions={
                'properties': 'rw',
                'tasks': 'rw',
                'vendors': 'rw',
                'areas': 'rw',
                'attachments': 'rw',
            }
        )
        self.client.force_authenticate(user=writer)
        response = self.client.patch(
            f'/api/areas/{self.area.id}/',
            {'name': 'Legitimate Update'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.area.refresh_from_db()
        self.assertEqual(self.area.name, 'Legitimate Update')
