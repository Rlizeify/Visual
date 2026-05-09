# Supabase Auth Branding Configuration

This guide covers the Supabase dashboard settings needed to brand auth emails and fix redirect URLs for the production domain (https://mheu.lol).

## 1. Set Site URL

**Path:** Supabase Dashboard → Authentication → URL Configuration

1. Open your Supabase project dashboard
2. Click **Authentication** in the left sidebar
3. Click **URL Configuration** tab
4. Set **Site URL** to: `https://mheu.lol`
5. Click **Save**

This is the URL users will be redirected to after email confirmation.

## 2. Add Redirect URLs

**Path:** Supabase Dashboard → Authentication → URL Configuration

In the same **URL Configuration** tab:

1. Under **Redirect URLs**, click **Add URL**
2. Add these entries:
   - `https://mheu.lol/**`
   - `https://mheu.lol/callback`
   - `https://mheu.lol/m`
3. Click **Save**

The wildcard `/**` allows any path on mheu.lol to be a valid redirect target.

## 3. Edit Email Templates

**Path:** Supabase Dashboard → Authentication → Email Templates

### How to Install Templates

1. Go to **Authentication** → **Email Templates** in your Supabase dashboard
2. Select the template type from the dropdown (e.g., "Confirm signup")
3. Set the **Subject** in the subject field (not in the HTML)
4. Set the **From Name** to `MHEU`
5. Paste the HTML body into the **Message** field
6. Click **Save**

**Important:**
- Template variables like `{{ .ConfirmationURL }}` must stay as literal text — do not replace them with actual URLs
- Supabase will substitute these variables when sending the email
- The HTML uses inline styles only (no `<style>` blocks) for maximum email client compatibility

---

### Confirm Signup Email

1. Click **Email Templates** tab
2. Select **Confirm signup** from the dropdown
3. Update these fields:

**Subject:**
```
Confirm your MHEU account
```

**From Name:**
```
MHEU
```

**Message Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: rgba(0,20,30,1); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: rgba(0,20,30,1);">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: rgba(0,30,45,0.9); border: 1px solid rgba(0,220,200,0.3); border-radius: 12px;">
          <tr>
            <td style="padding: 40px 32px; text-align: center;">
              <!-- Logo / Title -->
              <h1 style="margin: 0 0 8px 0; font-size: 32px; font-weight: 600; color: #00dcc8; letter-spacing: 0.15em;">
                MHEU
              </h1>
              <p style="margin: 0 0 32px 0; font-size: 12px; color: rgba(180,240,235,0.6); letter-spacing: 0.1em; text-transform: uppercase;">
                Music · Health · Entertainment · User
              </p>

              <!-- Main content -->
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 500; color: #ffffff;">
                Confirm your email
              </h2>
              <p style="margin: 0 0 32px 0; font-size: 14px; color: rgba(180,240,235,0.8); line-height: 1.6;">
                Click the button below to verify your email address and activate your MHEU account.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 6px; background-color: #00dcc8;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 600; color: rgba(0,20,30,1); text-decoration: none; letter-spacing: 0.05em; text-transform: uppercase;">
                      Confirm Email
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin: 32px 0 0 0; font-size: 12px; color: rgba(180,240,235,0.5);">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: rgba(0,220,200,0.7); word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid rgba(0,220,200,0.15); text-align: center;">
              <p style="margin: 0; font-size: 11px; color: rgba(180,240,235,0.4);">
                You received this email because you signed up for MHEU.<br>
                If you didn't create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

**Plain-text fallback** (for email clients that strip HTML):
```
MHEU — Confirm your email

Click the link below to verify your email address and activate your MHEU account:

{{ .ConfirmationURL }}

If you didn't create an account, you can safely ignore this email.
```

4. Click **Save**

---

### Password Reset Email

1. Select **Reset password** from the dropdown
2. Update:

**Subject:**
```
Reset your MHEU password
```

**From Name:**
```
MHEU
```

**Message Body (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: rgba(0,20,30,1); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: rgba(0,20,30,1);">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: rgba(0,30,45,0.9); border: 1px solid rgba(0,220,200,0.3); border-radius: 12px;">
          <tr>
            <td style="padding: 40px 32px; text-align: center;">
              <!-- Logo / Title -->
              <h1 style="margin: 0 0 8px 0; font-size: 32px; font-weight: 600; color: #00dcc8; letter-spacing: 0.15em;">
                MHEU
              </h1>
              <p style="margin: 0 0 32px 0; font-size: 12px; color: rgba(180,240,235,0.6); letter-spacing: 0.1em; text-transform: uppercase;">
                Music · Health · Entertainment · User
              </p>

              <!-- Main content -->
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 500; color: #ffffff;">
                Reset your password
              </h2>
              <p style="margin: 0 0 32px 0; font-size: 14px; color: rgba(180,240,235,0.8); line-height: 1.6;">
                We received a request to reset your password. Click the button below to choose a new one.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 6px; background-color: #00dcc8;">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 600; color: rgba(0,20,30,1); text-decoration: none; letter-spacing: 0.05em; text-transform: uppercase;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin: 32px 0 0 0; font-size: 12px; color: rgba(180,240,235,0.5);">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: rgba(0,220,200,0.7); word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid rgba(0,220,200,0.15); text-align: center;">
              <p style="margin: 0; font-size: 11px; color: rgba(180,240,235,0.4);">
                If you didn't request this, ignore this email — your password won't change.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

**Plain-text fallback** (for email clients that strip HTML):
```
MHEU — Reset your password

We received a request to reset your password. Click the link below to choose a new one:

{{ .ConfirmationURL }}

If you didn't request this, ignore this email — your password won't change.
```

3. Click **Save**

## 4. Configure SMTP (Optional but Recommended)

**Path:** Supabase Dashboard → Project Settings → Authentication → SMTP Settings

By default, Supabase uses their built-in email service which shows "noreply@mail.app.supabase.io" as the sender. To use a custom "from" address:

1. Go to **Project Settings** → **Authentication**
2. Scroll to **SMTP Settings**
3. Toggle **Enable Custom SMTP**
4. Enter your SMTP provider details:
   - **Sender email**: `noreply@mheu.lol` (or your preferred address)
   - **Sender name**: `MHEU`
   - **Host**: Your SMTP host
   - **Port**: 587 (TLS) or 465 (SSL)
   - **Username/Password**: Your SMTP credentials
5. Click **Save**

Popular SMTP options:
- **Resend** (recommended, free tier)
- **SendGrid**
- **Mailgun**
- **Amazon SES**

## Summary Checklist

- [ ] Site URL set to `https://mheu.lol`
- [ ] Redirect URLs include `https://mheu.lol/**`
- [ ] "Confirm signup" email template updated with MHEU branding
- [ ] "Reset password" email template updated with MHEU branding
- [ ] (Optional) Custom SMTP configured for branded sender address
