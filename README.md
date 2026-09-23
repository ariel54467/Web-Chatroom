# Chatterly — Web Chatroom

A realtime chat app built with React, Vite, and Supabase, hosted on Firebase Hosting.

**Live demo:** https://midterm-project-11200626-998dd.web.app

## Features

- **Accounts:** email/password sign-up with email confirmation, Google sign-in, and password reset
- **Profiles:** a unique `@username`, display name, and profile photo
- **Contacts:** find people by username, send and accept friend requests, block and unblock
- **Chats:** private chats between contacts, and group chats with owner/admin roles, invitations, renaming, and group pictures
- **Messages:** text with an emoji picker (works on phones and laptops), images, GIFs, and MP4 videos
- **Realtime:** live updates, typing indicators, read receipts, unread counts, and loading older messages
- **Notifications:** push notifications for new messages, even when the site is closed (tap the 🔔 in the header), and the unread count in the tab title. Phones can install the site as an app.
- **Security:** row-level security on every table. The browser cannot write to tables directly; every change goes through a checked database function, and uploaded files are private to the people in the chat.

## Tech stack

| Part | Tool |
|---|---|
| Frontend | React 19, React Router 7, Vite 6, lucide-react icons, emoji-picker-react |
| Backend | Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) |
| Notifications | Web Push with VAPID keys, sent by a Supabase Edge Function using `web-push` |
| Hosting | Firebase Hosting |
| Tests | Playwright (browser), Node test runner + PGlite (database) |

## Run it locally

You need **Node.js 22 or newer** and a Supabase project (see [Supabase setup](#supabase-setup)).

```bash
git clone https://github.com/ariel54467/Web-Chatroom.git
cd Web-Chatroom
npm ci
cp .env.example .env     # then fill in your own values
npm run dev
```

Open the address Vite prints, usually http://localhost:5173.

`.env` holds these values:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>   # Supabase → Project Settings → API Keys
VITE_VAPID_PUBLIC_KEY=<public push key>           # see step 4 of Supabase setup
```

The publishable key and the public push key are meant to be public. The database's security rules protect the data, not the keys.

## Supabase setup

Do this once per Supabase project.

### 1. Create the database

In the **SQL Editor**, run each file in [`supabase/migrations/`](supabase/migrations/) once, in order:

1. [`001_messenger.sql`](supabase/migrations/001_messenger.sql) creates the tables, security rules, database functions, the private `chat-media` and `avatars` storage buckets, and turns on realtime for the chat tables.
2. [`002_media_upload_policy.sql`](supabase/migrations/002_media_upload_policy.sql) fixes the upload rule for pictures and videos in chats.
3. [`003_push_notifications.sql`](supabase/migrations/003_push_notifications.sql) stores which devices want notifications and decides who gets notified about each message.

### 2. Set the allowed addresses

Go to **Authentication → URL Configuration**:

- **Site URL:** your deployed address, for example `https://<your-site>.web.app`
- **Redirect URLs:** add one entry per address the app runs on:
  - `https://<your-site>.web.app/**`
  - `https://<your-site>.firebaseapp.com/**` (Firebase serves both domains)
  - `http://localhost:5173/**`

If an address is missing, Supabase sends people to the Site URL after they sign in, instead of back to the app.

### 3. Turn on sign-in methods

**Email** is on by default under **Authentication → Sign In / Providers**.

**Google** needs an OAuth client from [Google Cloud Console](https://console.cloud.google.com/):

1. **Google Auth Platform → Branding / Audience:** set the app name and support email, choose **External**, then click **Publish app**. While the app is in testing, only listed test users can sign in.
2. **Google Auth Platform → Clients → Create client → Web application**:
   - **Authorized JavaScript origins:** `https://<your-site>.web.app` and `http://localhost:5173`
   - **Authorized redirect URIs:** `https://<project-ref>.supabase.co/auth/v1/callback`
3. Copy the **Client ID** and **Client secret**. In Supabase, go to **Authentication → Sign In / Providers → Google**, turn it on, paste both, and click **Save**.

The client secret belongs only in Supabase. Never put it in `.env` or commit it.

### 4. Push notifications

1. Create a key pair: `npx web-push generate-vapid-keys`.
2. Put the **public** key in `.env` as `VITE_VAPID_PUBLIC_KEY`.
3. Create `supabase/.env` (git ignores it; never commit it):

   ```bash
   VAPID_SUBJECT=https://<your-site>.web.app
   VAPID_PUBLIC_KEY=<public key>
   VAPID_PRIVATE_KEY=<private key>
   ```

4. Upload the keys and deploy the sender function:

   ```bash
   npx supabase login
   npx supabase secrets set --env-file supabase/.env --project-ref <project-ref>
   npx supabase functions deploy push --project-ref <project-ref> --no-verify-jwt --use-api
   ```

   `--no-verify-jwt` is intentional: the function passes the caller's session to the database, and `claim_push` only answers the person who sent the message, once per message.

After someone sends a message, their browser asks the `push` function to notify the chat. The function sends a notification to every other member's devices that have notifications turned on. The service worker (`public/sw.js`) shows it, except when the person is already looking at that chat.

**iPhone:** notifications only work after adding the site to the Home Screen (Safari → Share → Add to Home Screen, iOS 16.4 or newer) and turning on the bell from the installed app.

## Deploy to Firebase Hosting

`firebase.json` serves the `dist/` folder, sends every route to `index.html` (so refreshing `/chat` works), and tells browsers to always check for a new version of the page after each deploy.

```bash
npm install -g firebase-tools   # once
firebase login                  # once
npm run build                   # uses the values in .env
firebase deploy --only hosting
```

To use your own Firebase project, change the project ID in `.firebaserc`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the production site into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the browser tests |
| `npm run test:db` | Run the database security tests |

## Tests

- **Browser tests** (`tests/*.spec.js`) run the app in Chromium against simulated Supabase responses, so they never touch real accounts or data. They cover email and Google sign-in, sign-up, sign-out, failed sign-ins, choosing a username, sending messages, the emoji picker on laptop and phone sizes, retrying a failed send, turning notifications on and off, and the service worker showing a pushed notification. Before the first run on a machine, install the browser with `npx playwright install chromium`.
- **Database tests** (`tests/database.test.mjs`) load the migration into an in-memory Postgres and check the security rules: who can read messages, send, invite, remove members, upload files, and who gets notified.

## Project structure

```
src/
  App.jsx            routes and the signed-in guard
  auth/              sign-in, sign-up, password reset, session state
  chat/              the messenger: chat list, conversation, composer, contacts, groups, profile
  services/          Supabase client, database calls, file uploads, push notifications
public/sw.js         service worker that shows notifications
public/icons/        app icons for phones and notifications
supabase/migrations/ database schema, security rules, and functions
supabase/functions/push/  Edge Function that sends notifications
tests/               browser and database tests
```

`src/comp`, `src/display`, `src/css`, and `src/firebase.jsx` are from an earlier Firebase version of the app and are not used.

## Troubleshooting

| What you see | Cause and fix |
|---|---|
| "Chat service is not connected yet." | `.env` is missing or incomplete. Fill it in and restart `npm run dev`, or rebuild before deploying. |
| "The chat database is not ready yet." | The SQL migrations have not been run on this Supabase project. |
| "new row violates row-level security policy" when sending a picture | `002_media_upload_policy.sql` has not been run. |
| After Google sign-in you land on `localhost` or the wrong site | The app's address is missing from Supabase's **Redirect URLs**, or the **Site URL** is still the default. |
| Google shows `Error 400: redirect_uri_mismatch` | The Google OAuth client is missing `https://<project-ref>.supabase.co/auth/v1/callback` under **Authorized redirect URIs**. |
| "Unable to exchange external code" | The Google **Client secret** in Supabase is wrong. Create a new secret for the client in Google Cloud and paste it into Supabase. |
| "Sign-in could not be finished in this tab." | The sign-in started on one address (such as `firebaseapp.com`) and finished on another. Use one address, and add both to Supabase's Redirect URLs. |
| No notifications arrive | Check that the 🔔 is on for the receiving device, that the browser allows notifications for the site, and that the computer isn't in Do Not Disturb / Focus mode. On iPhone, use the Home Screen app. The function's logs are under Supabase → Edge Functions → push → Logs. |
| "Notifications are blocked for this site" | Allow notifications in the browser's site settings (the icon left of the address bar), then tap the bell again. |
| `vite` is not recognized | Run `npm ci` first. |
