# RSSI Staff

React Native mobile workspace for authorized Sugar Regulatory Administration staff reviewing sugarcane field observations in Negros Oriental and Negros Occidental.

## Staff workflows

- Sign in through the RSSI backend using a staff account.
- View province-scoped report and farmer records from the live API.
- Search and filter reports by verification status.
- Open report details and authenticated photo evidence.
- Submit a verification result, independent SRA severity, reviewer notes, rationale, and optional follow-up date when the account has review permission.
- View farmer profiles and their registered farm properties, subject to backend privacy rules.
- Choose System, Light, or Dark appearance. The preference is stored on the device.
- Refresh by pull-down, when connectivity returns, and when the app becomes active again.

The app stores its bearer token in the iOS Keychain or Android secure credential store. It does not display the backend address. The API origin is configured in `src/api.ts` for the current test environment.

## Run Android

Install dependencies with `npm install`, start Metro with `npm start`, then run `npm run android` from another terminal. The Android debug build can also be created with `cd android; .\gradlew.bat assembleDebug`.

## Run iOS

On macOS, install CocoaPods after adding native dependencies with `cd ios && bundle exec pod install`, start Metro, and run `npm run ios`.

## Backend routes used

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/me`
- `GET /api/v1/staff/reports`
- `GET /api/v1/staff/map-locations`
- `GET /api/v1/staff/reports/{id}`
- `PUT /api/v1/staff/reports/{id}/review`
- `GET /api/v1/staff/farmers`
- `GET /api/v1/staff/farmers/{id}`
- `GET /api/v1/reports/{reportId}/photos/{photoId}`

The backend enforces staff role, province access, review scopes, and private location access. The mobile client only enables report review when the session includes the `reports:review` scope.
