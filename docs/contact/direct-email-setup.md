# Contact Us — direct email delivery

Contact form: `/contact`  
Server endpoint: `POST /api/contact`  
Recipient: `support@fieldsconnect.app`

The form sends a plain-text email through Resend using server-side secrets. Visitors enter their name, **email address**, subject and message. Their address is set as `reply_to` so support can answer them directly.

## Required Vercel production configuration

1. In [Resend](https://resend.com/domains), verify **fieldsconnect.app** by adding its required DNS records (SPF/DKIM as instructed by Resend). This is domain authentication for sending and does not replace the existing mailbox or its inbound MX records.
2. Create a **sending-only** Resend API key restricted to the verified domain.
3. In the Vercel **FieldsConnect project** add these as encrypted Production environment variables:
   - `RESEND_API_KEY`: secret token from Resend.
   - `CONTACT_FROM_EMAIL`: `FieldsConnect <no-reply@fieldsconnect.app>` (the domain must be verified in Resend).
4. Redeploy the production deployment so Vercel picks up the new variables.
5. Submit one test enquiry with an email address you control and confirm that it arrives in `support@fieldsconnect.app`. Verify that Reply uses the visitor's address.

Do **not** put the API key in source control, a `NEXT_PUBLIC_` variable, chat, or browser code.

The handler intentionally returns **503** while mail delivery has not been configured; it never claims a message was sent. The form offers a direct mailto link if the API fails. A successful HTTP response confirms the provider accepted the email request, not that the receiving mailbox delivered it.

The endpoint validates required fields, maximum lengths, request origin, content size, and a honeypot; includes a best-effort per-instance rate limit. Consider adding durable abuse protection (such as a shared rate limiter or Turnstile) before significant public traffic.
