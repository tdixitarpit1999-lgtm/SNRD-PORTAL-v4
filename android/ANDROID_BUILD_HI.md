# Android App build — SNRD PORTAL

यह Capacitor आधारित Android wrapper है। Website और Android दोनों एक ही web app और Supabase backend इस्तेमाल करेंगे।

## Build steps (PC या cloud build)
Project root में:
```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```
Android Studio में Gradle sync के बाद APK/AAB build किया जा सकता है।

## फोन से आगे
आपके पास अभी Android phone है, इसलिए अगला practical step GitHub repository + cloud build workflow सेट करना होगा। APK तभी बनेगा जब build workflow सफलतापूर्वक पूरा हो और signing सुरक्षित रूप से configure हो। अभी इस ZIP में APK शामिल नहीं है।

## Security
- `web/config.js` में केवल Supabase URL और Publishable/anon public key रखें.
- `service_role` / secret key कभी app में न डालें.
- Release APK में HTTPS backend और tested RLS policies अनिवार्य हैं.
