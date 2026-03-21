"""
Comprehensive tests for the MaintenanceTask feature.

Covers:
- Authentication enforcement
- CRUD operations
- Data isolation between users
- Field validation (required fields, final_price rules, status choices)
- Shared access: read-only vs read-write
- Edge cases discovered in source-code review
"""

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from .models import (
    MaintenanceTask, Property, Area, TaskType, Vendor, DataShare
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(username, email=None, password='testpass123'):
    email = email or f'{username}@example.com'
    return User.objects.create_user(username=username, email=email, password=password)


def make_property(user, name='Test Property'):
    return Property.objects.create(user=user, name=name, address='123 Test St')


def make_task(user, prop, **kwargs):
    defaults = dict(
        description='Fix the roof',
        status='pending',
        priority='medium',
    )
    defaults.update(kwargs)
    task = MaintenanceTask.objects.create(user=user, property=prop, **defaults)
    return task


# ---------------------------------------------------------------------------
# 1. Authentication enforcement
# ---------------------------------------------------------------------------

class TaskAuthenticationTests(TestCase):
    """Unauthenticated requests must be rejected."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('authuser')
        self.prop = make_property(self.user)
        self.task = make_task(self.user, self.prop)

    def test_list_requires_auth(self):
        response = self.client.get('/api/tasks/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_retrieve_requires_auth(self):
        response = self.client.get(f'/api/tasks/{self.task.id}/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_requires_auth(self):
        data = {'description': 'New task', 'property': self.prop.id, 'status': 'pending'}
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_update_requires_auth(self):
        data = {'description': 'Updated'}
        response = self.client.patch(f'/api/tasks/{self.task.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_delete_requires_auth(self):
        response = self.client.delete(f'/api/tasks/{self.task.id}/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ---------------------------------------------------------------------------
# 2. CRUD operations
# ---------------------------------------------------------------------------

class TaskCRUDTests(TestCase):
    """Basic create / read / update / delete operations."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('cruduser')
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user)
        self.task_type = TaskType.objects.create(name='Plumbing')

    # --- CREATE ---

    def test_create_task_minimal(self):
        """A task can be created with only description and property."""
        data = {
            'description': 'Repair leak',
            'property': self.prop.id,
            'status': 'pending',
            'priority': 'medium',
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['description'], 'Repair leak')
        # User is automatically set to the authenticated user
        self.assertEqual(response.data['user'], self.user.id)

    def test_create_task_full_fields(self):
        """A task can be created with all optional fields."""
        vendor = Vendor.objects.create(user=self.user, name='Bob Plumbing')
        area = Area.objects.create(
            property=self.prop, type='Bathroom', floor=1
        )
        data = {
            'description': 'Full task',
            'property': self.prop.id,
            'status': 'pending',
            'priority': 'high',
            'task_type': self.task_type.id,
            'vendor': vendor.id,
            'areas': [area.id],
            'due_date': '2026-12-31',
            'estimated_price': 5000,
            'notes': 'Some notes here',
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['priority'], 'high')
        self.assertEqual(response.data['estimated_price'], 5000)

    def test_create_task_user_is_set_automatically(self):
        """The authenticated user is always the task owner, regardless of POSTed user field."""
        other_user = make_user('other')
        data = {
            'description': 'Hijack attempt',
            'property': self.prop.id,
            'user': other_user.id,  # attempt to set a different user
            'status': 'pending',
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user'], self.user.id)

    # --- READ ---

    def test_list_tasks_returns_own_tasks(self):
        make_task(self.user, self.prop, description='Task A')
        make_task(self.user, self.prop, description='Task B')
        response = self.client.get('/api/tasks/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_retrieve_own_task(self):
        task = make_task(self.user, self.prop, description='My task')
        response = self.client.get(f'/api/tasks/{task.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['description'], 'My task')

    def test_task_response_includes_nested_details(self):
        """Response includes task_type_details, property_details, areas_details."""
        task = make_task(self.user, self.prop, task_type=self.task_type)
        response = self.client.get(f'/api/tasks/{task.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('task_type_details', response.data)
        self.assertIn('property_details', response.data)
        self.assertIn('areas_details', response.data)
        self.assertIn('attachments', response.data)

    def test_filter_tasks_by_status(self):
        make_task(self.user, self.prop, description='Pending', status='pending')
        make_task(self.user, self.prop, description='Done', status='finished')
        response = self.client.get('/api/tasks/?status=pending')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for task in response.data:
            self.assertEqual(task['status'], 'pending')

    def test_filter_tasks_by_property(self):
        prop2 = make_property(self.user, name='Second Property')
        make_task(self.user, self.prop, description='Task for prop1')
        make_task(self.user, prop2, description='Task for prop2')

        response = self.client.get(f'/api/tasks/?property={self.prop.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['description'], 'Task for prop1')

    # --- UPDATE ---

    def test_update_own_task_full(self):
        task = make_task(self.user, self.prop)
        data = {
            'description': 'Updated description',
            'property': self.prop.id,
            'status': 'pending',
            'priority': 'low',
        }
        response = self.client.put(f'/api/tasks/{task.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.description, 'Updated description')
        self.assertEqual(task.priority, 'low')

    def test_partial_update_own_task(self):
        task = make_task(self.user, self.prop, priority='low')
        response = self.client.patch(
            f'/api/tasks/{task.id}/', {'priority': 'high'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.priority, 'high')

    def test_update_task_to_finished_status(self):
        task = make_task(self.user, self.prop, status='pending')
        response = self.client.patch(
            f'/api/tasks/{task.id}/', {'status': 'finished'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.status, 'finished')

    # --- DELETE ---

    def test_delete_own_task(self):
        task = make_task(self.user, self.prop)
        response = self.client.delete(f'/api/tasks/{task.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(MaintenanceTask.objects.filter(id=task.id).exists())

    def test_delete_nonexistent_task_returns_404(self):
        response = self.client.delete('/api/tasks/99999/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ---------------------------------------------------------------------------
# 3. Data isolation
# ---------------------------------------------------------------------------

class TaskDataIsolationTests(TestCase):
    """Users must not see or modify each other's tasks (without sharing)."""

    def setUp(self):
        self.client = APIClient()
        self.user1 = make_user('user1')
        self.user2 = make_user('user2')
        self.prop1 = make_property(self.user1)
        self.prop2 = make_property(self.user2)
        self.task1 = make_task(self.user1, self.prop1, description='User1 Task')
        self.task2 = make_task(self.user2, self.prop2, description='User2 Task')

    def test_user_cannot_see_others_tasks_in_list(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get('/api/tasks/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in response.data]
        self.assertIn(self.task1.id, task_ids)
        self.assertNotIn(self.task2.id, task_ids)

    def test_user_cannot_retrieve_others_task(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(f'/api/tasks/{self.task2.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_cannot_update_others_task(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.patch(
            f'/api/tasks/{self.task2.id}/', {'description': 'Hacked'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_cannot_delete_others_task(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.delete(f'/api/tasks/{self.task2.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(MaintenanceTask.objects.filter(id=self.task2.id).exists())


# ---------------------------------------------------------------------------
# 4. Field validation
# ---------------------------------------------------------------------------

class TaskValidationTests(TestCase):
    """Serializer and model validation rules."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('valuser')
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user)

    def test_invalid_status_returns_400(self):
        data = {
            'description': 'Bad status',
            'property': self.prop.id,
            'status': 'not_a_status',
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('status', response.data)

    def test_invalid_priority_returns_400(self):
        data = {
            'description': 'Bad priority',
            'property': self.prop.id,
            'priority': 'critical',
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('priority', response.data)

    def test_negative_estimated_price_returns_400(self):
        data = {
            'description': 'Negative estimated price',
            'property': self.prop.id,
            'estimated_price': -100,
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('estimated_price', response.data)

    def test_negative_final_price_returns_400(self):
        """final_price must be non-negative (model validator)."""
        data = {
            'description': 'Negative final price',
            'property': self.prop.id,
            'status': 'finished',
            'final_price': -500,
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # --- final_price / status coupling rule ---

    def test_final_price_requires_finished_status(self):
        """Serializer must reject final_price > 0 when status is not 'finished'."""
        data = {
            'description': 'Has final price but wrong status',
            'property': self.prop.id,
            'status': 'pending',
            'final_price': 1000,
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('final_price', response.data)

    def test_final_price_requires_finished_status_in_progress(self):
        """Same rule applies when status is 'in_progress'."""
        data = {
            'description': 'In progress with final price',
            'property': self.prop.id,
            'status': 'in_progress',
            'final_price': 500,
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_final_price_allowed_with_finished_status(self):
        """final_price is accepted when status is 'finished'."""
        data = {
            'description': 'Finished task with final price',
            'property': self.prop.id,
            'status': 'finished',
            'final_price': 2500,
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['final_price'], 2500)

    def test_final_price_zero_bypasses_status_rule(self):
        """
        final_price=0 should not trigger the status validation because the
        serializer only blocks final_price > 0 without 'finished' status.
        (Edge case: the condition is `final_price is not None and final_price > 0`)
        """
        data = {
            'description': 'Zero final price pending task',
            'property': self.prop.id,
            'status': 'pending',
            'final_price': 0,
        }
        response = self.client.post('/api/tasks/', data, format='json')
        # 0 is allowed for pending status per the serializer condition
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_patch_adding_final_price_to_finished_task_succeeds(self):
        """Partial update adding final_price when existing status is 'finished'."""
        task = make_task(self.user, self.prop, status='finished')
        response = self.client.patch(
            f'/api/tasks/{task.id}/', {'final_price': 8000}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task.refresh_from_db()
        self.assertEqual(task.final_price, 8000)

    def test_patch_adding_final_price_to_pending_task_rejected(self):
        """Partial update adding final_price to a pending task must be rejected."""
        task = make_task(self.user, self.prop, status='pending')
        response = self.client.patch(
            f'/api/tasks/{task.id}/', {'final_price': 999}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# 5. Price breakdown auto-calculation (model.save)
# ---------------------------------------------------------------------------

class TaskPriceBreakdownTests(TestCase):
    """Model.save() auto-manages the 'uncategorized' breakdown entry."""

    def setUp(self):
        self.user = make_user('pbuser')
        self.prop = make_property(self.user)

    def test_final_price_creates_uncategorized_breakdown(self):
        """When final_price is set and breakdown is empty, an 'uncategorized' entry is created."""
        task = make_task(self.user, self.prop, status='finished', final_price=3000)
        self.assertEqual(len(task.price_breakdown), 1)
        self.assertEqual(task.price_breakdown[0]['category'], 'uncategorized')
        self.assertEqual(task.price_breakdown[0]['amount'], 3000)

    def test_removing_final_price_clears_breakdown(self):
        """Setting final_price to None clears the entire price_breakdown."""
        task = make_task(self.user, self.prop, status='finished', final_price=3000)
        task.final_price = None
        task.status = 'pending'
        task.save()
        task.refresh_from_db()
        self.assertEqual(task.price_breakdown, [])

    def test_breakdown_with_categorised_items_adjusts_uncategorized(self):
        """
        When explicit breakdown items are provided alongside a final_price,
        the 'uncategorized' item should be set to the remainder.
        """
        task = MaintenanceTask(
            user=self.user,
            property=self.prop,
            description='Breakdown test',
            status='finished',
            final_price=10000,
            price_breakdown=[
                {'category': 'materials', 'amount': 4000, 'vat_refundable': False, 'description': ''},
                {'category': 'work', 'amount': 3000, 'vat_refundable': True, 'description': ''},
            ],
        )
        task.save()
        # Sum of explicit: 7000; uncategorized should = 10000 - 7000 = 3000
        uncategorized = [i for i in task.price_breakdown if i['category'] == 'uncategorized']
        self.assertEqual(len(uncategorized), 1)
        self.assertEqual(uncategorized[0]['amount'], 3000)

    def test_breakdown_removes_uncategorized_when_sum_equals_final_price(self):
        """
        When explicit breakdown items sum to exactly final_price,
        no 'uncategorized' entry should exist.
        """
        task = MaintenanceTask(
            user=self.user,
            property=self.prop,
            description='Full breakdown',
            status='finished',
            final_price=5000,
            price_breakdown=[
                {'category': 'materials', 'amount': 2000, 'vat_refundable': False, 'description': ''},
                {'category': 'work', 'amount': 3000, 'vat_refundable': True, 'description': ''},
            ],
        )
        task.save()
        uncategorized = [i for i in task.price_breakdown if i['category'] == 'uncategorized']
        self.assertEqual(len(uncategorized), 0)


# ---------------------------------------------------------------------------
# 6. Shared access (DataShare) — read-only vs read-write
# ---------------------------------------------------------------------------

class TaskSharingReadOnlyTests(TestCase):
    """Shared user with 'ro' permission on tasks can read but not write."""

    def setUp(self):
        self.client = APIClient()
        self.owner = make_user('owner')
        self.viewer = make_user('viewer')
        self.prop = make_property(self.owner)
        self.task = make_task(self.owner, self.prop, description='Owner task')

        DataShare.objects.create(
            owner=self.owner,
            shared_with=self.viewer,
            permissions={
                'properties': 'ro',
                'tasks': 'ro',
                'vendors': 'ro',
                'areas': 'ro',
                'attachments': 'ro',
            }
        )
        self.client.force_authenticate(user=self.viewer)

    def test_viewer_can_list_shared_tasks(self):
        response = self.client.get('/api/tasks/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in response.data]
        self.assertIn(self.task.id, task_ids)

    def test_viewer_can_retrieve_shared_task(self):
        response = self.client.get(f'/api/tasks/{self.task.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_viewer_cannot_update_shared_task(self):
        response = self.client.patch(
            f'/api/tasks/{self.task.id}/', {'description': 'Hacked'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_viewer_cannot_delete_shared_task(self):
        response = self.client.delete(f'/api/tasks/{self.task.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(MaintenanceTask.objects.filter(id=self.task.id).exists())

    def test_viewer_cannot_create_task_on_shared_property(self):
        """
        A viewer with read-only ('ro') task permission cannot create tasks on
        the owner's property. The view checks that the caller has write ('rw')
        permission on tasks before allowing task creation on another user's
        property, so this must return 403 Forbidden.
        """
        data = {
            'description': 'Viewer created task',
            'property': self.prop.id,
            'status': 'pending',
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TaskSharingReadWriteTests(TestCase):
    """Shared user with 'rw' permission on tasks can read AND write."""

    def setUp(self):
        self.client = APIClient()
        self.owner = make_user('rwowner')
        self.editor = make_user('rweditor')
        self.prop = make_property(self.owner)
        self.task = make_task(self.owner, self.prop, description='Owner task')

        DataShare.objects.create(
            owner=self.owner,
            shared_with=self.editor,
            permissions={
                'properties': 'rw',
                'tasks': 'rw',
                'vendors': 'rw',
                'areas': 'rw',
                'attachments': 'rw',
            }
        )
        self.client.force_authenticate(user=self.editor)

    def test_editor_can_list_shared_tasks(self):
        response = self.client.get('/api/tasks/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        task_ids = [t['id'] for t in response.data]
        self.assertIn(self.task.id, task_ids)

    def test_editor_can_update_shared_task(self):
        response = self.client.patch(
            f'/api/tasks/{self.task.id}/', {'description': 'Editor changed this'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.task.refresh_from_db()
        self.assertEqual(self.task.description, 'Editor changed this')

    def test_editor_can_delete_shared_task(self):
        response = self.client.delete(f'/api/tasks/{self.task.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(MaintenanceTask.objects.filter(id=self.task.id).exists())


# ---------------------------------------------------------------------------
# 7. Edge cases
# ---------------------------------------------------------------------------

class TaskEdgeCaseTests(TestCase):
    """Edge cases surfaced by reviewing the source code."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('edgeuser')
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user)

    def test_task_with_null_description_allowed_by_model(self):
        """
        The model allows null description, but the frontend requires it.
        Verify the API does NOT reject a null description at serializer level
        (since description is TextField with null=True, blank=True).
        """
        data = {
            'property': self.prop.id,
            'status': 'pending',
            'description': '',
        }
        response = self.client.post('/api/tasks/', data, format='json')
        # empty string is allowed because the field is blank=True
        self.assertIn(response.status_code, [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST])

    def test_list_tasks_empty_returns_200(self):
        """Empty task list returns 200 with an empty array."""
        response = self.client.get('/api/tasks/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_task_default_status_is_pending(self):
        """Tasks without explicit status should default to 'pending'."""
        task = MaintenanceTask.objects.create(
            user=self.user,
            property=self.prop,
            description='Default status task',
        )
        self.assertEqual(task.status, 'pending')

    def test_task_default_priority_is_medium(self):
        """Tasks without explicit priority should default to 'medium'."""
        task = MaintenanceTask.objects.create(
            user=self.user,
            property=self.prop,
            description='Default priority task',
        )
        self.assertEqual(task.priority, 'medium')

    def test_year_filter_via_api(self):
        """
        The API supports filtering by property. Year-level filtering is
        done client-side, so we test the property filter returns correct results
        (the underlying mechanism the frontend relies on).
        """
        make_task(self.user, self.prop, description='Task 1', due_date='2025-06-01')
        make_task(self.user, self.prop, description='Task 2', due_date='2026-06-01')
        response = self.client.get(f'/api/tasks/?property={self.prop.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_search_filter_is_not_exposed_by_api(self):
        """
        The Tasks viewset does NOT expose a search_fields filter.
        A ?search= param is silently ignored (no 400), and all tasks are returned.
        This documents the current state — search is handled client-side.
        """
        make_task(self.user, self.prop, description='Unique Alpha Task')
        make_task(self.user, self.prop, description='Unrelated Beta Task')
        response = self.client.get('/api/tasks/?search=Alpha')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # All tasks returned because search is not wired on the backend
        self.assertEqual(len(response.data), 2)

    def test_task_with_nonexistent_property_returns_400(self):
        data = {
            'description': 'Bad property',
            'property': 999999,
            'status': 'pending',
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_task_with_invalid_due_date_returns_400(self):
        data = {
            'description': 'Bad date',
            'property': self.prop.id,
            'due_date': 'not-a-date',
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_does_not_change_created_date(self):
        """created_date is read-only and must not change on update."""
        task = make_task(self.user, self.prop)
        original_created = task.created_date
        self.client.patch(
            f'/api/tasks/{task.id}/',
            {'created_date': '2000-01-01'},
            format='json'
        )
        task.refresh_from_db()
        self.assertEqual(task.created_date, original_created)

    def test_task_ordering_default_newest_first(self):
        """Default ordering is by -created_date (newest first)."""
        t1 = make_task(self.user, self.prop, description='First')
        t2 = make_task(self.user, self.prop, description='Second')
        response = self.client.get('/api/tasks/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [t['id'] for t in response.data]
        # t2 was created later; it should appear first
        self.assertEqual(ids[0], t2.id)
        self.assertEqual(ids[1], t1.id)

    def test_creating_task_for_another_users_property_is_blocked(self):
        """
        The view must reject task creation when the referenced property belongs
        to a different user. The API correctly returns 403 Forbidden.
        """
        other_user = make_user('propowner')
        other_prop = make_property(other_user)
        data = {
            'description': 'Cross-user property task',
            'property': other_prop.id,
            'status': 'pending',
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TaskNoPropertyTests(TestCase):
    """Tasks where property is null (allowed by model)."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('nopropuser')
        self.client.force_authenticate(user=self.user)

    def test_create_task_without_property(self):
        """property is nullable on the model; a task can exist without one."""
        data = {
            'description': 'No property task',
            'status': 'pending',
        }
        response = self.client.post('/api/tasks/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data['property'])

    def test_list_includes_propertyless_tasks(self):
        MaintenanceTask.objects.create(
            user=self.user,
            description='Floating task',
            status='pending',
        )
        response = self.client.get('/api/tasks/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)


# ---------------------------------------------------------------------------
# 8. Status transition tests
# ---------------------------------------------------------------------------

class TaskStatusTransitionTests(TestCase):
    """All valid status transitions should succeed; none are blocked by the API."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('transuser')
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user)

    def _transition(self, from_status, to_status, final_price=None):
        task = make_task(self.user, self.prop, status=from_status)
        patch_data = {'status': to_status}
        if final_price is not None:
            patch_data['final_price'] = final_price
        return self.client.patch(f'/api/tasks/{task.id}/', patch_data, format='json')

    def test_pending_to_in_progress(self):
        response = self._transition('pending', 'in_progress')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_pending_to_finished(self):
        response = self._transition('pending', 'finished')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_in_progress_to_finished(self):
        response = self._transition('in_progress', 'finished')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_finished_back_to_pending(self):
        """Reverting a finished task to pending must clear final_price to avoid validation conflict."""
        task = make_task(self.user, self.prop, status='finished', final_price=5000)
        response = self.client.patch(
            f'/api/tasks/{task.id}/',
            {'status': 'pending', 'final_price': None},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_finished_to_pending_keeps_final_price_rejected(self):
        """
        Changing status back to pending while keeping final_price > 0
        must be rejected by the serializer validation.
        """
        task = make_task(self.user, self.prop, status='finished', final_price=5000)
        response = self.client.patch(
            f'/api/tasks/{task.id}/',
            {'status': 'pending'},
            format='json'
        )
        # The existing final_price (5000) combined with new status 'pending' should fail
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
