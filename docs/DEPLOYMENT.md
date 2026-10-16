# Deployment and device installation

The web frontend and FastAPI backend are deployed; see [Go live](GO_LIVE.md) for URLs and verified checks. APK compilation and iPhone installation remain unverified.

For the concrete GitHub → hosted Supabase → Render API → Netlify web sequence, see [Go live](GO_LIVE.md).

## Web production build

From `apps/client`, populate `.env` with the real public Supabase values and an HTTPS API URL:

```sh
npm ci
EXPO_PUBLIC_API_URL=https://YOUR_API_HOST npm run build:web
```

Upload **apps/client/dist** to a static host. For Netlify use base directory `apps/client`,
build command `npm ci && npm run build:web`, publish directory `dist`. Set the three
`EXPO_PUBLIC_*` values in its build environment. The included `_redirects` supplies SPA
fallback and `_headers` supplies basic headers; other hosts must provide equivalent rewrites.
Keep `/manifest.json`, `/sw.js`, icons, and `/_expo/*` as real static files; only application
paths fall back to `/index.html`. Host at the domain root; subpath hosting is not configured.
Set HTTPS on both frontend and API. Add the final web origin to backend `CORS_ORIGINS`
and Supabase Auth Site URL/redirect allowlist. Test signup, confirmation, login, refresh,
meal save and sign-out on the deployed origin.

The web build rejects missing/non-HTTPS API and Supabase URLs, localhost service URLs, and missing public Supabase keys. The production export is a single-page application. The build script adds metadata,
manifest and service-worker registration to its generated index.html. The `+html.tsx`
provides equivalent metadata if static rendering is adopted later.

The manifest and PNG icons support installation in compatible browsers. On iOS Safari,
use Share → Add to Home Screen; on Android/desktop use the browser's install action when
available. Browser install prompts are not guaranteed. HTTPS and the correct manifest/icon
MIME types are required. `sw.js` is deliberately network-only, has root scope, and must be
served with no-cache headers. There is no offline meal logging; API/auth data and user
photos must never enter a service-worker cache. Verify installation on each target browser.

## Backend: managed Python service

A Render blueprint (`render.yaml`) and `services/api/Dockerfile` are supplied. Review the
service setup in your hosting account before deploying; no deployment is triggered here.
Use the `services/api` root directory, Python 3.11+ (Docker uses 3.12), set all backend
variables from README using the host's secret store, and start with:

```sh
uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
```

For a non-Docker service: `pip install .` in `services/api` installs the API dependencies.
Health check: `GET /health`; interactive endpoint schema: `/docs`. Terminate HTTPS at the
managed host. `ENVIRONMENT=production` rejects non-HTTPS CORS origins. Health is a process
liveness check, not an assertion that external services or migrations are ready.

The API validates bearer tokens through Supabase Auth and uses that user's token for REST
queries. It does not trust a client-provided user id. Native apps use the same HTTPS base URL
and bearer authentication; CORS is enforced by browsers, not native networking. Do not add
`*` CORS or bypass authentication to support mobile.

The in-process analysis throttle is five requests/minute/user. Run one worker for personal
use. For multiple workers/instances, enforce a shared per-user limit at a gateway or replace
it with Redis before scaling. Configure proxy request-size limits (16 MB plus multipart overhead),
request timeouts above 65 seconds, provider quotas/billing limits, and Supabase Auth limits.
Logs record failure classes/paths, never photos, tokens, prompts or provider error bodies.
Use access-log controls at the host to avoid logging credentials. Monitor upstream errors.
Back up the database and test restore and account deletion before wider use.

## Physical device API connectivity

`localhost` on a phone refers to the phone. Set `EXPO_PUBLIC_API_URL` to your deployed HTTPS
API for the simplest reliable path. For temporary LAN development, use your Mac's reachable
LAN IP with Uvicorn bound to `0.0.0.0`, ensure the firewall permits it, and use a trusted HTTPS
tunnel if platform transport security blocks HTTP. Expo's Metro tunnel only tunnels Metro,
not your API. Never weaken production transport security. Restart Metro after env changes.

## Expo Go on iPhone

Install Expo Go from Apple's App Store. From `apps/client`:

```sh
npx expo start --go
```

Put Mac and iPhone on the same network, then scan the QR code using the iPhone Camera.
Expo Go must support the project's SDK (currently 58); if the store version does not, use
the development-build path below. This project uses Expo-compatible modules; dev-client
features themselves run only in a development build. Camera testing needs a physical device.
For network restrictions, `npx expo start --go --tunnel` can tunnel Metro, but the API still
needs its own reachable URL. Expo Go is not a signed standalone MacroLens application.

## Install a development build directly from Mac / Xcode

Prerequisites: Xcode with command-line tools and iOS platform support, CocoaPods, a connected
unlocked iPhone, Developer Mode enabled, and an Apple ID added to Xcode → Settings → Accounts.
Use a unique iOS bundle identifier if `com.macrolens.app` is already registered by another team.
Both camera/photo library permission descriptions are configured in `app.json`.

```sh
cd apps/client
npm ci
npx expo prebuild --platform ios
open ios/MacroLens.xcworkspace
```

In Xcode, select the **MacroLens** app target → Signing & Capabilities, enable **Automatically
manage signing**, choose your Personal Team or paid Developer Team, and verify the bundle
identifier. Choose the connected iPhone as the run destination and press Run (⌘R). Trust the
Mac/device pairing and developer certificate on the iPhone if prompted. Then start Metro:

```sh
npx expo start --dev-client
```

Once signing is configured, the CLI alternative compiles and installs on a chosen device:

```sh
npx expo run:ios --device
```

A free Apple ID's Personal Team can generally run a locally signed app on your own phone,
subject to Apple's provisioning/device/capability limits and short-lived provisioning
(typically seven days, requiring rebuild/reinstall). A paid Apple Developer Program account
is required for TestFlight and normal distribution. An arbitrary unsigned IPA cannot be
freely installed. EAS internal iOS distribution requires appropriate signing/provisioning
and registered devices; it is not a free-signing workaround. Native `ios/` and `android/`
folders are generated and ignored; keep configuration changes in app.json/plugins.

## Installable Android APK (no Play Store required)

Application id: `com.macrolens.app`. Adaptive icon and splash configuration live in app.json.
EAS requires an Expo account and project linkage; run these from `apps/client`:

```sh
npx eas-cli@latest login
npx eas-cli@latest init
```

`eas init` writes your actual EAS project ID; none is invented in source control. Create the
three public client variables in each EAS environment you use (development, preview,
production) with `npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://YOUR_API_HOST --visibility plaintext`
and repeat for the Supabase URL/key and other environments. These values are public by design;
never upload backend secrets to the client project. Preview is standalone, development needs Metro.

```sh
# Standalone APK for personal testing
npx eas-cli@latest build --platform android --profile preview

# APK with development client
npx eas-cli@latest build --platform android --profile development
npx expo start --dev-client

# Optional local APK build (requires Android SDK/JDK/EAS local prerequisites)
npx eas-cli@latest build --platform android --profile preview --local --output ./macrolens.apk
```

Both profiles specify `android.buildType=apk`. Let EAS manage the Android keystore or supply
your own; preserve it for future app updates. Download the APK from the EAS build link on the
phone, allow that browser/file manager to install unknown apps, then tap the APK. Alternatively,
enable USB debugging, connect the device, and run `adb install -r ./macrolens.apk`. No Play Store
publication is needed. An AAB cannot be directly installed like an APK.

## Future TestFlight distribution

Enroll in the Apple Developer Program, register your bundle id, create an App Store Connect
app record, and configure the production environment's public variables. From `apps/client`:

```sh
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --latest
```

Provide your team's signing credentials and the App Store Connect record when prompted.
Complete export-compliance/privacy details, wait for Apple processing, then invite internal
TestFlight testers. External testing can require beta review. This step publishes a build to
Apple's distribution system and must be initiated only when you're ready to distribute.

## Official references reviewed

- [Gemini 3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite): stable, image inputs, structured output, cost-efficient default.
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Expo APK profiles and installation](https://docs.expo.dev/build-reference/apk/)
- [Expo local native development](https://docs.expo.dev/guides/local-app-development/)
- [Expo PWA requirements](https://docs.expo.dev/guides/progressive-web-apps/)
- [USDA API guide](https://fdc.nal.usda.gov/api-guide/)

Meal photos are normalized to JPEG with a maximum 1600 px edge on the client.
The API additionally accepts JPEG/PNG/WebP originals up to 16 MB and 64 megapixels,
then downsizes them and strips metadata. HEIC/RAW decoding depends on the client
platform; export as JPEG if the browser cannot open the original.
