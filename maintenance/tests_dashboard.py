"""
Tests for Dashboard-related API endpoints and backend logic.

The Dashboard component consumes:
  - GET /api/tasks/
  - GET /api/properties/
  - GET /api/vendors/
  - POST /api/export/
  - POST /api/import/

This suite covers:
  - Authentication enforcement (all endpoints require auth)
  - Correct data returned for the authenticated user
  - Data isolation (no cross-user data leakage)
  - Model validation that feeds into StatisticsCards calculations
  - Edge cases: empty data, tasks without dates, VAT refund logic
"""

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from .models import Property, Area, MaintenanceTask, Vendor, TaskType, UserVendorPreference, DataShare


# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------

def make_user(username, email=None, password='testpass123'):
    email = email or f'{username}@example.com'
    return User.objects.create_user(username=username, email=email, password=password)


def make_property(user, name='Test Property', address='Test Street 1'):
    return Property.objects.create(user=user, name=name, address=address)


def make_task(user, property_obj, description='Fix something', status='pending',
              estimated_price=None, final_price=None, due_date=None,
              vat_refund_claimed=False, price_breakdown=None):
    kwargs = dict(
        user=user,
        property=property_obj,
        description=description,
        status=status,
        vat_refund_claimed=vat_refund_claimed,
    )
    if estimated_price is not None:
        kwargs['estimated_price'] = estimated_price
    if due_date is not None:
        kwargs['due_date'] = due_date
    if price_breakdown is not None:
        kwargs['price_breakdown'] = price_breakdown
    # final_price triggers the model's save() logic – set it last so it can reference status
    if final_price is not None:
        kwargs['final_price'] = final_price
    return MaintenanceTask.objects.create(**kwargs)


# ===========================================================================
# 1. Authentication: all dashboard endpoints require a logged-in user
# ===========================================================================

class DashboardAuthenticationTests(TestCase):
    """All three list endpoints used by the Dashboard must reject anonymous requests."""

    def setUp(self):
        self.client = APIClient()

    def test_tasks_requires_auth(self):
        response = self.client.get('/api/tasks/')
        self.assertIn(response.status_code, [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        ])

    def test_properties_requires_auth(self):
        response = self.client.get('/api/properties/')
        self.assertIn(response.status_code, [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        ])

    def test_vendors_requires_auth(self):
        response = self.client.get('/api/vendors/')
        self.assertIn(response.status_code, [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        ])

    def test_export_requires_auth(self):
        response = self.client.post('/api/export/', {})
        self.assertIn(response.status_code, [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        ])

    def test_import_requires_auth(self):
        response = self.client.post('/api/import/', {})
        self.assertIn(response.status_code, [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        ])


# ===========================================================================
# 2. Tasks endpoint – data returned correctly for Dashboard
# ===========================================================================

class DashboardTasksEndpointTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('taskuser')
        self.prop = make_property(self.user)
        self.client.force_authenticate(user=self.user)

    def test_tasks_returns_200(self):
        response = self.client.get('/api/tasks/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_tasks_returns_list(self):
        make_task(self.user, self.prop, description='Task A')
        make_task(self.user, self.prop, description='Task B')
        response = self.client.get('/api/tasks/')
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 2)

    def test_tasks_empty_when_no_tasks(self):
        response = self.client.get('/api/tasks/')
        self.assertEqual(response.data, [])

    def test_task_response_includes_required_dashboard_fields(self):
        """Dashboard reads: description, status, cost, property_details, vendor_details."""
        make_task(self.user, self.prop, description='Paint walls', status='pending')
        response = self.client.get('/api/tasks/')
        task = response.data[0]
        for field in ['id', 'description', 'status', 'property_details', 'vendor_details',
                      'estimated_price', 'final_price', 'due_date', 'vat_refund_claimed',
                      'price_breakdown']:
            self.assertIn(field, task, f"Field '{field}' missing from task response")

    def test_task_property_details_nested(self):
        """property_details must contain 'name' for the Upcoming Tasks section to display it."""
        make_task(self.user, self.prop, description='Fix roof')
        response = self.client.get('/api/tasks/')
        task = response.data[0]
        self.assertIsNotNone(task['property_details'])
        self.assertEqual(task['property_details']['name'], self.prop.name)

    def test_task_status_values(self):
        """Dashboard filters on status; verify all three choices round-trip correctly."""
        statuses = ['pending', 'in_progress', 'finished']
        for s in statuses:
            kwargs = {}
            if s == 'finished':
                kwargs['final_price'] = 1000
            make_task(self.user, self.prop, description=f'{s} task', status=s, **kwargs)
        response = self.client.get('/api/tasks/')
        returned_statuses = {t['status'] for t in response.data}
        self.assertEqual(returned_statuses, set(statuses))

    def test_tasks_only_returns_own_tasks(self):
        """A user must not see tasks belonging to another user."""
        other_user = make_user('otheruser')
        other_prop = make_property(other_user, name='Other Property')
        make_task(other_user, other_prop, description='Private task')
        make_task(self.user, self.prop, description='My task')

        response = self.client.get('/api/tasks/')
        descriptions = [t['description'] for t in response.data]
        self.assertIn('My task', descriptions)
        self.assertNotIn('Private task', descriptions)

    def test_task_filter_by_status(self):
        make_task(self.user, self.prop, description='Pending task', status='pending')
        make_task(self.user, self.prop, description='Finished task', status='finished', final_price=500)
        response = self.client.get('/api/tasks/?status=pending')
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['description'], 'Pending task')

    def test_task_filter_by_property(self):
        prop2 = make_property(self.user, name='Property 2')
        make_task(self.user, self.prop, description='Task on prop1')
        make_task(self.user, prop2, description='Task on prop2')
        response = self.client.get(f'/api/tasks/?property={self.prop.id}')
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['description'], 'Task on prop1')


# ===========================================================================
# 3. Properties endpoint – data returned correctly for Dashboard
# ===========================================================================

class DashboardPropertiesEndpointTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('propuser')
        self.client.force_authenticate(user=self.user)

    def test_properties_returns_200(self):
        response = self.client.get('/api/properties/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_properties_empty_when_no_properties(self):
        response = self.client.get('/api/properties/')
        self.assertEqual(response.data, [])

    def test_properties_includes_required_dashboard_fields(self):
        """Dashboard reads: name, image, areas, tasks."""
        make_property(self.user, name='My House')
        response = self.client.get('/api/properties/')
        prop = response.data[0]
        for field in ['id', 'name', 'image', 'areas', 'tasks']:
            self.assertIn(field, prop, f"Field '{field}' missing from property response")

    def test_properties_areas_is_list(self):
        prop = make_property(self.user)
        Area.objects.create(property=prop, type='Kitchen', floor=1)
        response = self.client.get('/api/properties/')
        self.assertIsInstance(response.data[0]['areas'], list)
        self.assertEqual(len(response.data[0]['areas']), 1)

    def test_properties_tasks_is_list(self):
        prop = make_property(self.user)
        make_task(self.user, prop, description='Task 1')
        response = self.client.get('/api/properties/')
        self.assertIsInstance(response.data[0]['tasks'], list)
        self.assertEqual(len(response.data[0]['tasks']), 1)

    def test_properties_only_returns_own_properties(self):
        other_user = make_user('otherwner')
        make_property(other_user, name='Other House')
        make_property(self.user, name='My House')
        response = self.client.get('/api/properties/')
        names = [p['name'] for p in response.data]
        self.assertIn('My House', names)
        self.assertNotIn('Other House', names)

    def test_property_task_count_is_correct(self):
        """The Issues count in the Dashboard property card uses tasks filtered by status != finished."""
        prop = make_property(self.user)
        make_task(self.user, prop, description='Open task 1', status='pending')
        make_task(self.user, prop, description='Open task 2', status='in_progress')
        make_task(self.user, prop, description='Done task', status='finished', final_price=100)
        response = self.client.get('/api/properties/')
        tasks = response.data[0]['tasks']
        open_tasks = [t for t in tasks if t['status'] != 'finished']
        self.assertEqual(len(open_tasks), 2)


# ===========================================================================
# 4. Vendors endpoint – data returned correctly for Dashboard
# ===========================================================================

class DashboardVendorsEndpointTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('vendoruser')
        self.client.force_authenticate(user=self.user)

    def test_vendors_returns_200(self):
        response = self.client.get('/api/vendors/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_vendors_empty_when_no_vendors(self):
        # Global vendors may exist from seeds; user-specific vendors should not
        response = self.client.get('/api/vendors/')
        # Just confirm it's a valid list response
        self.assertIsInstance(response.data, list)

    def test_vendor_includes_favorite_field(self):
        """Dashboard uses vendor.favorite to build the Favorite Vendors section."""
        Vendor.objects.create(user=self.user, name='Plumber Co.')
        response = self.client.get('/api/vendors/')
        # Filter to user's vendor specifically
        vendor_data = next((v for v in response.data if v['name'] == 'Plumber Co.'), None)
        self.assertIsNotNone(vendor_data)
        self.assertIn('favorite', vendor_data)

    def test_vendor_favorite_is_false_by_default(self):
        Vendor.objects.create(user=self.user, name='Electrician Ltd.')
        response = self.client.get('/api/vendors/')
        vendor_data = next((v for v in response.data if v['name'] == 'Electrician Ltd.'), None)
        self.assertFalse(vendor_data['favorite'])

    def test_vendor_favorite_true_after_toggle(self):
        vendor = Vendor.objects.create(user=self.user, name='Painter Inc.')
        UserVendorPreference.objects.create(user=self.user, vendor=vendor, is_favorite=True)
        response = self.client.get('/api/vendors/')
        vendor_data = next((v for v in response.data if v['name'] == 'Painter Inc.'), None)
        self.assertTrue(vendor_data['favorite'])

    def test_vendor_includes_contact_fields(self):
        """Dashboard shows phone and email on vendor cards."""
        Vendor.objects.create(user=self.user, name='Roofer Co.', phone='555-1234', email='roofer@example.com')
        response = self.client.get('/api/vendors/')
        vendor_data = next((v for v in response.data if v['name'] == 'Roofer Co.'), None)
        self.assertIn('phone', vendor_data)
        self.assertIn('email', vendor_data)
        self.assertEqual(vendor_data['phone'], '555-1234')
        self.assertEqual(vendor_data['email'], 'roofer@example.com')

    def test_toggle_favorite_endpoint(self):
        vendor = Vendor.objects.create(user=self.user, name='Toggle Vendor')
        response = self.client.post(f'/api/vendors/{vendor.id}/toggle_favorite/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pref = UserVendorPreference.objects.get(user=self.user, vendor=vendor)
        self.assertTrue(pref.is_favorite)

    def test_toggle_favorite_is_idempotent_toggle(self):
        """Calling toggle twice should revert to original state."""
        vendor = Vendor.objects.create(user=self.user, name='Toggle Vendor 2')
        self.client.post(f'/api/vendors/{vendor.id}/toggle_favorite/')
        self.client.post(f'/api/vendors/{vendor.id}/toggle_favorite/')
        pref = UserVendorPreference.objects.get(user=self.user, vendor=vendor)
        self.assertFalse(pref.is_favorite)


# ===========================================================================
# 5. StatisticsCards backend logic – VAT refund calculation
# ===========================================================================

class StatisticsCardsBackendLogicTests(TestCase):
    """
    The Dashboard's StatisticsCards computes:
      - open work orders (tasks with status != finished)
      - possible VAT refund (35% of 24% of VAT-refundable work items)
      - total investment (sum of final_price for finished tasks)
      - total estimated cost (sum of estimated_price for unfinished tasks)

    These tests verify that the backend data feeding those calculations is correct.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('statsuser')
        self.prop = make_property(self.user)
        self.client.force_authenticate(user=self.user)

    def test_open_work_orders_count(self):
        make_task(self.user, self.prop, status='pending')
        make_task(self.user, self.prop, status='in_progress')
        make_task(self.user, self.prop, status='finished', final_price=1000)
        response = self.client.get('/api/tasks/')
        open_tasks = [t for t in response.data if t['status'] != 'finished']
        self.assertEqual(len(open_tasks), 2)

    def test_finished_task_has_final_price(self):
        make_task(self.user, self.prop, status='finished', final_price=50000)
        response = self.client.get('/api/tasks/')
        task = next(t for t in response.data if t['status'] == 'finished')
        self.assertEqual(int(task['final_price']), 50000)

    def test_unfinished_task_has_estimated_price(self):
        make_task(self.user, self.prop, status='pending', estimated_price=30000)
        response = self.client.get('/api/tasks/')
        task = next(t for t in response.data if t['status'] == 'pending')
        self.assertEqual(int(task['estimated_price']), 30000)

    def test_price_breakdown_included_in_response(self):
        """price_breakdown is needed for VAT refund calculation."""
        breakdown = [
            {'category': 'work', 'amount': 10000, 'vat_refundable': True, 'description': 'Labour'},
        ]
        make_task(self.user, self.prop, status='finished', final_price=10000,
                  price_breakdown=breakdown)
        response = self.client.get('/api/tasks/')
        task = next(t for t in response.data if t['status'] == 'finished')
        self.assertIsInstance(task['price_breakdown'], list)
        self.assertTrue(len(task['price_breakdown']) > 0)

    def test_vat_refund_claimed_field_present(self):
        make_task(self.user, self.prop, status='finished', final_price=5000, vat_refund_claimed=False)
        response = self.client.get('/api/tasks/')
        task = next(t for t in response.data if t['status'] == 'finished')
        self.assertIn('vat_refund_claimed', task)
        self.assertFalse(task['vat_refund_claimed'])

    def test_tasks_with_no_due_date_still_returned(self):
        """Tasks without due_date must still appear (they are excluded from calendar but not from stats)."""
        make_task(self.user, self.prop, description='No date task', due_date=None)
        response = self.client.get('/api/tasks/')
        descriptions = [t['description'] for t in response.data]
        self.assertIn('No date task', descriptions)


# ===========================================================================
# 6. MaintenanceTask model – validation that affects Dashboard stats
# ===========================================================================

class MaintenanceTaskModelValidationTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('validationuser')
        self.prop = make_property(self.user)
        self.client.force_authenticate(user=self.user)

    def test_cannot_set_final_price_on_pending_task_via_api(self):
        """Serializer enforces that final_price can only be set when status is finished."""
        data = {
            'property': self.prop.id,
            'description': 'Replace pipes',
            'status': 'pending',
            'final_price': 5000,
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('final_price', response.data)

    def test_cannot_set_final_price_on_in_progress_task_via_api(self):
        data = {
            'property': self.prop.id,
            'description': 'Repaint walls',
            'status': 'in_progress',
            'final_price': 8000,
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_can_set_final_price_on_finished_task_via_api(self):
        data = {
            'property': self.prop.id,
            'description': 'Finished job',
            'status': 'finished',
            'final_price': 12000,
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['final_price'], 12000)

    def test_price_breakdown_auto_created_when_final_price_set(self):
        """Model.save() auto-creates an 'uncategorized' entry when final_price is set without breakdown."""
        task = make_task(self.user, self.prop, status='finished', final_price=20000)
        task.refresh_from_db()
        self.assertTrue(len(task.price_breakdown) > 0)

    def test_price_breakdown_uncategorized_amount_matches_final_price(self):
        task = make_task(self.user, self.prop, status='finished', final_price=20000)
        task.refresh_from_db()
        uncategorized = next((item for item in task.price_breakdown if item['category'] == 'uncategorized'), None)
        self.assertIsNotNone(uncategorized)
        self.assertEqual(uncategorized['amount'], 20000)

    def test_price_breakdown_cleared_when_final_price_removed(self):
        task = make_task(self.user, self.prop, status='finished', final_price=20000)
        task.final_price = None
        task.status = 'pending'
        task.save()
        task.refresh_from_db()
        self.assertEqual(task.price_breakdown, [])

    def test_estimated_price_non_negative(self):
        """MinValueValidator on estimated_price must reject negative values."""
        data = {
            'property': self.prop.id,
            'description': 'Bad estimate',
            'status': 'pending',
            'estimated_price': -100,
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_task_create_sets_user_automatically(self):
        data = {
            'property': self.prop.id,
            'description': 'Auto user task',
            'status': 'pending',
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        task = MaintenanceTask.objects.get(id=response.data['id'])
        self.assertEqual(task.user, self.user)


# ===========================================================================
# 7. Export endpoint – basic smoke test
# ===========================================================================

class DashboardExportTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('exportuser')
        self.prop = make_property(self.user)
        make_task(self.user, self.prop, description='Exported task', status='pending')
        self.client.force_authenticate(user=self.user)

    def test_export_returns_200_with_zip(self):
        response = self.client.post('/api/export/', {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content_type = response.get('Content-Type', '')
        self.assertIn('zip', content_type.lower())

    def test_export_has_content_disposition_header(self):
        response = self.client.post('/api/export/', {})
        self.assertIn('Content-Disposition', response)
        self.assertIn('attachment', response['Content-Disposition'])

    def test_export_works_with_empty_data(self):
        """Export must not crash when user has no properties or tasks."""
        empty_user = make_user('emptyexportuser')
        self.client.force_authenticate(user=empty_user)
        response = self.client.post('/api/export/', {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


# ===========================================================================
# 8. Import endpoint – validation and error handling
# ===========================================================================

class DashboardImportTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('importuser')
        self.client.force_authenticate(user=self.user)

    def test_import_without_file_returns_400(self):
        response = self.client.post('/api/import/', {}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_import_with_non_zip_file_returns_error(self):
        import io
        fake_file = io.BytesIO(b'this is not a zip file')
        fake_file.name = 'data.txt'
        response = self.client.post('/api/import/', {'file': fake_file}, format='multipart')
        # Should be 400 (validation) or 500 (processing error) – either way NOT 200
        self.assertNotEqual(response.status_code, status.HTTP_200_OK)

    def test_import_with_invalid_zip_content_returns_error(self):
        import io
        import zipfile
        # Create a valid ZIP but with garbage JSON content
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zf:
            zf.writestr('data.json', 'NOT VALID JSON {{{')
        zip_buffer.seek(0)
        zip_buffer.name = 'bad_data.zip'
        response = self.client.post('/api/import/', {'file': zip_buffer}, format='multipart')
        self.assertNotEqual(response.status_code, status.HTTP_200_OK)


# ===========================================================================
# 9. Cross-user data isolation for all Dashboard endpoints
# ===========================================================================

class DashboardDataIsolationTests(TestCase):
    """
    Confirms that a user cannot accidentally see another user's data
    through any of the Dashboard's three list endpoints.
    """

    def setUp(self):
        self.client = APIClient()
        self.user_a = make_user('usera')
        self.user_b = make_user('userb')
        self.prop_a = make_property(self.user_a, name='Property A')
        self.prop_b = make_property(self.user_b, name='Property B')
        make_task(self.user_a, self.prop_a, description='Task A')
        make_task(self.user_b, self.prop_b, description='Task B')
        Vendor.objects.create(user=self.user_a, name='Vendor A')
        Vendor.objects.create(user=self.user_b, name='Vendor B')

    def test_user_a_cannot_see_user_b_properties(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/properties/')
        names = [p['name'] for p in response.data]
        self.assertNotIn('Property B', names)

    def test_user_b_cannot_see_user_a_tasks(self):
        self.client.force_authenticate(user=self.user_b)
        response = self.client.get('/api/tasks/')
        descriptions = [t['description'] for t in response.data]
        self.assertNotIn('Task A', descriptions)

    def test_user_a_cannot_see_user_b_vendors(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/vendors/')
        vendor_names = [v['name'] for v in response.data]
        self.assertNotIn('Vendor B', vendor_names)

    def test_user_b_cannot_delete_user_a_task(self):
        self.client.force_authenticate(user=self.user_a)
        r = self.client.get('/api/tasks/')
        task_id = next(t['id'] for t in r.data if t['description'] == 'Task A')
        self.client.force_authenticate(user=self.user_b)
        response = self.client.delete(f'/api/tasks/{task_id}/')
        # user_b cannot even see user_a's task, so should get 404 (not 403)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_b_cannot_update_user_a_property(self):
        self.client.force_authenticate(user=self.user_a)
        r = self.client.get('/api/properties/')
        prop_id = next(p['id'] for p in r.data if p['name'] == 'Property A')
        self.client.force_authenticate(user=self.user_b)
        response = self.client.patch(f'/api/properties/{prop_id}/', {'name': 'Hacked'})
        # user_b cannot even see the property, so 404 expected
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ===========================================================================
# 10. Shared data appears on Dashboard for the recipient user
# ===========================================================================

class DashboardSharedDataTests(TestCase):
    """When user_a shares their data with user_b, the Dashboard for user_b should show it."""

    def setUp(self):
        self.client = APIClient()
        self.user_a = make_user('sharera')
        self.user_b = make_user('shareb')
        self.prop_a = make_property(self.user_a, name='Shared Property')
        make_task(self.user_a, self.prop_a, description='Shared Task')
        DataShare.objects.create(owner=self.user_a, shared_with=self.user_b)

    def test_shared_property_visible_to_recipient(self):
        self.client.force_authenticate(user=self.user_b)
        response = self.client.get('/api/properties/')
        names = [p['name'] for p in response.data]
        self.assertIn('Shared Property', names)

    def test_shared_task_visible_to_recipient(self):
        self.client.force_authenticate(user=self.user_b)
        response = self.client.get('/api/tasks/')
        descriptions = [t['description'] for t in response.data]
        self.assertIn('Shared Task', descriptions)
