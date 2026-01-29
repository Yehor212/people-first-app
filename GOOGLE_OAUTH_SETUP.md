# Google OAuth Setup for ZenFlow Android

## Prerequisites

- Google Cloud Console access
- Supabase project access (bwgfslmxmueyglpumkbf)
- Firebase project access (zenflow-192e8)
- Android keystore (debug or release)

## Step-by-Step Setup

### 1. Get SHA-1 Fingerprint

#### For Debug Build (Testing)

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

On Windows:
```bash
keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android
```

#### For Release Build (Production)

```bash
cd android
keytool -list -v -keystore app/release.keystore -alias zenflow-key
# You will be prompted for keystore password
```

Copy the SHA1 fingerprint from output:
```
SHA1: AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD
```

### 2. Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **zenflow-192e8**
3. Navigate to: **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Configure:
   - **Application type**: Android
   - **Name**: ZenFlow Android (Debug) or ZenFlow Android (Release)
   - **Package name**: `com.zenflow.app`
   - **SHA-1 certificate fingerprint**: [paste from step 1]
6. Click **Create**
7. Copy the **Client ID** (format: `xxxxx.apps.googleusercontent.com`)

**Important Notes:**
- Create separate OAuth clients for debug and release builds (different SHA-1)
- Wait 5-10 minutes for changes to propagate

### 3. Configure Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select project: **bwgfslmxmueyglpumkbf**
3. Navigate to: **Authentication → Providers → Google**
4. Enable Google provider (toggle ON)
5. Add **Client ID** from step 2 in the "Authorized Client IDs" field
   - If you have both debug and release, add both Client IDs separated by commas
6. Navigate to: **Authentication → URL Configuration**
7. Add to **Redirect URLs**:
   ```
   com.zenflow.app://login-callback
   https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/callback
   ```
8. Add to **Site URL**: `com.zenflow.app://`
9. Click **Save**

**Important Notes:**
- Wait 5 minutes for Supabase changes to propagate
- Do NOT use trailing slashes in redirect URLs

### 4. Update google-services.json

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **zenflow-192e8**
3. Navigate to: **Project Settings → General**
4. Find Android app: `com.zenflow.app`
5. Click **Download google-services.json**
6. Replace `android/app/google-services.json` with the new file

After updating, verify `oauth_client` contains your configuration:
```json
{
  "oauth_client": [
    {
      "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
      "client_type": 1,
      "android_info": {
        "package_name": "com.zenflow.app",
        "certificate_hash": "YOUR_SHA1_FINGERPRINT"
      }
    }
  ]
}
```

### 5. Rebuild and Test

```bash
# Sync Capacitor
npm run cap:sync:android

# Open Android Studio
npm run cap:open:android

# In Android Studio: Build → Rebuild Project
# Run on physical device or emulator
```

**Testing Steps:**
1. Launch app
2. Navigate to Google Auth screen
3. Click "Continue with Google"
4. Complete OAuth flow in browser
5. Verify you're redirected back to the app
6. Check that user data is saved

---

## Troubleshooting

### Error: "invalid_client"

**Cause**: OAuth client not configured correctly

**Solutions**:
1. Verify SHA-1 fingerprint is correct
   - Debug keystore: `~/.android/debug.keystore`
   - Release keystore: `android/app/release.keystore`
2. Verify Client ID is added to Supabase "Authorized Client IDs"
3. Wait 5-10 minutes for Google Cloud changes to propagate
4. Clear app data and reinstall:
   ```bash
   adb uninstall com.zenflow.app
   # Then reinstall from Android Studio
   ```

### Error: "redirect_uri_mismatch"

**Cause**: Redirect URI not in allowed list

**Solutions**:
1. Add `com.zenflow.app://login-callback` to Supabase Redirect URLs
2. Verify package name matches exactly: `com.zenflow.app`
3. Check `AndroidManifest.xml` for correct deep link configuration:
   ```xml
   <data
       android:scheme="com.zenflow.app"
       android:host="login-callback" />
   ```
4. Wait 5 minutes for Supabase changes to propagate

### Error: "unauthorized_client"

**Cause**: Google provider not enabled in Supabase

**Solutions**:
1. Enable Google provider in Supabase Dashboard
2. Add Android Client ID to Google provider settings
3. Save changes and wait 5 minutes

### OAuth Works in Debug but Not Release

**Cause**: Different keystores have different SHA-1 fingerprints

**Solutions**:
1. Get SHA-1 for **release** keystore
2. Create **second** OAuth client in Google Cloud Console for release
3. Add both Client IDs to Supabase "Authorized Client IDs" field

### "Something went wrong" Error

**Cause**: Multiple possible reasons

**Solutions**:
1. Export debug report from error screen
2. Check error details in exported JSON
3. Enable USB debugging and check logcat:
   ```bash
   adb logcat | grep -i oauth
   ```
4. Export auth debug info from Google Auth Screen
5. Verify all configuration steps are complete

---

## Testing Checklist

- [ ] SHA-1 fingerprint extracted from correct keystore
- [ ] OAuth client created in Google Cloud Console
- [ ] Android Client ID added to Supabase
- [ ] Redirect URLs added to Supabase
- [ ] google-services.json updated and contains oauth_client
- [ ] App rebuilt with `npm run cap:sync:android`
- [ ] Google sign-in button appears and is clickable
- [ ] OAuth flow completes successfully
- [ ] User is redirected back to app
- [ ] Session persists after app restart
- [ ] Works on physical device (not just emulator)

---

## Configuration Reference

### Package Information
- **Package Name**: `com.zenflow.app`
- **Firebase Project ID**: `zenflow-192e8`
- **Supabase Project**: `bwgfslmxmueyglpumkbf`

### Redirect URLs
- **Android Deep Link**: `com.zenflow.app://login-callback`
- **Supabase Callback**: `https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/callback`

### Important Files
- **Android Manifest**: `android/app/src/main/AndroidManifest.xml`
- **Google Services**: `android/app/google-services.json`
- **Capacitor Config**: `capacitor.config.ts`
- **Auth Component**: `src/components/GoogleAuthScreen.tsx`
- **Auth Redirect**: `src/lib/authRedirect.ts`

---

## Debug Tools

### Export Debug Information

1. **From Error Screen**: Click "Export Debug Report" button
2. **From Auth Screen**: Click "Export debug info" link below error message
3. Check exported JSON for:
   - Platform (native/web)
   - Redirect URL
   - Error messages
   - User agent

### Check Logs

**Browser Console** (for web testing):
```javascript
localStorage.getItem('zenflow-error-log')
```

**Android Logcat**:
```bash
# Filter for auth-related logs
adb logcat | grep -E "(Auth|OAuth|Supabase)"

# Filter for ZenFlow app logs
adb logcat | grep com.zenflow.app
```

**Supabase Logs**:
1. Go to Supabase Dashboard
2. Navigate to: **Logs → Auth**
3. Check for failed auth attempts
4. Look for error messages

---

## Cost Considerations

All services used are **FREE** on basic tiers:

- **Google Cloud Console**: OAuth is free
- **Firebase**: Free tier (Spark plan)
- **Supabase**: Free tier (includes 50,000 monthly active users)

No credit card required for basic OAuth functionality.

---

## Security Notes

1. **SHA-1 Fingerprint**: Not a secret, safe to share publicly
2. **Client ID**: Not a secret, embedded in app
3. **API Keys**: Safe to include in mobile apps (restricted by package name)
4. **Never expose**: Supabase service role key (not used in client app)

The app uses PKCE (Proof Key for Code Exchange) flow which is secure for mobile apps.

---

## Support

If issues persist after following all steps:

1. Export debug reports (both error screen and auth screen)
2. Check Supabase auth logs
3. Verify all configuration with the testing checklist
4. Wait at least 10 minutes after making any configuration changes
5. Try on a physical device (emulators can have OAuth issues)

For additional help, review:
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Capacitor Deep Links](https://capacitorjs.com/docs/guides/deep-links)
- [Google OAuth for Android](https://developers.google.com/identity/protocols/oauth2/native-app)
