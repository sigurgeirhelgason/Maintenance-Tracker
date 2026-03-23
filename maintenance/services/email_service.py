from django.core.mail import send_mail
from django.conf import settings


def send_ownership_transfer_email(transfer):
    """
    Send a confirmation email to the initiating user (from_user) containing
    a link that — when clicked — will execute the ownership transfer.

    The recipient must visit the link to confirm the transfer. This keeps the
    confirmation in the hands of the person giving away the property, preventing
    unintended transfers.
    """
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    confirm_url = f"{frontend_url}/confirm-transfer/{transfer.token}"

    print (f"Generated confirmation URL: {confirm_url}")  # Debug print
    print(f"Transfer details: from_user={transfer.from_user.email}, to_user={transfer.to_user.email}, property={transfer.property.name}")  # Debug print
    print (f"Email settings: EMAIL_HOST={settings.EMAIL_HOST}, EMAIL_PORT={settings.EMAIL_PORT}, EMAIL_HOST_USER={settings.EMAIL_HOST_USER}, DEFAULT_FROM_EMAIL={settings.DEFAULT_FROM_EMAIL}")  # Debug print
    

    property_name = transfer.property.name
    to_email = transfer.to_user.email

    subject = f"Confirm Property Ownership Transfer - {property_name}"

    body = (
        f"You have initiated a transfer of ownership for the property \"{property_name}\" "
        f"to {to_email}.\n\n"
        f"To complete the transfer, please click the link below:\n\n"
        f"{confirm_url}\n\n"
        f"This link will expire in 48 hours. If you did not initiate this transfer, "
        f"you can safely ignore this email.\n\n"
        f"— Maintenance Tracker"
    )
    #debug prints
    print(f"Sending ownership transfer email to {transfer.from_user.email} with subject: {subject}")
    

    send_mail(
        subject=subject,
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[transfer.from_user.email],
        fail_silently=False,
    )
