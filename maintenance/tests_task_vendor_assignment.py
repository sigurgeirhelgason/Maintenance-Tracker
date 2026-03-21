"""
Tests for assigning/updating/removing a vendor on a MaintenanceTask.

Covers:
  - Assigning a vendor on task create (POST)
  - Assigning a vendor on task update (PATCH)
  - Removing a vendor (PATCH with vendor=null)
  - Assigning a global vendor to a task
  - Assigning another user's personal vendor (cross-user, should be blocked or allowed?)
  - Invalid vendor ID rejected
  - vendor_details nested object present after assignment
  - Unauthenticated access blocked
"""

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from .models import Property, MaintenanceTask, Vendor, TaskType


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(username, email=None):
    email = email or f"{username}@example.com"
    return User.objects.create_user(username=username, email=email, password="testpass")


def make_property(user, name="Test Property"):
    return Property.objects.create(user=user, name=name, address="123 Test St")


def make_vendor(user, name="ACME Plumbing", is_global=False):
    return Vendor.objects.create(user=user, name=name, is_global=is_global)


def make_global_vendor(name="Global Repairs Inc"):
    """Global vendors have no owner (user=None) and is_global=True."""
    return Vendor.objects.create(user=None, name=name, is_global=True)


def make_task(user, prop, vendor=None, description="Fix leaking pipe"):
    return MaintenanceTask.objects.create(
        user=user,
        property=prop,
        description=description,
        vendor=vendor,
    )


# ---------------------------------------------------------------------------
# Task endpoint URL helpers
# ---------------------------------------------------------------------------

TASKS_URL = "/api/tasks/"


def task_url(pk):
    return f"/api/tasks/{pk}/"


# ---------------------------------------------------------------------------
# Test classes
# ---------------------------------------------------------------------------

class TaskVendorAssignOnCreateTests(TestCase):
    """POST /api/tasks/ with a vendor field."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("alice")
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user)
        self.vendor = make_vendor(self.user, name="Alice Plumbing Co")

    def test_create_task_with_own_vendor(self):
        """Creating a task with a vendor ID owned by the same user succeeds."""
        payload = {
            "description": "Fix bathroom pipe",
            "property": self.prop.id,
            "vendor": self.vendor.id,
            "status": "pending",
        }
        response = self.client.post(TASKS_URL, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["vendor"], self.vendor.id)

    def test_vendor_details_nested_in_response_after_create(self):
        """vendor_details nested object appears correctly in the create response."""
        payload = {
            "description": "Fix roof",
            "property": self.prop.id,
            "vendor": self.vendor.id,
            "status": "pending",
        }
        response = self.client.post(TASKS_URL, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        vendor_details = response.data.get("vendor_details")
        self.assertIsNotNone(vendor_details, "vendor_details must be present in response")
        self.assertEqual(vendor_details["id"], self.vendor.id)
        self.assertEqual(vendor_details["name"], self.vendor.name)

    def test_create_task_without_vendor(self):
        """Creating a task with vendor=null is valid; vendor fields are null in response."""
        payload = {
            "description": "General inspection",
            "property": self.prop.id,
            "vendor": None,
            "status": "pending",
        }
        # Use format='json' so that None is serialised as JSON null (not multipart)
        response = self.client.post(TASKS_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data["vendor"])
        self.assertIsNone(response.data["vendor_details"])

    def test_create_task_with_invalid_vendor_id_rejected(self):
        """Sending a non-existent vendor ID returns 400."""
        payload = {
            "description": "Fix boiler",
            "property": self.prop.id,
            "vendor": 999999,
            "status": "pending",
        }
        response = self.client.post(TASKS_URL, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vendor", response.data)

    def test_create_task_with_global_vendor(self):
        """A personal user can create a task using a global vendor."""
        global_vendor = make_global_vendor("Global Electricians")
        payload = {
            "description": "Rewire living room",
            "property": self.prop.id,
            "vendor": global_vendor.id,
            "status": "pending",
        }
        response = self.client.post(TASKS_URL, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["vendor"], global_vendor.id)


class TaskVendorUpdateTests(TestCase):
    """PATCH /api/tasks/<id>/ for vendor field changes."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("bob")
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user)
        self.vendor_a = make_vendor(self.user, name="Bob's Plumbing")
        self.vendor_b = make_vendor(self.user, name="Bob's Electrical")
        self.task = make_task(self.user, self.prop, vendor=self.vendor_a)

    def test_patch_vendor_updates_assignment(self):
        """PATCH with a different vendor ID changes the assigned vendor."""
        response = self.client.patch(task_url(self.task.id), {"vendor": self.vendor_b.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["vendor"], self.vendor_b.id)
        self.assertEqual(response.data["vendor_details"]["id"], self.vendor_b.id)

    def test_patch_vendor_null_removes_assignment(self):
        """PATCH with vendor=null clears the vendor from the task."""
        response = self.client.patch(task_url(self.task.id), {"vendor": None}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIsNone(response.data["vendor"])
        self.assertIsNone(response.data["vendor_details"])

    def test_patch_vendor_details_reflect_new_vendor(self):
        """After patching vendor, vendor_details shows the new vendor's data."""
        response = self.client.patch(task_url(self.task.id), {"vendor": self.vendor_b.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["vendor_details"]["name"], self.vendor_b.name)

    def test_patch_with_invalid_vendor_id_rejected(self):
        """PATCH with a non-existent vendor ID returns 400."""
        response = self.client.patch(task_url(self.task.id), {"vendor": 888888}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("vendor", response.data)

    def test_patch_vendor_persisted_to_database(self):
        """Vendor change is actually written to the database."""
        self.client.patch(task_url(self.task.id), {"vendor": self.vendor_b.id})
        self.task.refresh_from_db()
        self.assertEqual(self.task.vendor_id, self.vendor_b.id)

    def test_patch_vendor_null_persisted_to_database(self):
        """Vendor removal is actually written to the database."""
        self.client.patch(task_url(self.task.id), {"vendor": None}, format="json")
        self.task.refresh_from_db()
        self.assertIsNone(self.task.vendor)


class TaskVendorGlobalVendorTests(TestCase):
    """Assigning global vendors (is_global=True, user=None) to tasks."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("carol")
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user)
        self.global_vendor = make_global_vendor("National Heating Services")
        self.task = make_task(self.user, self.prop)

    def test_assign_global_vendor_on_update(self):
        """A user can assign a global vendor to their task via PATCH."""
        response = self.client.patch(task_url(self.task.id), {"vendor": self.global_vendor.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["vendor"], self.global_vendor.id)
        self.assertEqual(response.data["vendor_details"]["name"], self.global_vendor.name)
        self.assertTrue(response.data["vendor_details"]["is_global"])

    def test_create_task_assigned_to_global_vendor(self):
        """POST creates task with global vendor and returns correct vendor_details."""
        payload = {
            "description": "Annual heating check",
            "property": self.prop.id,
            "vendor": self.global_vendor.id,
            "status": "pending",
        }
        response = self.client.post(TASKS_URL, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["vendor_details"]["is_global"], True)


class TaskVendorCrossUserTests(TestCase):
    """Assigning another user's personal vendor to a task."""

    def setUp(self):
        self.client = APIClient()
        self.user_alice = make_user("alice2", "alice2@example.com")
        self.user_bob = make_user("bob2", "bob2@example.com")
        self.prop_alice = make_property(self.user_alice)
        # Bob's personal vendor — not global, not shared
        self.bob_vendor = make_vendor(self.user_bob, name="Bob's Secret Plumbing")
        self.task_alice = make_task(self.user_alice, self.prop_alice)

    def test_assign_other_users_personal_vendor_to_task(self):
        """
        Assigning another user's personal vendor to a task.

        The backend currently does NOT restrict which vendor ID can be placed
        on a task — it only validates that the vendor ID exists in the DB.
        Bob's vendor is not in Alice's accessible vendor queryset
        (VendorViewSet.get_queryset), but MaintenanceTaskSerializer performs a
        plain FK lookup against all Vendor rows, so it will accept the ID.

        This test documents the current behaviour.  If the design decision is
        that this SHOULD be blocked (vendor must belong to the task owner or be
        global), this test should be updated to assert HTTP_400_BAD_REQUEST and
        the serializer must add a validate_vendor() method.
        """
        self.client.force_authenticate(user=self.user_alice)
        response = self.client.patch(
            task_url(self.task_alice.id),
            {"vendor": self.bob_vendor.id},
            format="json",
        )
        # Document current (permissive) behaviour: assignment succeeds
        # because there is no cross-ownership vendor validation on the task.
        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            msg=(
                "DESIGN NOTE: The backend does not currently prevent assigning "
                "another user's personal vendor to a task. "
                "See tests_task_vendor_assignment.py for details."
            ),
        )


class TaskVendorAuthTests(TestCase):
    """Authentication and ownership guards for vendor assignment."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("dave")
        self.other_user = make_user("eve", "eve@example.com")
        self.prop = make_property(self.user)
        self.vendor = make_vendor(self.user, name="Dave's Tiles")
        self.task = make_task(self.user, self.prop, vendor=self.vendor)

    def test_unauthenticated_create_returns_401(self):
        """Unauthenticated POST to tasks returns 401."""
        self.client.force_authenticate(user=None)
        response = self.client.post(TASKS_URL, {"description": "Test", "property": self.prop.id})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unauthenticated_patch_returns_401(self):
        """Unauthenticated PATCH to a task returns 401."""
        self.client.force_authenticate(user=None)
        response = self.client.patch(task_url(self.task.id), {"vendor": None}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_other_user_cannot_patch_vendor_on_foreign_task(self):
        """Another user updating the vendor on someone else's task is blocked."""
        self.client.force_authenticate(user=self.other_user)
        other_vendor = make_vendor(self.other_user, name="Eve's Painting")
        response = self.client.patch(
            task_url(self.task.id),
            {"vendor": other_vendor.id},
            format="json",
        )
        # The task belongs to dave; eve has no share relationship, so this
        # should be 403 or 404 (task not in eve's queryset → 404).
        self.assertIn(
            response.status_code,
            [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND],
        )
