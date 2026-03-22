"""
Tests for the Reports & Analytics feature.

The Reports page is entirely frontend-driven: it fetches data from the standard
REST endpoints (/api/tasks/, /api/vendors/, /api/properties/, /api/areas/) and
aggregates everything client-side.  These tests therefore validate that the API
responses contain the correct data for each report type:

  1.  Authentication enforcement
  2.  Cost Analysis       – final_price / estimated_price per property
  3.  Task Status         – status counts (pending / in_progress / finished)
  4.  Vendor Performance  – tasks-per-vendor, costs, completion rates
  5.  Maintenance History – finished tasks sorted by date
  6.  Monthly Costs       – financial fields + date fields present
  7.  Area Maintenance    – area-task relationships
  8.  Maintenance Schedule– pending/in_progress tasks with due_date
  9.  VAT Refunds         – vat_refund_claimed, price_breakdown, vat_refundable items
 10.  Price-breakdown auto-calculation (model save logic)
 11.  Data isolation      – users only see their own tasks
 12.  Shared data access  – DataShare grants visibility to shared user's data
 13.  Filtering           – status / property / vendor / task_type query params
"""

from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from maintenance.models import (
    Area,
    DataShare,
    MaintenanceTask,
    Property,
    TaskType,
    Vendor,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_list(response):
    """Return the list of items from a response, handling both paginated and
    plain-list response formats."""
    data = response.data
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return list(data)


def make_user(username, password="testpass123"):
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password=password,
    )


def make_property(user, name="Test Property"):
    return Property.objects.create(user=user, name=name, address="1 Main St")


def make_area(prop, area_type="Kitchen", name=None):
    return Area.objects.create(property=prop, type=area_type, name=name)


def make_task_type(name="Plumbing"):
    obj, _ = TaskType.objects.get_or_create(name=name)
    return obj


def make_vendor(user=None, name="Acme Ltd", is_global=False):
    return Vendor.objects.create(user=user, name=name, is_global=is_global)


def make_task(user, prop, **kwargs):
    defaults = dict(
        description="Some task",
        status="pending",
        priority="medium",
    )
    defaults.update(kwargs)
    return MaintenanceTask.objects.create(user=user, property=prop, **defaults)


# ---------------------------------------------------------------------------
# 1. Authentication enforcement
# ---------------------------------------------------------------------------

class ReportsAuthTests(TestCase):
    """All report-data endpoints must reject unauthenticated requests."""

    def setUp(self):
        self.client = APIClient()

    def test_tasks_endpoint_requires_auth(self):
        r = self.client.get("/api/tasks/")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_properties_endpoint_requires_auth(self):
        r = self.client.get("/api/properties/")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_vendors_endpoint_requires_auth(self):
        r = self.client.get("/api/vendors/")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_areas_endpoint_requires_auth(self):
        r = self.client.get("/api/areas/")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)


# ---------------------------------------------------------------------------
# 2. Cost Analysis – financial fields returned correctly
# ---------------------------------------------------------------------------

class CostAnalysisReportTests(TestCase):
    """
    Cost Analysis uses final_price (finished tasks) and estimated_price
    (pending / in_progress) grouped by property.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("costuser")
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user, "Prop A")

    def test_finished_task_returns_final_price(self):
        make_task(
            self.user,
            self.prop,
            status="finished",
            final_price=50000,
            estimated_price=40000,
        )
        r = self.client.get("/api/tasks/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        tasks = get_list(r)
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0]["final_price"], 50000)
        self.assertEqual(tasks[0]["estimated_price"], 40000)

    def test_pending_task_returns_estimated_price_no_final(self):
        make_task(
            self.user,
            self.prop,
            status="pending",
            estimated_price=25000,
        )
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertIsNone(tasks[0]["final_price"])
        self.assertEqual(tasks[0]["estimated_price"], 25000)

    def test_tasks_include_property_id_for_grouping(self):
        make_task(self.user, self.prop, final_price=10000, status="finished")
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertIn("property", tasks[0])

    def test_multiple_tasks_multiple_properties(self):
        prop_b = make_property(self.user, "Prop B")
        make_task(self.user, self.prop, status="finished", final_price=10000)
        make_task(self.user, prop_b, status="pending", estimated_price=5000)
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertEqual(len(tasks), 2)
        props_in_response = {t["property"] for t in tasks}
        self.assertIn(self.prop.pk, props_in_response)
        self.assertIn(prop_b.pk, props_in_response)


# ---------------------------------------------------------------------------
# 3. Task Status Report – status counts
# ---------------------------------------------------------------------------

class TaskStatusReportTests(TestCase):
    """Task Status report counts pending / in_progress / finished tasks."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("statususer")
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user)

    def _statuses_from_api(self):
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        return [t["status"] for t in tasks]

    def test_pending_status_returned(self):
        make_task(self.user, self.prop, status="pending")
        self.assertIn("pending", self._statuses_from_api())

    def test_in_progress_status_returned(self):
        make_task(self.user, self.prop, status="in_progress")
        self.assertIn("in_progress", self._statuses_from_api())

    def test_finished_status_returned(self):
        make_task(self.user, self.prop, status="finished", final_price=1000)
        self.assertIn("finished", self._statuses_from_api())

    def test_all_three_statuses_in_one_request(self):
        make_task(self.user, self.prop, status="pending")
        make_task(self.user, self.prop, status="in_progress")
        make_task(self.user, self.prop, status="finished", final_price=1000)
        statuses = self._statuses_from_api()
        self.assertEqual(sorted(statuses), ["finished", "in_progress", "pending"])


# ---------------------------------------------------------------------------
# 4. Vendor Performance Report
# ---------------------------------------------------------------------------

class VendorPerformanceReportTests(TestCase):
    """
    Vendor Performance aggregates vendor id, tasks, total cost, and completion
    rate.  The API must return vendor IDs on tasks and vendor list details.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("vendorperf")
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user)
        self.vendor = make_vendor(self.user, "Best Plumbers")

    def test_task_includes_vendor_id(self):
        make_task(self.user, self.prop, vendor=self.vendor, status="finished", final_price=5000)
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertEqual(tasks[0]["vendor"], self.vendor.pk)

    def test_vendor_list_returns_vendor_name(self):
        r = self.client.get("/api/vendors/")
        vendors = get_list(r)
        names = [v["name"] for v in vendors]
        self.assertIn("Best Plumbers", names)

    def test_vendor_task_with_final_price_for_cost_calc(self):
        make_task(self.user, self.prop, vendor=self.vendor, status="finished", final_price=12000)
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        vendor_tasks = [t for t in tasks if t["vendor"] == self.vendor.pk]
        self.assertEqual(len(vendor_tasks), 1)
        self.assertEqual(vendor_tasks[0]["final_price"], 12000)

    def test_task_without_vendor_has_null_vendor(self):
        make_task(self.user, self.prop, status="pending")
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertIsNone(tasks[0]["vendor"])

    def test_multiple_tasks_same_vendor(self):
        for _ in range(3):
            make_task(self.user, self.prop, vendor=self.vendor, status="finished", final_price=1000)
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        vendor_tasks = [t for t in tasks if t["vendor"] == self.vendor.pk]
        self.assertEqual(len(vendor_tasks), 3)


# ---------------------------------------------------------------------------
# 5. Maintenance History Report
# ---------------------------------------------------------------------------

class MaintenanceHistoryReportTests(TestCase):
    """History report shows the last 50 finished tasks ordered by date."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("histuser")
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user)

    def test_finished_tasks_visible(self):
        make_task(self.user, self.prop, status="finished", final_price=3000,
                  completed_date=date.today())
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        finished = [t for t in tasks if t["status"] == "finished"]
        self.assertEqual(len(finished), 1)

    def test_completed_date_field_present(self):
        make_task(self.user, self.prop, status="finished", final_price=3000,
                  completed_date=date.today())
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertIn("completed_date", tasks[0])
        self.assertIsNotNone(tasks[0]["completed_date"])

    def test_description_field_present(self):
        make_task(self.user, self.prop, status="finished", final_price=1000,
                  description="Fix boiler")
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertEqual(tasks[0]["description"], "Fix boiler")

    def test_pending_tasks_not_in_finished_filter(self):
        make_task(self.user, self.prop, status="pending")
        make_task(self.user, self.prop, status="finished", final_price=500)
        r = self.client.get("/api/tasks/?status=finished")
        tasks = get_list(r)
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0]["status"], "finished")


# ---------------------------------------------------------------------------
# 6. Monthly Costs Report
# ---------------------------------------------------------------------------

class MonthlyCostsReportTests(TestCase):
    """Monthly Costs aggregates costs per calendar month. All date & price
    fields must be present in the API response."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("monthuser")
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user)

    def test_created_date_field_present(self):
        make_task(self.user, self.prop, status="finished", final_price=8000)
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertIn("created_date", tasks[0])

    def test_due_date_field_present(self):
        make_task(self.user, self.prop, status="pending", due_date=date.today())
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertIn("due_date", tasks[0])

    def test_tasks_from_different_months(self):
        """API must return all tasks regardless of date for client-side filtering."""
        make_task(self.user, self.prop, status="finished", final_price=1000,
                  completed_date=date(2025, 1, 15))
        make_task(self.user, self.prop, status="finished", final_price=2000,
                  completed_date=date(2025, 3, 20))
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertEqual(len(tasks), 2)


# ---------------------------------------------------------------------------
# 7. Area Maintenance Report
# ---------------------------------------------------------------------------

class AreaMaintenanceReportTests(TestCase):
    """Area Maintenance shows task distribution across areas."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("areauser")
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user)

    def test_task_areas_field_present(self):
        area = make_area(self.prop, "Kitchen")
        task = make_task(self.user, self.prop, status="pending")
        task.areas.add(area)
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertIn("areas", tasks[0])

    def test_area_id_included_in_task_areas(self):
        area = make_area(self.prop, "Bathroom")
        task = make_task(self.user, self.prop)
        task.areas.add(area)
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertIn(area.pk, tasks[0]["areas"])

    def test_areas_endpoint_returns_area_type(self):
        make_area(self.prop, "Living room")
        r = self.client.get(f"/api/areas/?property={self.prop.pk}")
        areas = get_list(r)
        self.assertTrue(len(areas) >= 1)
        self.assertIn("type", areas[0])

    def test_task_with_no_areas_returns_empty_list(self):
        make_task(self.user, self.prop)
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertEqual(tasks[0]["areas"], [])


# ---------------------------------------------------------------------------
# 8. Maintenance Schedule Report
# ---------------------------------------------------------------------------

class MaintenanceScheduleReportTests(TestCase):
    """Schedule report lists pending/in_progress tasks with upcoming due dates."""

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("scheduser")
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user)

    def test_due_date_returned_for_pending_task(self):
        future = date.today() + timedelta(days=7)
        make_task(self.user, self.prop, status="pending", due_date=future)
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertEqual(tasks[0]["due_date"], str(future))

    def test_overdue_pending_task_still_returned(self):
        past = date.today() - timedelta(days=10)
        make_task(self.user, self.prop, status="pending", due_date=past)
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertEqual(len(tasks), 1)

    def test_priority_field_present_for_schedule_sorting(self):
        make_task(self.user, self.prop, status="pending", priority="high")
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertEqual(tasks[0]["priority"], "high")

    def test_filter_by_status_pending_returns_only_pending(self):
        make_task(self.user, self.prop, status="pending")
        make_task(self.user, self.prop, status="finished", final_price=1000)
        r = self.client.get("/api/tasks/?status=pending")
        tasks = get_list(r)
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0]["status"], "pending")

    def test_filter_by_status_in_progress(self):
        make_task(self.user, self.prop, status="in_progress")
        make_task(self.user, self.prop, status="pending")
        r = self.client.get("/api/tasks/?status=in_progress")
        tasks = get_list(r)
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0]["status"], "in_progress")


# ---------------------------------------------------------------------------
# 9. VAT Refunds Report
# ---------------------------------------------------------------------------

class VatRefundsReportTests(TestCase):
    """
    VAT Refund report tracks tasks where vat_refund_claimed is False and
    price_breakdown contains items with vat_refundable=True.
    Icelandic formula: work_amount * 0.24 (VAT) * 0.35 (refund rate).
    """

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("vatuser")
        self.client.force_authenticate(user=self.user)
        self.prop = make_property(self.user)

    def test_vat_refund_claimed_field_present(self):
        make_task(self.user, self.prop, status="finished", final_price=10000)
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertIn("vat_refund_claimed", tasks[0])

    def test_default_vat_refund_claimed_is_false(self):
        make_task(self.user, self.prop, status="finished", final_price=10000)
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertFalse(tasks[0]["vat_refund_claimed"])

    def test_price_breakdown_field_present(self):
        make_task(self.user, self.prop, status="finished", final_price=10000)
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertIn("price_breakdown", tasks[0])

    def test_price_breakdown_contains_vat_refundable_flag(self):
        task = make_task(self.user, self.prop, status="finished")
        task.final_price = 20000
        task.price_breakdown = [
            {"category": "work", "amount": 20000, "vat_refundable": True, "description": "Labour"}
        ]
        task.save()
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        breakdown = tasks[0]["price_breakdown"]
        work_items = [i for i in breakdown if i.get("category") == "work"]
        self.assertTrue(any(i["vat_refundable"] for i in work_items))

    def test_claimed_task_returned_with_flag_true(self):
        make_task(
            self.user, self.prop,
            status="finished", final_price=5000,
            vat_refund_claimed=True,
        )
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertTrue(tasks[0]["vat_refund_claimed"])

    def test_vat_refundable_work_item_vat_calculation(self):
        """
        VAT refund = work_amount * 0.24 * 0.35
        Verify the breakdown data is intact for the frontend to calculate.
        """
        work_amount = 100000
        expected_refund = int(work_amount * 0.24 * 0.35)  # 8400
        task = make_task(self.user, self.prop, status="finished")
        task.final_price = work_amount
        task.price_breakdown = [
            {"category": "work", "amount": work_amount, "vat_refundable": True, "description": ""}
        ]
        task.save()
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        breakdown = tasks[0]["price_breakdown"]
        work_items = [i for i in breakdown if i.get("category") == "work"]
        refundable_amount = sum(
            int(i["amount"]) for i in work_items if i.get("vat_refundable")
        )
        self.assertEqual(int(refundable_amount * 0.24 * 0.35), expected_refund)


# ---------------------------------------------------------------------------
# 10. Price-breakdown auto-calculation (model save logic)
# ---------------------------------------------------------------------------

class PriceBreakdownAutoCalcTests(TestCase):
    """The MaintenanceTask.save() auto-manages the 'uncategorized' breakdown entry."""

    def setUp(self):
        self.user = make_user("priceuser")
        self.prop = make_property(self.user)

    def test_sets_uncategorized_when_final_price_set_no_breakdown(self):
        task = make_task(self.user, self.prop, status="finished")
        task.final_price = 10000
        task.price_breakdown = []
        task.save()
        categories = [i["category"] for i in task.price_breakdown]
        self.assertIn("uncategorized", categories)

    def test_uncategorized_amount_equals_final_price_with_no_other_items(self):
        task = make_task(self.user, self.prop, status="finished")
        task.final_price = 15000
        task.price_breakdown = []
        task.save()
        uncategorized = next(i for i in task.price_breakdown if i["category"] == "uncategorized")
        self.assertEqual(uncategorized["amount"], 15000)

    def test_uncategorized_is_remainder_when_other_items_present(self):
        task = make_task(self.user, self.prop, status="finished")
        task.final_price = 10000
        task.price_breakdown = [
            {"category": "work", "amount": 6000, "vat_refundable": True, "description": ""}
        ]
        task.save()
        uncategorized = next(i for i in task.price_breakdown if i["category"] == "uncategorized")
        self.assertEqual(uncategorized["amount"], 4000)

    def test_uncategorized_removed_when_items_cover_full_price(self):
        task = make_task(self.user, self.prop, status="finished")
        task.final_price = 5000
        task.price_breakdown = [
            {"category": "work", "amount": 5000, "vat_refundable": True, "description": ""}
        ]
        task.save()
        categories = [i["category"] for i in task.price_breakdown]
        self.assertNotIn("uncategorized", categories)

    def test_price_breakdown_cleared_when_final_price_removed(self):
        task = make_task(self.user, self.prop, status="finished")
        task.final_price = 10000
        task.save()
        task.final_price = None
        task.save()
        self.assertEqual(task.price_breakdown, [])


# ---------------------------------------------------------------------------
# 11. Data isolation – users only see their own data
# ---------------------------------------------------------------------------

class ReportsDataIsolationTests(TestCase):
    """Report data must be scoped to the authenticated user."""

    def setUp(self):
        self.user_a = make_user("user_a")
        self.user_b = make_user("user_b")
        self.prop_a = make_property(self.user_a, "A's Property")
        self.prop_b = make_property(self.user_b, "B's Property")
        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.user_a)

    def test_user_cannot_see_other_users_tasks(self):
        make_task(self.user_a, self.prop_a, description="A's task")
        make_task(self.user_b, self.prop_b, description="B's task")
        r = self.client_a.get("/api/tasks/")
        tasks = get_list(r)
        descriptions = [t["description"] for t in tasks]
        self.assertIn("A's task", descriptions)
        self.assertNotIn("B's task", descriptions)

    def test_user_cannot_see_other_users_properties(self):
        r = self.client_a.get("/api/properties/")
        props = get_list(r)
        names = [p["name"] for p in props]
        self.assertIn("A's Property", names)
        self.assertNotIn("B's Property", names)

    def test_user_cannot_see_other_users_personal_vendors(self):
        make_vendor(self.user_a, "A's Vendor")
        make_vendor(self.user_b, "B's Vendor")
        r = self.client_a.get("/api/vendors/")
        vendors = get_list(r)
        names = [v["name"] for v in vendors]
        self.assertIn("A's Vendor", names)
        self.assertNotIn("B's Vendor", names)

    def test_empty_result_when_user_has_no_tasks(self):
        # user_a has no tasks; user_b does
        make_task(self.user_b, self.prop_b)
        r = self.client_a.get("/api/tasks/")
        tasks = get_list(r)
        self.assertEqual(len(tasks), 0)


# ---------------------------------------------------------------------------
# 12. Shared data access
# ---------------------------------------------------------------------------

class ReportsSharedDataTests(TestCase):
    """
    When user B shares data with user A, user A must see user B's tasks
    (and properties) in report endpoints.
    """

    def setUp(self):
        self.owner = make_user("owner")
        self.viewer = make_user("viewer")
        self.prop = make_property(self.owner, "Owner's Flat")
        # Grant read access to viewer
        DataShare.objects.create(
            owner=self.owner,
            shared_with=self.viewer,
            permissions={"tasks": "ro", "properties": "ro", "vendors": "ro",
                         "areas": "ro", "attachments": "ro"},
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.viewer)

    def test_shared_tasks_visible_to_viewer(self):
        make_task(self.owner, self.prop, description="Shared task", status="pending")
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        descriptions = [t["description"] for t in tasks]
        self.assertIn("Shared task", descriptions)

    def test_viewer_own_tasks_also_visible(self):
        viewer_prop = make_property(self.viewer, "Viewer's Place")
        make_task(self.viewer, viewer_prop, description="Viewer task")
        make_task(self.owner, self.prop, description="Owner task")
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        descriptions = [t["description"] for t in tasks]
        self.assertIn("Viewer task", descriptions)
        self.assertIn("Owner task", descriptions)

    def test_unshared_third_party_tasks_not_visible(self):
        third = make_user("third")
        third_prop = make_property(third, "Third's Flat")
        make_task(third, third_prop, description="Third's task")
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        descriptions = [t["description"] for t in tasks]
        self.assertNotIn("Third's task", descriptions)

    def test_shared_financial_data_visible_for_cost_report(self):
        make_task(self.owner, self.prop, status="finished", final_price=99000)
        r = self.client.get("/api/tasks/")
        tasks = get_list(r)
        self.assertEqual(tasks[0]["final_price"], 99000)


# ---------------------------------------------------------------------------
# 13. API filtering – used by the frontend to fetch subsets of data
# ---------------------------------------------------------------------------

class ReportsFilteringTests(TestCase):
    """
    The frontend passes ?status=, ?property=, ?vendor=, ?task_type= to narrow
    data for specific report views.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = make_user("filteruser")
        self.client.force_authenticate(user=self.user)
        self.prop1 = make_property(self.user, "Prop 1")
        self.prop2 = make_property(self.user, "Prop 2")
        self.vendor = make_vendor(self.user, "Filter Vendor")
        self.task_type = make_task_type("Electrical")

    def test_filter_by_property(self):
        make_task(self.user, self.prop1, description="T1")
        make_task(self.user, self.prop2, description="T2")
        r = self.client.get(f"/api/tasks/?property={self.prop1.pk}")
        tasks = get_list(r)
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0]["description"], "T1")

    def test_filter_by_vendor(self):
        make_task(self.user, self.prop1, vendor=self.vendor, description="With vendor")
        make_task(self.user, self.prop1, description="No vendor")
        r = self.client.get(f"/api/tasks/?vendor={self.vendor.pk}")
        tasks = get_list(r)
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0]["description"], "With vendor")

    def test_filter_by_task_type(self):
        make_task(self.user, self.prop1, task_type=self.task_type, description="Typed")
        make_task(self.user, self.prop1, description="Untyped")
        r = self.client.get(f"/api/tasks/?task_type={self.task_type.pk}")
        tasks = get_list(r)
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0]["description"], "Typed")

    def test_filter_by_status_finished_for_history_report(self):
        make_task(self.user, self.prop1, status="finished", final_price=1000)
        make_task(self.user, self.prop1, status="pending")
        make_task(self.user, self.prop1, status="in_progress")
        r = self.client.get("/api/tasks/?status=finished")
        tasks = get_list(r)
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0]["status"], "finished")

    def test_combined_filter_property_and_status(self):
        make_task(self.user, self.prop1, status="finished", final_price=500, description="P1 done")
        make_task(self.user, self.prop1, status="pending", description="P1 pending")
        make_task(self.user, self.prop2, status="finished", final_price=500, description="P2 done")
        r = self.client.get(f"/api/tasks/?property={self.prop1.pk}&status=finished")
        tasks = get_list(r)
        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0]["description"], "P1 done")
