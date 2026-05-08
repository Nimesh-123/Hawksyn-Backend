# Hawksyn Admin: 2FA (Google Authenticator) Implementation Guide

This guide outlines the technical steps to add Two-Factor Authentication (2FA) using the TOTP standard (compatible with Google Authenticator, Microsoft Authenticator, etc.) to the Hawksyn Admin Panel.

## 1. Overview
The implementation uses a **Shared Secret** between the server and the user's mobile app. Both generate a 6-digit code every 30 seconds based on the current time. No internet is required for code generation.

## 2. Prerequisites
Install the required libraries:
```bash
npm install speakeasy qrcode
```

## 3. Database Schema Updates
Update your Admin/User model to store the 2FA metadata:

```javascript
// Example Schema Update
{
  twoFactorSecret: { type: String, default: null },
  isTwoFactorEnabled: { type: Boolean, default: false },
  twoFactorBackupCodes: [{ type: String }] 
}
```

## 4. Backend Implementation Flow

### Step A: Generate Secret & QR Code
When the admin requests to enable 2FA:
1.  **Secret Generation**: Use `speakeasy.generateSecret()` to create a base32 secret.
2.  **QR Code**: Generate a DataURL using `qrcode.toDataURL(secret.otpauth_url)`.
3.  **Frontend**: Display this QR code to the user.

### Step B: Verify & Activate
Admin scans the code and enters the 6-digit pin from their app:
1.  **Verification**: Use `speakeasy.totp.verify()` with the user's secret and the token they provided.
2.  **Persistence**: If valid, save the secret to the user's document and set `isTwoFactorEnabled = true`.

### Step C: Login Flow
Update the login API:
1.  Verify Email/Password as usual.
2.  If 2FA is enabled for the user, do NOT issue a JWT yet. Instead, return a status indicating MFA is required.
3.  The user enters their 6-digit code on a new screen.
4.  Backend verifies the code. Only then is the final JWT issued.

## 5. Security Best Practices
- **Window Buffer**: Use `window: 1` in verification to account for slight time drift on user devices.
- **Recovery**: Always provide "Backup Codes" in case the user loses their phone.
- **Re-Verification**: Require the current 2FA code to be entered before a user can disable or change their 2FA settings.
