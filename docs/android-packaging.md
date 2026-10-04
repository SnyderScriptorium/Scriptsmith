# ScriptSmith — Google Play / Android Packaging Investigation

Status: **investigation only**. Nothing published, no keystore generated, no Play
listing created. Branch: `docs/android-packaging`, based on `main` @ `9390e9c`.

Reference versions checked: `@tauri-apps/cli` **2.12.1** installed (package.json
requires `^2.11.4`); Tauri Rust crate **2.8**; `tauri-plugin-dialog` **2.7**;
`tauri-plugin-fs` **2.5**. Tauri docs consulted October 2026; Play policy facts
are current as of September–October 2026. Re-verify Play's target-API number
before any submission — it moves on a schedule.

---

## 1. Tauri Android support

Tauri v2 supports Android as a first-class mobile target. The whole flow lives
behind `tauri android` subcommands of the existing CLI (`npm run tauri android …`).

### Setup commands

```bash
npm run tauri android init     # one-time: generates the Android project
npm run tauri android dev      # run on a connected device or emulator
npm run tauri android build    # release build (defaults to BOTH apk + aab)
npm run tauri android build --apk --debug   # debug-signed APK for sideloading/tests
npm run tauri android build --aab           # App Bundle only — this is the Play upload artifact
```

### What `tauri android init` adds

- Installs the Rust Android targets via rustup (`aarch64-linux-android`,
  `armv7-linux-androideabi`, `i686-linux-android`, `x86_64-linux-android`) —
  harmless, reversible, local-only.
- Generates **`src-tauri/gen/android/`** — a full Gradle project
  (cargo-mobile2 template): `app/src/main/MainActivity.kt` (Kotlin wrapper
  hosting the WebView), `AndroidManifest.xml`, `build.gradle.kts`,
  `settings.gradle.kts`, JNI wiring, plus Rust bridge code. This directory is
  **generated, not hand-edited, and should be gitignored** (Tauri's default
  `src-tauri/.gitignore` already does this once init runs). Re-running init
  regenerates it, so persistent Android customizations must live in
  `tauri.conf.json` / source files / deterministic patch scripts, not in
  one-off edits to `gen/android`.

**No secrets are required to initialize.** Init needs no keystore, no Play
account, no signing material at all. Signing only enters the picture at
release-build time (§3). The repo can hold everything Android needs except the
release keystore.

### Identifiers and versions

- `identifier: "com.snyderscriptorium.scriptsmith"` in `tauri.conf.json`
  becomes the Android `applicationId`. It is already a proper reverse-domain
  name and **must never change after the first Play upload** — Play treats a
  changed applicationId as a different app.
- The `version` field in `tauri.conf.json` becomes `versionName`. The CLI
  derives `versionCode` from it automatically; after init, **verify the
  generated `build.gradle.kts` and confirm versionCode actually increments**
  each release (bump `version` in `tauri.conf.json` per release).
- Icons: `tauri android init` does **not** wire up app icons into the Gradle
  project. Use `npm run tauri icon <1024x1024.png>` to generate the full set
  (adaptive icon foreground/background included) and verify it lands in
  `gen/android`. ⚠️ **Repo gap found while investigating:** `tauri.conf.json`
  lists `"bundle": { "icon": ["icons/icon.ico"] }` but `src-tauri/icons/`
  does not exist in the repo. Desktop builds need this fixed too — and the
  Android track needs a ≥512px (1024 recommended) square PNG icon source.
- Play targets API level 36: Tauri's config schema exposes
  `bundle.android.minSdkVersion` (default 24 is fine) but **`targetSdkVersion`
  is not a tauri.conf.json field** — it must be patched into the generated
  `build.gradle.kts` after init (or via a build script that re-applies the
  patch). Re-check the generated file's `targetSdk` against Play's current
  minimum before every release; as of 31 Aug 2026 Play requires **API 36**
  (one-time extension to 1 Nov 2026 exists via a form in Play Console).

---

## 2. Prerequisites (dev environment)

Install once on the build machine (Linux, macOS, or Windows — the Gradle
project builds on all three):

| Requirement | Version | Notes |
|---|---|---|
| Android Studio | current | Easiest way to get the SDK; or SDK Command-line Tools only |
| Android SDK platform | **36** (compileSdk/targetSdk) | minSdk 24 (Android 7.0) is fine and is Tauri's default |
| Android SDK Build-Tools | 35.x/36.x | provides `apksigner`, `zipalign` |
| Android NDK | **25+** (28.x recommended 2026) | required for Rust cross-compilation |
| JDK | **17+** | Android Studio's bundled JBR (`…/Contents/jbr/Contents/Home`) satisfies Gradle + AGP |
| Rust via rustup | stable | `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android` |
| `cargo-ndk` | latest | `cargo install cargo-ndk` (the CLI needs it for NDK cross-builds) |
| Env vars | — | `ANDROID_HOME`, `NDK_HOME`/`ANDROID_NDK_HOME`, `JAVA_HOME`, licenses accepted (`sdkmanager --licenses`) |

**Cost to install:** roughly 10–20 GB disk (Studio + SDK + NDK + an emulator
system image) and ~1–2 hours of downloads on a fast connection, assuming Rust
and Node are already present. A first clean release AAB build itself takes
~10–25 minutes (Gradle + Rust cross-compile); incremental builds are a few
minutes. No secrets or paid accounts are needed for any of this — only the
$25 Play Console fee at publish time.

Notable: the Rust targets and NDK are installed locally and machine-specific;
they never touch the repo.

---

## 3. Google Play requirements

### Accounts, fees, signing

- **Play Console developer account:** $25 one-time fee (paid by K.W. —
  already budgeted/parked). Account creation includes identity verification.
  Note: **Android Developer Verification** enforcement began 30 Sep 2026 in
  four countries, rolling out globally in 2027 — expect an identity/D-U-N-S
  style verification step during account setup.
- **App signing — Play App Signing is mandatory for new apps.** Two keys:
  - *App-signing key* — Google generates and holds this (recommended); it is
    the identity users' devices trust. K.W. never needs to touch it.
  - *Upload key* — K.W. generates and holds this. It signs the AAB before
    upload. This is the keystore **she must create and back up**. If the
    upload key is lost, Google can reset it through a verified request, but
    losing it is a multi-day recovery — keep it somewhere durable.
- **Creating the upload keystore (K.W.'s machine, when she says go — NOT
  done here):**

  ```bash
  keytool -genkey -v -keystore scriptsmith-upload.jks -keyalg RSA -keysize 2048 \
    -validity 9125 -alias scriptsmith
  ```

  25-year validity is the common recommendation; never commit the `.jks` or
  passwords to git. The Tauri Gradle template picks up a signing config from
  `src-tauri/gen/android/keystore.properties` (gitignored) pointing at an
  **absolute path** to the keystore, with store/key passwords. Release builds
  without a signing config produce an **unsigned** AAB/APK that Play rejects
  and devices refuse to install.
- **No AAB without signing.** `tauri android build` with no `--debug` and no
  signing config emits `app-universal-release-unsigned.apk` / unsigned AAB.
  For Play: signed AAB via `--aab` (or default build) with `keystore.properties`
  present.

### Package identity

`com.snyderscriptorium.scriptsmith` — already correct in `tauri.conf.json`.
Permanent after first upload.

### Required listing assets

- App icon (adaptive icon, 512×512 source), feature graphic **1024×500**,
  at least 2 phone screenshots, short description (≤80 chars) + full
  description.
- **Privacy policy URL — required even for a fully offline app.** For
  ScriptSmith it can be a short page on snyderscriptorium.com stating that
  the app collects nothing, has no accounts, stores everything on-device.
- **Data Safety form — required.** An offline-first app with no accounts, no
  analytics, no ads is the simplest possible form ("no data collected,
  no data shared"), but the form must still be completed accurately.
- Content-rating questionnaire, target audience (pick Adults 18+ — targeting
  children adds heavy additional requirements), news-app declaration (no),
  ads declaration (no ads), in-app billing (no — skip Play Billing entirely;
  no Billing Library version to maintain).

### Play gates that matter for a personal developer account

- **Target API 36 required** for new apps since 31 Aug 2026 (extension form to
  1 Nov 2026 exists). See §1 note about patching `targetSdkVersion`.
- **16 KB page-size compatibility:** apps targeting API 35+ must ship
  16-KB-aligned native `.so` files (enforced since Nov 2025; upload-time
  refusal without 16 KB support starts 1 Feb 2027). Tauri's Rust `.so` needs
  checking with the SDK's `check_elf_alignment` script before first upload —
  flag as a release-pre-flight step.
- **Edge-to-edge is mandatory for targetSdk 35+** (no opt-out from 36):
  system bars overlay app content by default; the WebView UI must handle
  insets (safe-area padding). Test on a real device/emulator — do not assume
  the desktop layout is fine.
- **The 20-tester closed-test gate is the biggest schedule risk.** Personal
  developer accounts cannot go to production until **≥20 testers stay
  opted-in to a closed testing track for 14 continuous days** with real
  engagement. Plan on recruiting ~25 testers to absorb drop-off, and budget
  a minimum of two weeks of calendar time plus the production review queue.
- Pre-launch report (Firebase Test Lab) runs automatically on the uploaded
  AAB — crashes there block release.
- Review credentials: ScriptSmith needs no login, so no test credentials are
  needed (state this explicitly in the "App access" section).

---

## 4. Tauri-specific gotchas for THIS app

Codebase facts established by reading the repo (2026-10-03):

### Plugins in use — what changes on Android

Only two plugins are registered in `src-tauri/src/lib.rs`:
`tauri_plugin_dialog` and `tauri_plugin_fs`, with capabilities
`core:default`, `dialog:default`, `fs:default`. No `@tauri-apps/api` window/
app APIs are imported anywhere in `src/*.js` — good, there is no
desktop-only API usage to port.

**plugin-fs (library, autosave, backups):** all library reads/writes use
`BaseDirectory.AppData` (`ScriptSmith/library`, `ScriptSmith/autosave`,
backups). On Android, `AppData` maps to the app's **private internal
storage** (`/data/user/0/com.snyderscriptorium.scriptsmith/…`) — no storage
permissions required, survives updates, works exactly like desktop. The
autosave/library/backup flows should work unchanged. Note the code already
has a localStorage fallback when fs fails — belt and suspenders.

**plugin-dialog (Open / Export) — this is the one real code problem.**
`openProject()` and `exportProject()` call `dialog.open()` / `dialog.save()`
and then feed the returned path straight into `readTextFile` / `writeTextFile`
as a filesystem path. On Android the dialog plugin returns **SAF content URIs**
(`content://…`), not file paths — `readTextFile("content://…")` will fail.
Consequences:
- The core library flows keep working (they never touch the dialog), so the
  app is usable.
- **Open from elsewhere and Export to elsewhere will break** until the flow is
  made Android-aware. Options: (a) community plugin
  `tauri-plugin-android-fs` / `@vnidrop/tauri-plugin-fs`, which handle SAF
  URIs properly; (b) a small Rust command that copies a picked file's content
  into app storage via the SAF stream and returns a private path; (c) on
  mobile, route "Open/Export" through app-private storage plus the system
  share sheet instead of the desktop dialog model.
- No special Play permissions are needed if we stay in app-private storage +
  user-picked SAF URIs (this also keeps the Data Safety form clean). Do NOT
  request broad storage permissions (`MANAGE_EXTERNAL_STORAGE`) — that
  triggers a Play policy review the app will not pass.

### CSP / IPC

`tauri.conf.json` sets `"security": { "csp": null }` — no CSP is injected,
so the Android WebView's Tauri IPC channel is unaffected. (The silent-IPC
failure mode seen in other Tauri Android ports — a strict CSP blocking
`ipc://localhost` — does not apply here.)

### Mobile UI problems visible in the current code

1. **Inch-based page layout.** The editor renders pages at
   `width: 8.5in; height: 11in; min-width: 8.5in` (see `src/workspace.css`,
   `.ss-page`). On a phone screen (~2.5in wide) this means the page is
   massively wider than the viewport — horizontal scrolling or a shrunken
   zoom view. The existing `--ss-zoom` variable is the natural lever: add a
   "fit width" mode on mobile, and consider a reflow/continuous reading mode
   that drops the fixed-page metaphor on small screens. This is the biggest
   UX work item of the port.
2. **Desktop-dense ribbon UI.** The toolbar ribbon (many small buttons,
   `min-height: 32px`, horizontal scroll strips) is built for a 1400×900
   window (the config's default window size). On touch it needs bigger tap
   targets and probably a collapsed/overflow toolbar for phones.
3. **Hover-dependent styles.** `:hover` rules exist in `workspace.css` and
   several `src/styles/*.css` files. On touch, hover is sticky/odd — any
   hover-only affordance (tooltips, hover-reveal controls) needs a tap path.
4. **No touch handlers.** JS has no `touchstart`/`TouchEvent` usage and no
   viewport-size adaptation; layout adapts only via CSS media queries (add a
   mobile breakpoint pass).
5. **Keyboard + viewport.** `index.html` already has a correct viewport meta
   tag. On Android the soft keyboard resizes the WebView — test that the
   editor stays usable with the keyboard up (this bit a similar Tauri port;
   plan for safe-area + keyboard-inset handling on the editor shell).

### What does NOT need to change

- localStorage works in the Android WebView; the 7 files using it are fine
  as caches/metadata (the app already treats local files as the source of
  truth per its README principles).
- Version handling, product name, category ("Productivity") all carry over.
- No network permissions are declared and none are needed (offline-first —
  do not add `INTERNET` to the manifest; keep the Data Safety form trivial).

---

## 5. Sequenced checklist: today → Play listing

Legend: **[DEV]** = pure dev work (no K.W. action needed) · **[K.W.]** = needs
her decision/action/account/money · **[VERIFY]** = confirm live before
proceeding (her standing rule: nothing merges/deploys without her explicit ok).

### Phase A — project setup (DEV, no secrets involved)

1. **[DEV]** Install prerequisites on the build machine: Android Studio or
   SDK cmdline tools (platform 36, build-tools), NDK 28.x, JDK 17+,
   `cargo-ndk`, Rust Android targets, env vars, accept licenses. (~1–2h,
   ~10–20 GB disk)
2. **[DEV]** `npm run tauri android init` — generates `src-tauri/gen/android`
   (gitignored). Inspect `build.gradle.kts`: confirm `minSdk 24`,
   patch/verify `targetSdk 36`, confirm versionCode derives from `version`.
3. **[DEV]** Fix the missing-icons repo gap: add a ≥1024px square PNG icon
   source, run `npm run tauri icon`, verify the Android adaptive icon appears
   in the generated project. (Also un-breaks desktop builds.)
4. **[DEV]** Debug build on an emulator and a real device:
   `npm run tauri android dev`. Confirm the app launches and the library /
   autosave / backup flows work on Android.
5. **[DEV]** **[VERIFY]** Core editing works on a phone-sized viewport; log
   every mobile UI break (page width, ribbon density, keyboard overlap) as
   the punch list for Phase B.

### Phase B — mobile code work (DEV)

6. **[DEV]** Mobile editor layout: "fit width" zoom mode (leveraging
   `--ss-zoom`) and/or a continuous reflow reading mode for small screens;
   collapse the ribbon into a touch-friendly toolbar; replace hover-only
   affordances; handle edge-to-edge insets and soft-keyboard resizing.
7. **[DEV]** Android-aware Open/Export: replace direct `readTextFile` /
   `writeTextFile` on dialog-returned paths with an SAF-safe path
   (community `tauri-plugin-android-fs` or a small Rust copy-into-app-storage
   command + share-sheet export). Keep everything in app-private storage or
   user-picked URIs — **no broad storage permissions**.
8. **[DEV]** **[VERIFY]** Full pass on a real device: create, edit, save,
   autosave recovery, backup, open, export; check 16 KB ELF alignment of the
   native `.so` (`check_elf_alignment.sh`); run the release AAB through
   Firebase Test Lab / pre-launch report and fix crashes.
9. **[DEV]** Bump `version` in `tauri.conf.json`; confirm `versionCode`
   increments in the generated Gradle project.

### Phase C — Play Console (K.W.)

10. **[K.W.]** Create the Play Console developer account, pay the **$25**
    one-time fee, complete identity/Android Developer Verification. (She
    already knows about the $25; the verification step is new since 2026.)
11. **[K.W.]** Decide the signing setup: recommended = let **Play App Signing**
    hold the app-signing key, and generate one **upload keystore** on her
    machine with `keytool` (25-year validity, backed up somewhere durable —
    e.g. encrypted USB + password manager). She holds the upload key forever;
    Google holds the app-signing key. Dev wires it in via a local
    `keystore.properties` (never committed).
12. **[DEV]** Build the signed release AAB (`npm run tauri android build
    --aab`), verify the signature with `apksigner verify --print-certs`
    (should show her upload-key cert, not "Android Debug").
13. **[K.W.]** Fill the Play Console listing: title, short/full description,
    screenshots, feature graphic (1024×500), icon; publish a short privacy
    policy page on snyderscriptorium.com (one paragraph: offline app, no
    accounts, no data collected); complete the Data Safety form ("no data
    collected/shared"), content rating, target audience (Adults 18+).
14. **[K.W.]** Closed testing: recruit ~25 testers, run the **closed test
    track ≥14 continuous days with ≥20 testers opted in** (personal-account
    gate — this is the calendar-time bottleneck), address pre-launch report
    findings.
15. **[K.W.]** Request production access, submit for review, monitor rollout.

### Ongoing per release

Bump `version` in `tauri.conf.json` → confirm `versionCode` → re-check
`targetSdk` against Play's current minimum (the number moves) → rebuild
signed AAB → closed/open test → staged rollout.

---

## Key contacts / links (re-verify at build time)

- Tauri mobile docs: <https://v2.tauri.app/develop/> (Android guide)
- Play target API policy:
  <https://support.google.com/googleplay/android-developer/answer/11926878>
- Play app signing: <https://developer.android.com/google/play/app-signing>
- Data safety: <https://play.google.com/console/data-safety/>
