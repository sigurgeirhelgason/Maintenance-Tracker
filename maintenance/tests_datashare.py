"""
Tests for the data sharing feature
"""
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from .models import DataShare, Property, MaintenanceTask, Vendor, TaskType
from .services.permission_service import can_read, can_write, get_shareable_users


class DataShareModelTest(TestCase):
    """Test DataShare model functionality"""
    
    def setUp(self):
        self.user1 = User.objects.create(username='user1', email='user1@example.com')
        self.user2 = User.objects.create(username='user2', email='user2@example.com')
        self.user3 = User.objects.create(username='user3', email='user3@example.com')
    
    def test_create_datashare(self):
        """Test creating a data share"""
        share = DataShare.objects.create(owner=self.user1, shared_with=self.user2)
        self.assertEqual(share.owner, self.user1)
        self.assertEqual(share.shared_with, self.user2)
        self.assertIsNotNone(share.permissions)
        self.assertEqual(share.permissions.get('properties'), 'rw')
    
    def test_datashare_unique_constraint(self):
        """Test that duplicate shares are prevented"""
        DataShare.objects.create(owner=self.user1, shared_with=self.user2)
        
        with self.assertRaises(Exception):  # IntegrityError
            DataShare.objects.create(owner=self.user1, shared_with=self.user2)
    
    def test_get_permission(self):
        """Test getting permission for a resource type"""
        share = DataShare.objects.create(
            owner=self.user1,
            shared_with=self.user2,
            permissions={'properties': 'rw', 'tasks': 'ro'}
        )
        self.assertEqual(share.get_permission('properties'), 'rw')
        self.assertEqual(share.get_permission('tasks'), 'ro')
        self.assertIsNone(share.get_permission('nonexistent'))


class PermissionServiceTest(TestCase):
    """Test permission service functions"""
    
    def setUp(self):
        self.user1 = User.objects.create(username='user1', email='user1@example.com')
        self.user2 = User.objects.create(username='user2', email='user2@example.com')
        self.user3 = User.objects.create(username='user3', email='user3@example.com')
        
        # Create shares: user1 -> user2 (rw), user3 -> user2 (ro)
        DataShare.objects.create(
            owner=self.user1,
            shared_with=self.user2,
            permissions={
                'properties': 'rw',
                'tasks': 'rw',
                'vendors': 'rw',
                'areas': 'rw',
                'attachments': 'rw'
            }
        )
        DataShare.objects.create(
            owner=self.user3,
            shared_with=self.user2,
            permissions={
                'properties': 'ro',
                'tasks': 'ro',
                'vendors': 'ro',
                'areas': 'ro',
                'attachments': 'ro'
            }
        )
    
    def test_can_read_own_data(self):
        """Test that users can read their own data"""
        self.assertTrue(can_read(self.user1, self.user1, 'properties'))
    
    def test_can_read_shared_data_rw(self):
        """Test that users can read data shared as rw"""
        self.assertTrue(can_read(self.user2, self.user1, 'properties'))
    
    def test_can_read_shared_data_ro(self):
        """Test that users can read data shared as ro"""
        self.assertTrue(can_read(self.user2, self.user3, 'properties'))
    
    def test_cannot_read_unshared_data(self):
        """Test that users cannot read unshared data"""
        self.assertFalse(can_read(self.user3, self.user1, 'properties'))
    
    def test_can_write_own_data(self):
        """Test that users can write their own data"""
        self.assertTrue(can_write(self.user1, self.user1, 'properties'))
    
    def test_can_write_shared_data_rw(self):
        """Test that users can write data shared as rw"""
        self.assertTrue(can_write(self.user2, self.user1, 'properties'))
    
    def test_cannot_write_shared_data_ro(self):
        """Test that users cannot write data shared as ro"""
        self.assertFalse(can_write(self.user2, self.user3, 'properties'))
    
    def test_cannot_write_unshared_data(self):
        """Test that users cannot write unshared data"""
        self.assertFalse(can_write(self.user3, self.user1, 'properties'))
    
    def test_get_shareable_users(self):
        """Test getting list of users whose data should be visible"""
        from .models import Property
        
        # Create a property for each user
        prop1 = Property.objects.create(name='User1 Property', user=self.user1, address='Address 1')
        prop2 = Property.objects.create(name='User2 Property', user=self.user2, address='Address 2')
        prop3 = Property.objects.create(name='User3 Property', user=self.user3, address='Address 3')
        
        q = get_shareable_users(self.user2)
        queryset = Property.objects.filter(q)
        properties = list(queryset)
        
        # user2 should see: prop2 (own), prop1 (rw share from user1), prop3 (ro share from user3)
        self.assertIn(prop2, properties)
        self.assertIn(prop1, properties)
        self.assertIn(prop3, properties)


class DataShareAPITest(TestCase):
    """Test data sharing API endpoints"""
    
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='testpass123'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123'
        )
        
        # Login as user1
        self.client.force_authenticate(user=self.user1)
    
    def test_create_datashare_api(self):
        """Test creating a data share via API"""
        data = {
            'shared_with_email': 'user2@example.com',
            'permissions': {'properties': 'rw', 'tasks': 'ro'}
        }
        response = self.client.post('/api/datashare/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # The response should have the created share data
        self.assertIn('id', response.data)
    
    def test_cannot_share_with_self(self):
        """Test that users cannot share with themselves"""
        data = {
            'shared_with_email': 'user1@example.com',
            'permissions': {'properties': 'rw'}
        }
        response = self.client.post('/api/datashare/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_cannot_share_with_nonexistent_user(self):
        """Test that sharing with nonexistent user fails"""
        data = {
            'shared_with_email': 'nonexistent@example.com',
            'permissions': {'properties': 'rw'}
        }
        response = self.client.post('/api/datashare/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_list_datashares(self):
        """Test listing data shares"""
        DataShare.objects.create(owner=self.user1, shared_with=self.user2)
        response = self.client.get('/api/datashare/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_delete_datashare(self):
        """Test deleting a data share"""
        share = DataShare.objects.create(owner=self.user1, shared_with=self.user2)
        response = self.client.delete(f'/api/datashare/{share.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(DataShare.objects.filter(id=share.id).exists())
    
    def test_cannot_delete_others_share(self):
        """Test that users cannot delete shares they didn't create"""
        share = DataShare.objects.create(owner=self.user2, shared_with=self.user1)
        response = self.client.delete(f'/api/datashare/{share.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class QuerySetSharingTest(TestCase):
    """Test that ViewSets properly include shared data"""
    
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='testpass123'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123'
        )
        
        # Create properties for both users
        self.prop1 = Property.objects.create(name='Property 1', user=self.user1, address='Address 1')
        self.prop2 = Property.objects.create(name='Property 2', user=self.user2, address='Address 2')
        
        # Share user1's data with user2
        DataShare.objects.create(owner=self.user1, shared_with=self.user2)
    
    def test_user_sees_own_properties(self):
        """Test that user sees their own properties"""
        self.client.force_authenticate(user=self.user1)
        response = self.client.get('/api/properties/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should see prop1 (own)
        prop_ids = [p['id'] for p in response.data]
        self.assertIn(self.prop1.id, prop_ids)
    
    def test_user_sees_shared_properties(self):
        """Test that user sees shared properties"""
        self.client.force_authenticate(user=self.user2)
        response = self.client.get('/api/properties/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should see prop2 (own) and prop1 (shared)
        prop_ids = [p['id'] for p in response.data]
        self.assertIn(self.prop2.id, prop_ids)
        self.assertIn(self.prop1.id, prop_ids)
    
    def test_user_cannot_see_unshared_properties(self):
        """Test that user doesn't see properties not shared with them"""
        # Create share without including user3
        user3 = User.objects.create_user(username='user3', email='user3@example.com', password='testpass')
        self.client.force_authenticate(user=user3)
        response = self.client.get('/api/properties/')
        # user3 should not see prop1 or prop2
        prop_ids = [p['id'] for p in response.data]
        self.assertNotIn(self.prop1.id, prop_ids)
        self.assertNotIn(self.prop2.id, prop_ids)


class WritePermissionTest(TestCase):
    """Test that write permissions are enforced"""
    
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='testpass123'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='testpass123'
        )
        
        # Create property for user1
        self.prop1 = Property.objects.create(name='Property 1', user=self.user1, address='Address 1')
        
        # Share with read-only permissions
        DataShare.objects.create(
            owner=self.user1,
            shared_with=self.user2,
            permissions={
                'properties': 'ro',
                'tasks': 'ro',
                'vendors': 'ro',
                'areas': 'ro',
                'attachments': 'ro'
            }
        )
    
    def test_cannot_update_readonly_property(self):
        """Test that users cannot update read-only shared properties"""
        self.client.force_authenticate(user=self.user2)
        data = {'name': 'Updated Property'}
        response = self.client.patch(f'/api/properties/{self.prop1.id}/', data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_can_update_rw_property(self):
        """Test that users can update read-write shared properties"""
        # Change share to rw
        share = DataShare.objects.get(owner=self.user1, shared_with=self.user2)
        share.permissions['properties'] = 'rw'
        share.save()

        self.client.force_authenticate(user=self.user2)
        data = {'name': 'Updated Property'}
        response = self.client.patch(f'/api/properties/{self.prop1.id}/', data)
        # The update should be allowed
        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ShareRevocationTest(TestCase):
    """Test that revoking a DataShare immediately removes access"""

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username='owner', email='owner@example.com', password='testpass123'
        )
        self.shared_user = User.objects.create_user(
            username='shared', email='shared@example.com', password='testpass123'
        )
        self.prop = Property.objects.create(
            name='Shared House', user=self.owner, address='123 Main St'
        )
        self.share = DataShare.objects.create(owner=self.owner, shared_with=self.shared_user)

    def test_shared_user_sees_property_before_revocation(self):
        """Shared user can see the property while the share is active"""
        self.client.force_authenticate(user=self.shared_user)
        response = self.client.get('/api/properties/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        prop_ids = [p['id'] for p in response.data]
        self.assertIn(self.prop.id, prop_ids)

    def test_shared_user_loses_access_after_share_deleted(self):
        """Shared user can no longer see the property after the share is deleted"""
        self.share.delete()

        self.client.force_authenticate(user=self.shared_user)
        response = self.client.get('/api/properties/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        prop_ids = [p['id'] for p in response.data]
        self.assertNotIn(self.prop.id, prop_ids)

    def test_owner_deletes_share_via_api_revokes_access(self):
        """Deleting a DataShare via the API immediately revokes the shared user's access"""
        # Owner deletes the share through the API
        self.client.force_authenticate(user=self.owner)
        delete_response = self.client.delete(f'/api/datashare/{self.share.id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

        # Shared user now fetches properties — should no longer see the shared property
        self.client.force_authenticate(user=self.shared_user)
        response = self.client.get('/api/properties/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        prop_ids = [p['id'] for p in response.data]
        self.assertNotIn(self.prop.id, prop_ids)
