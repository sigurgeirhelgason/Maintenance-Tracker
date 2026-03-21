"""
Tests for Task Detail endpoint: verifies that vendor information is correctly
included in task detail API responses.
"""
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from .models import Property, MaintenanceTask, Vendor, TaskType


class TaskDetailVendorTests(TestCase):
    """
    Tests that vendor data is returned correctly in task detail API responses,
    and that tasks without a vendor handle the null case cleanly.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

        # A second user whose data must NOT leak into this user's responses
        self.other_user = User.objects.create_user(
            username='otheruser',
            email='otheruser@example.com',
            password='otherpass123',
        )

        # Shared property for all task tests
        self.prop = Property.objects.create(
            user=self.user,
            name='Test Property',
            address='1 Test Street',
        )

        # A task type to satisfy any FK constraints
        self.task_type = TaskType.objects.create(
            name='Plumbing',
            is_predefined=True,
        )

        # A fully-populated vendor owned by the test user
        self.vendor = Vendor.objects.create(
            user=self.user,
            name='Acme Plumbers',
            contact_person='Alice Smith',
            phone='555-1234',
            email='alice@acmeplumbers.example.com',
            address='99 Vendor Lane',
            speciality=self.task_type,
        )

    # ------------------------------------------------------------------
    # Helper
    # ------------------------------------------------------------------

    def _create_task(self, vendor=None, description='Fix the pipes'):
        return MaintenanceTask.objects.create(
            user=self.user,
            property=self.prop,
            task_type=self.task_type,
            vendor=vendor,
            description=description,
            status='pending',
        )

    def _get_task_detail(self, task_id):
        url = f'/api/tasks/{task_id}/'
        return self.client.get(url)

    # ------------------------------------------------------------------
    # Authentication guard
    # ------------------------------------------------------------------

    def test_unauthenticated_request_returns_401(self):
        """Unauthenticated clients must not be able to fetch task details."""
        task = self._create_task(vendor=self.vendor)
        anon_client = APIClient()
        response = anon_client.get(f'/api/tasks/{task.id}/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ------------------------------------------------------------------
    # Vendor present
    # ------------------------------------------------------------------

    def test_task_detail_includes_vendor_details_key(self):
        """Response for a task with a vendor must contain 'vendor_details'."""
        task = self._create_task(vendor=self.vendor)
        response = self._get_task_detail(task.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('vendor_details', response.data)

    def test_task_detail_vendor_details_is_not_null(self):
        """'vendor_details' must be a non-null object when a vendor is assigned."""
        task = self._create_task(vendor=self.vendor)
        response = self._get_task_detail(task.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data['vendor_details'])

    def test_task_detail_vendor_name_is_correct(self):
        """The vendor name in the response must match the assigned vendor."""
        task = self._create_task(vendor=self.vendor)
        response = self._get_task_detail(task.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['vendor_details']['name'], 'Acme Plumbers')

    def test_task_detail_vendor_email_is_correct(self):
        """The vendor email in the response must match the assigned vendor."""
        task = self._create_task(vendor=self.vendor)
        response = self._get_task_detail(task.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['vendor_details']['email'],
            'alice@acmeplumbers.example.com',
        )

    def test_task_detail_vendor_phone_is_correct(self):
        """The vendor phone number must be present and correct."""
        task = self._create_task(vendor=self.vendor)
        response = self._get_task_detail(task.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['vendor_details']['phone'], '555-1234')

    def test_task_detail_vendor_contact_person_is_correct(self):
        """The contact_person field must be present and correct."""
        task = self._create_task(vendor=self.vendor)
        response = self._get_task_detail(task.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data['vendor_details']['contact_person'],
            'Alice Smith',
        )

    def test_task_detail_vendor_address_is_correct(self):
        """The vendor address must be present and correct."""
        task = self._create_task(vendor=self.vendor)
        response = self._get_task_detail(task.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['vendor_details']['address'], '99 Vendor Lane')

    def test_task_detail_vendor_id_matches_assigned_vendor(self):
        """The vendor_details.id must match the FK stored on the task."""
        task = self._create_task(vendor=self.vendor)
        response = self._get_task_detail(task.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['vendor_details']['id'], self.vendor.id)
        # The raw FK field 'vendor' should also match
        self.assertEqual(response.data['vendor'], self.vendor.id)

    def test_task_detail_vendor_speciality_details_present(self):
        """
        vendor_details must include a nested speciality_details object
        (TaskType) when a primary speciality is set on the vendor.
        """
        task = self._create_task(vendor=self.vendor)
        response = self._get_task_detail(task.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        speciality = response.data['vendor_details'].get('speciality_details')
        self.assertIsNotNone(speciality)
        self.assertEqual(speciality['name'], 'Plumbing')

    # ------------------------------------------------------------------
    # Vendor absent (null)
    # ------------------------------------------------------------------

    def test_task_detail_no_vendor_vendor_details_is_null(self):
        """When no vendor is assigned, 'vendor_details' must be null."""
        task = self._create_task(vendor=None, description='Inspect roof')
        response = self._get_task_detail(task.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('vendor_details', response.data)
        self.assertIsNone(response.data['vendor_details'])

    def test_task_detail_no_vendor_vendor_fk_is_null(self):
        """When no vendor is assigned, the raw 'vendor' FK field must be null."""
        task = self._create_task(vendor=None, description='Paint walls')
        response = self._get_task_detail(task.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['vendor'])

    # ------------------------------------------------------------------
    # List endpoint also includes vendor_details
    # ------------------------------------------------------------------

    def test_task_list_includes_vendor_details_for_each_task(self):
        """
        The list endpoint must also embed vendor_details because the same
        MaintenanceTaskSerializer is used for both list and detail actions.
        """
        self._create_task(vendor=self.vendor, description='Task A')
        self._create_task(vendor=None, description='Task B')
        response = self.client.get('/api/tasks/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # The list endpoint may return a plain list or a paginated dict.
        raw = response.data
        results = raw.get('results', raw) if isinstance(raw, dict) else list(raw)
        self.assertGreaterEqual(len(results), 2)
        for task in results:
            self.assertIn('vendor_details', task)

    # ------------------------------------------------------------------
    # Cross-user isolation
    # ------------------------------------------------------------------

    def test_other_users_task_is_not_accessible(self):
        """A task belonging to another user must not be retrievable."""
        other_prop = Property.objects.create(
            user=self.other_user,
            name='Other Property',
            address='2 Other Street',
        )
        other_task = MaintenanceTask.objects.create(
            user=self.other_user,
            property=other_prop,
            description='Other task',
            status='pending',
        )
        response = self._get_task_detail(other_task.id)
        # Must be 404 (not in queryset) rather than 403
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------------------------------
    # Vendor with minimal data (blank optional fields)
    # ------------------------------------------------------------------

    def test_task_detail_vendor_with_blank_optional_fields(self):
        """
        A vendor with only a name (all optional fields blank) must still
        serialize without errors and return correct values for blank fields.
        """
        minimal_vendor = Vendor.objects.create(
            user=self.user,
            name='Minimal Vendor',
            # phone, email, address, contact_person all blank by default
        )
        task = self._create_task(vendor=minimal_vendor, description='Quick fix')
        response = self._get_task_detail(task.id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        vendor_data = response.data['vendor_details']
        self.assertIsNotNone(vendor_data)
        self.assertEqual(vendor_data['name'], 'Minimal Vendor')
        self.assertEqual(vendor_data['phone'], '')
        self.assertEqual(vendor_data['email'], '')
        self.assertEqual(vendor_data['address'], '')
        self.assertEqual(vendor_data['contact_person'], '')
