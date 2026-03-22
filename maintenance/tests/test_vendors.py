"""
Vendor feature tests — backend (Django/pytest).

Focused test scenarios per PENDING_TESTS.md (2026-03-21):
  1. API returns `is_global` correctly on vendor responses
  2. Personal vendors have is_global=False; global vendors have is_global=True
  3. toggle_favorite endpoint works correctly
  4. Vendor list returns the correct vendors per user
     (own personal + global, never other users' personal)
  5. Unauthenticated users cannot access any vendor endpoint
"""

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from maintenance.models import Vendor, UserVendorPreference


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user(username, is_staff=False):
    return User.objects.create_user(
        username=username,
        email=f'{username}@example.com',
        password='testpass123',
        is_staff=is_staff,
    )


def _vendor(user, name='Test Vendor', is_global=False):
    return Vendor.objects.create(user=user, name=name, is_global=is_global)


# ---------------------------------------------------------------------------
# 1 & 2 — is_global field correctness
# ---------------------------------------------------------------------------

class IsGlobalFieldTests(TestCase):
    """
    Verify that the API reflects is_global correctly:
    - personal vendors → is_global == False
    - global vendors   → is_global == True
    """

    def setUp(self):
        self.client = APIClient()
        self.admin = _user('ig_admin', is_staff=True)
        self.user = _user('ig_user')
        self.client.force_authenticate(user=self.user)

        self.personal_vendor = _vendor(self.user, 'Personal Vendor', is_global=False)
        self.global_vendor = _vendor(self.admin, 'Global Vendor', is_global=True)

    # --- list endpoint ---

    def test_personal_vendor_is_global_false_in_list(self):
        """Personal vendors must have is_global=False in the list response."""
        response = self.client.get('/api/vendors/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        personal = next(v for v in response.data if v['id'] == self.personal_vendor.id)
        self.assertFalse(personal['is_global'])

    def test_global_vendor_is_global_true_in_list(self):
        """Global vendors must have is_global=True in the list response."""
        response = self.client.get('/api/vendors/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        global_v = next(v for v in response.data if v['id'] == self.global_vendor.id)
        self.assertTrue(global_v['is_global'])

    # --- detail endpoint ---

    def test_personal_vendor_is_global_false_in_detail(self):
        """Personal vendor detail must have is_global=False."""
        response = self.client.get(f'/api/vendors/{self.personal_vendor.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_global'])

    def test_global_vendor_is_global_true_in_detail(self):
        """Global vendor detail must have is_global=True."""
        response = self.client.get(f'/api/vendors/{self.global_vendor.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_global'])

    def test_is_global_field_present_in_create_response(self):
        """Newly created personal vendor response must include is_global=False."""
        response = self.client.post('/api/vendors/', {'name': 'Brand New'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('is_global', response.data)
        self.assertFalse(response.data['is_global'])

    def test_admin_create_global_vendor_is_global_true_in_response(self):
        """Admin-created global vendor must reflect is_global=True in the response."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            '/api/vendors/',
            {'name': 'Admin Global', 'is_global': True},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['is_global'])

    def test_is_global_read_only_for_regular_user(self):
        """
        A regular user cannot flip is_global=True on their own vendor;
        the field is read-only for non-staff and must raise 403.
        """
        response = self.client.patch(
            f'/api/vendors/{self.personal_vendor.id}/',
            {'is_global': True},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.personal_vendor.refresh_from_db()
        self.assertFalse(self.personal_vendor.is_global)


# ---------------------------------------------------------------------------
# 3 — toggle_favorite endpoint
# ---------------------------------------------------------------------------

class ToggleFavoriteEndpointTests(TestCase):
    """
    Comprehensive checks for the toggle_favorite action:
    - toggling on / off (state machine)
    - works for both personal and global vendors
    - response shape includes detail message and vendor data
    - favorite is user-scoped (other users unaffected)
    - 404 for non-existent vendor
    """

    def setUp(self):
        self.client = APIClient()
        self.user = _user('tf_user')
        self.other = _user('tf_other')
        self.admin = _user('tf_admin', is_staff=True)
        self.client.force_authenticate(user=self.user)

        self.personal = _vendor(self.user, 'Personal TF Vendor')
        self.global_v = _vendor(self.admin, 'Global TF Vendor', is_global=True)

    def test_toggle_favorite_on_personal_vendor(self):
        """First toggle marks vendor as favorite."""
        response = self.client.post(f'/api/vendors/{self.personal.id}/toggle_favorite/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pref = UserVendorPreference.objects.get(user=self.user, vendor=self.personal)
        self.assertTrue(pref.is_favorite)

    def test_toggle_favorite_off_personal_vendor(self):
        """Second toggle removes favorite status."""
        self.client.post(f'/api/vendors/{self.personal.id}/toggle_favorite/')
        self.client.post(f'/api/vendors/{self.personal.id}/toggle_favorite/')
        pref = UserVendorPreference.objects.get(user=self.user, vendor=self.personal)
        self.assertFalse(pref.is_favorite)

    def test_toggle_favorite_on_global_vendor(self):
        """Users can favorite global vendors."""
        response = self.client.post(f'/api/vendors/{self.global_v.id}/toggle_favorite/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pref = UserVendorPreference.objects.get(user=self.user, vendor=self.global_v)
        self.assertTrue(pref.is_favorite)

    def test_toggle_favorite_odd_calls_result_in_true(self):
        """Three toggles leaves favorite=True."""
        for _ in range(3):
            self.client.post(f'/api/vendors/{self.personal.id}/toggle_favorite/')
        pref = UserVendorPreference.objects.get(user=self.user, vendor=self.personal)
        self.assertTrue(pref.is_favorite)

    def test_toggle_favorite_response_has_detail_message(self):
        """Response body must contain a 'detail' key."""
        response = self.client.post(f'/api/vendors/{self.personal.id}/toggle_favorite/')
        self.assertIn('detail', response.data)

    def test_toggle_favorite_response_has_vendor_id(self):
        """Response body must contain vendor 'id'."""
        response = self.client.post(f'/api/vendors/{self.personal.id}/toggle_favorite/')
        self.assertIn('id', response.data)
        self.assertEqual(response.data['id'], self.personal.id)

    def test_toggle_favorite_response_has_is_global(self):
        """Response body must carry is_global so the frontend can read it."""
        response = self.client.post(f'/api/vendors/{self.global_v.id}/toggle_favorite/')
        self.assertIn('is_global', response.data)
        self.assertTrue(response.data['is_global'])

    def test_toggle_favorite_creates_preference_row(self):
        """The first toggle must create a UserVendorPreference record."""
        self.assertFalse(
            UserVendorPreference.objects.filter(user=self.user, vendor=self.personal).exists()
        )
        self.client.post(f'/api/vendors/{self.personal.id}/toggle_favorite/')
        self.assertTrue(
            UserVendorPreference.objects.filter(user=self.user, vendor=self.personal).exists()
        )

    def test_toggle_favorite_is_user_scoped(self):
        """Toggling favorite for user must not create a pref row for other user."""
        self.client.post(f'/api/vendors/{self.personal.id}/toggle_favorite/')
        self.assertFalse(
            UserVendorPreference.objects.filter(
                user=self.other, vendor=self.personal
            ).exists()
        )

    def test_toggle_favorite_two_users_independent(self):
        """Two different users can independently favorite the same global vendor."""
        self.client.force_authenticate(user=self.user)
        self.client.post(f'/api/vendors/{self.global_v.id}/toggle_favorite/')

        other_client = APIClient()
        other_client.force_authenticate(user=self.other)
        other_client.post(f'/api/vendors/{self.global_v.id}/toggle_favorite/')

        user_pref = UserVendorPreference.objects.get(user=self.user, vendor=self.global_v)
        other_pref = UserVendorPreference.objects.get(user=self.other, vendor=self.global_v)
        self.assertTrue(user_pref.is_favorite)
        self.assertTrue(other_pref.is_favorite)

    def test_toggle_favorite_unfavorite_does_not_affect_other_user(self):
        """User unfavoriting must not change the other user's favorite state."""
        # Both users favorite the vendor first
        self.client.post(f'/api/vendors/{self.global_v.id}/toggle_favorite/')
        other_client = APIClient()
        other_client.force_authenticate(user=self.other)
        other_client.post(f'/api/vendors/{self.global_v.id}/toggle_favorite/')

        # user unfavorites
        self.client.post(f'/api/vendors/{self.global_v.id}/toggle_favorite/')

        user_pref = UserVendorPreference.objects.get(user=self.user, vendor=self.global_v)
        other_pref = UserVendorPreference.objects.get(user=self.other, vendor=self.global_v)
        self.assertFalse(user_pref.is_favorite)
        self.assertTrue(other_pref.is_favorite)

    def test_toggle_favorite_nonexistent_vendor_returns_404(self):
        """toggle_favorite on a missing vendor must return 404."""
        response = self.client.post('/api/vendors/999999/toggle_favorite/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_favorite_field_in_list_response_reflects_state(self):
        """After toggling, the list response must return favorite=True for that vendor."""
        self.client.post(f'/api/vendors/{self.personal.id}/toggle_favorite/')
        response = self.client.get('/api/vendors/')
        vendor_data = next(v for v in response.data if v['id'] == self.personal.id)
        self.assertTrue(vendor_data['favorite'])

    def test_favorite_field_defaults_to_false_in_list(self):
        """Before any toggle, favorite should be False for all vendors."""
        response = self.client.get('/api/vendors/')
        for vendor in response.data:
            self.assertFalse(vendor['favorite'], msg=f"Expected favorite=False for vendor {vendor['id']}")

    def test_favorite_field_in_detail_response_reflects_state(self):
        """After toggling, the detail response must return favorite=True."""
        self.client.post(f'/api/vendors/{self.personal.id}/toggle_favorite/')
        response = self.client.get(f'/api/vendors/{self.personal.id}/')
        self.assertTrue(response.data['favorite'])


# ---------------------------------------------------------------------------
# 4 — Vendor list: correct vendors per user
# ---------------------------------------------------------------------------

class VendorListScopeTests(TestCase):
    """
    Verify that the vendor list endpoint returns exactly the right set of
    vendors for each authenticated user:
      - own personal vendors (is_global=False, user=self)
      - all global vendors (is_global=True, any owner)
      - NOT another user's personal vendors
    """

    def setUp(self):
        self.client = APIClient()
        self.user_a = _user('scope_a')
        self.user_b = _user('scope_b')
        self.admin = _user('scope_admin', is_staff=True)

        # user_a personal vendor
        self.vendor_a = _vendor(self.user_a, 'User A Vendor')
        # user_b personal vendor
        self.vendor_b = _vendor(self.user_b, 'User B Vendor')
        # global vendor
        self.global_v = _vendor(self.admin, 'Global Scope Vendor', is_global=True)

    # --- user_a sees their own + global, not user_b's ---

    def test_user_sees_own_personal_vendor_in_list(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/vendors/')
        ids = [v['id'] for v in response.data]
        self.assertIn(self.vendor_a.id, ids)

    def test_user_sees_global_vendor_in_list(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/vendors/')
        ids = [v['id'] for v in response.data]
        self.assertIn(self.global_v.id, ids)

    def test_user_does_not_see_other_users_personal_vendor(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/vendors/')
        ids = [v['id'] for v in response.data]
        self.assertNotIn(self.vendor_b.id, ids)

    # --- user_b sees their own + global, not user_a's ---

    def test_user_b_sees_own_personal_vendor(self):
        self.client.force_authenticate(user=self.user_b)
        response = self.client.get('/api/vendors/')
        ids = [v['id'] for v in response.data]
        self.assertIn(self.vendor_b.id, ids)

    def test_user_b_sees_global_vendor(self):
        self.client.force_authenticate(user=self.user_b)
        response = self.client.get('/api/vendors/')
        ids = [v['id'] for v in response.data]
        self.assertIn(self.global_v.id, ids)

    def test_user_b_does_not_see_user_a_personal_vendor(self):
        self.client.force_authenticate(user=self.user_b)
        response = self.client.get('/api/vendors/')
        ids = [v['id'] for v in response.data]
        self.assertNotIn(self.vendor_a.id, ids)

    def test_user_cannot_retrieve_other_users_personal_vendor_by_id(self):
        """
        GET /api/vendors/<id>/ for a vendor that belongs to another user
        must return 404 (filtered out by get_queryset).
        """
        self.client.force_authenticate(user=self.user_b)
        response = self.client.get(f'/api/vendors/{self.vendor_a.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_multiple_global_vendors_all_visible(self):
        """All global vendors appear in every user's list."""
        extra_global = _vendor(self.admin, 'Extra Global', is_global=True)
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/vendors/')
        ids = [v['id'] for v in response.data]
        self.assertIn(self.global_v.id, ids)
        self.assertIn(extra_global.id, ids)

    def test_user_with_no_personal_vendors_still_sees_globals(self):
        """A brand-new user with zero personal vendors still sees global vendors."""
        new_user = _user('scope_new')
        self.client.force_authenticate(user=new_user)
        response = self.client.get('/api/vendors/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [v['id'] for v in response.data]
        self.assertIn(self.global_v.id, ids)
        self.assertNotIn(self.vendor_a.id, ids)
        self.assertNotIn(self.vendor_b.id, ids)

    def test_list_response_is_200_ok(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/vendors/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_empty_personal_list_returns_only_globals(self):
        """
        When a user has deleted all personal vendors (none exist for them),
        only global vendors show up.
        """
        new_user = _user('scope_empty')
        self.client.force_authenticate(user=new_user)
        response = self.client.get('/api/vendors/')
        for vendor_data in response.data:
            self.assertTrue(
                vendor_data['is_global'],
                msg=f"Expected only global vendors for user with no personal vendors, "
                    f"but found vendor id={vendor_data['id']} with is_global=False",
            )


# ---------------------------------------------------------------------------
# 5 — Unauthenticated access denied
# ---------------------------------------------------------------------------

class VendorUnauthenticatedTests(TestCase):
    """
    Every vendor endpoint must reject unauthenticated requests with 401.
    """

    def setUp(self):
        self.client = APIClient()  # no authentication
        owner = _user('unauth_owner')
        self.vendor = _vendor(owner, 'Unauth Vendor')

    def test_list_requires_auth(self):
        response = self.client.get('/api/vendors/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_requires_auth(self):
        response = self.client.post('/api/vendors/', {'name': 'X'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_retrieve_requires_auth(self):
        response = self.client.get(f'/api/vendors/{self.vendor.id}/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_update_requires_auth(self):
        response = self.client.put(
            f'/api/vendors/{self.vendor.id}/',
            {'name': 'Updated'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_patch_requires_auth(self):
        response = self.client.patch(
            f'/api/vendors/{self.vendor.id}/',
            {'name': 'Patched'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_delete_requires_auth(self):
        response = self.client.delete(f'/api/vendors/{self.vendor.id}/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_toggle_favorite_requires_auth(self):
        response = self.client.post(f'/api/vendors/{self.vendor.id}/toggle_favorite/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_toggle_saved_requires_auth(self):
        response = self.client.post(f'/api/vendors/{self.vendor.id}/toggle_saved/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
