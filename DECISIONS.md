# WorkTrack Pro v2 — Architecture Decisions

## D1: Supabase instead of Railway + FastAPI
**Decision**: Use Supabase (free PostgreSQL + Auth + REST API) instead of a FastAPI server on Railway.

**Why**: Railway is no longer free. Supabase's free tier is genuinely free with no credit card required, handles 50 employees easily, and never sleeps. This eliminates an entire deployment layer.

**Trade-off**: Business logic (haversine, is_late) now runs client-side in the desktop app. For an internal tool of 50 trusted employees, this is acceptable. A determined user could spoof their GPS — this is a known trade-off.

---

## D2: First registered user becomes admin
**Decision**: The PostgreSQL trigger auto-promotes the first registered account to `is_admin = TRUE`.

**Why**: Eliminates the need for a separate `create_admin.py` script. The person who sets up the app registers first and naturally becomes admin.

---

## D3: GPS radius set to 200m (not 100m as spec)
**Decision**: Default office radius changed from 100m to 200m.

**Why**: Windows Location API on office laptops/desktops uses WiFi positioning, not GPS hardware. WiFi positioning accuracy is typically ±50–200m. At 100m radius, legitimate office workers would frequently be mis-classified as WFH. 200m handles the realistic accuracy while still correctly distinguishing "in office" from "at home".

**Admin override**: Configurable 50–500m in Settings.

---

## D4: Password reset via Supabase OTP
**Decision**: Forgot Password sends a 6-digit OTP via Supabase Auth's sign_in_with_otp flow.

**Why**: Desktop apps cannot use web redirect URLs cleanly. Supabase's built-in OTP (when enabled in Auth settings) sends a code directly to the user's email without requiring any web browser redirect.

**Setup required**: Admin must enable in Supabase Dashboard → Authentication → Providers → Email → "Use OTP instead of Magic Link".

---

## D5: Reports generated client-side (openpyxl)
**Decision**: Excel reports are generated in the desktop app using the data fetched from Supabase, not streamed from a server.

**Why**: No server to stream from. Client-side generation is faster for <5000 rows, and the result is saved directly to the user's Downloads folder.

---

## D6: Auto-checkout runs as background thread in the app
**Decision**: A background thread wakes every minute and auto-checks-out users at 20:00 IST.

**Why**: No server-side cron (would require Edge Functions in TypeScript). The desktop app runs during work hours so the thread will reliably fire. Admin's app checks out ALL employees; employee apps only check out that individual user.

---

## D7: Session persistence is intentionally disabled
**Decision**: JWT session is not persisted to disk between app restarts.

**Why**: The app is an attendance tool — users should authenticate each morning. Not persisting the session reinforces the "morning login = daily check-in" workflow and avoids stale token issues.

---

## D8: Self-registration enabled (no admin approval)
**Decision**: Anyone can register an account immediately.

**Why**: User's explicit preference. For a 50-person startup where everyone knows each other, admin-gating adds friction without meaningful security benefit.
