# Midterm Project 112006269

A React + Firebase chatroom app built with Vite. Users can create an account, sign in with email/password or Google, join the protected chat page, create group chats, and send realtime messages.

## Requirements

- Node.js `18`, `20`, or `22+`
- npm, which is included with Node.js
- A modern web browser
- Internet access for Firebase Authentication and Realtime Database

## Run on another laptop

1. Clone or copy this project folder to the laptop.
2. Open a terminal in the project folder.
3. Install the exact dependencies from the lockfile:

   ```bash
   npm ci
   ```

   If `npm ci` fails because the lockfile was changed, run:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open the local URL printed by Vite, usually `http://localhost:5173/`.

Do not copy `node_modules` or `dist` between laptops. They are generated folders; `npm ci` recreates `node_modules`, and `npm run build` recreates `dist`.

## Available scripts

```bash
npm run dev      # Start the local Vite development server
npm run build    # Create a production build in dist/
npm run preview  # Preview the production build locally
npm run lint     # Run ESLint
npm test         # Run sign-in browser regression tests
```

## Firebase setup

The current Firebase web app configuration is stored in `src/firebase.jsx`, so no `.env` file is required for this project as it is now.

For the app to work on another laptop, the Firebase project must have these services enabled:

- Authentication with Email/Password sign-in
- Authentication with Google sign-in
- Realtime Database
- `localhost` in the Firebase Authentication authorized domains for local development

To use a different Firebase project, replace the config object in `src/firebase.jsx`, then enable the same Firebase services above.

## Production build

Create a production build with:

```bash
npm run build
```

Preview it locally with:

```bash
npm run preview
```

For Firebase Hosting, this repo already outputs to `dist/` and rewrites app routes to `index.html`, so React Router paths such as `/signin`, `/signup`, and `/chat` can refresh correctly after deployment.

## Troubleshooting

For the browser tests, first run `npx playwright install chromium` once on each laptop, then `npm test`. Tests start a local server on port 5174 and simulate Firebase responses without using real accounts or writing to the live database.

- `vite` is not recognized: run `npm ci` first.
- Login works locally but Google sign-in fails after deployment: add the deployed domain in Firebase Authentication authorized domains.
- Database reads or writes fail: check the Firebase Realtime Database rules for the configured project.
