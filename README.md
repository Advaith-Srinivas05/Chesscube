# Chesscube

Chesscube is a chess website for playing, training and studying. Players can take on each other in real-time games, play against Stockfish, solve rated puzzles, work through interactive lessons and analyse positions with an engine. An account is optional: guests can play and practise straight away, while signing up adds ratings, match history, friends and a daily puzzle streak.

## Features

- Real-time multiplayer with quick pairing, a public lobby for custom games, friend challenges, rematches, draw offers and premoves
- Standard chess and Chess960, rated or casual, from bullet to classical time controls
- Play against Stockfish in the browser at 8 difficulty levels
- Around 130,000 rated puzzles from the Lichess database, plus a daily puzzle with streaks
- An analysis board with live engine lines, variations and PGN/FEN import and export
- 18 interactive lessons covering the rules, basic checkmates and tactics
- Glicko-2 ratings for each time control and for puzzles, with leaderboards
- Friends, friend requests, online status and spectating friends' games
- Profiles with match history, avatars and account management
- Light and dark themes, six piece sets, board colours and sound themes

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, Vite, React Router, CSS Modules, react-chessboard, Stockfish (WebAssembly) |
| Backend | Node.js, Express 5, Socket.IO, Mongoose, zod |
| Database | MongoDB Atlas |
| Auth | JWT in httpOnly cookies, bcrypt, email verification codes, Google Sign-In |
| Hosting | Vercel (client), Render (API) |

## How it works

**Server-authoritative games.** Every move is validated on the server with [chessops](https://github.com/niklasf/chessops) before it reaches the opponent, and clocks are tracked on the server so a modified client can't cheat. The client applies its own moves optimistically and resyncs if the server rejects one. Live games are saved when the server shuts down and restored when it starts again.

**Shared game logic.** Move validation, Chess960 setup, premove rules and puzzle checking live in one set of modules used by both the client and the server, so the rules can't drift apart.

**Ratings.** Games and puzzles are rated with a custom implementation of Glicko-2, which tracks how certain each rating is as well as the rating itself. Games start at 800 and puzzles at 1000.

**Accounts.** No user record is created until the email address is verified. Passwords are hashed with bcrypt, sessions are JWTs in httpOnly cookies, and "sign out everywhere" invalidates every existing session at once. Google Sign-In is supported alongside email and password.

**Security.** Input is validated with zod on every REST route and socket event. Sign-in, sign-up and password reset are rate limited, with counters stored in MongoDB so they survive restarts. Sockets are limited per connection and per IP, and the client is served with a strict Content Security Policy. Since the API runs behind Vercel, a small edge middleware forwards each visitor's real IP to the API in a signed header, so rate limits can't be dodged with a forged `X-Forwarded-For`.

**Engine in the browser.** Stockfish runs as WebAssembly in a Web Worker for the computer opponent, the analysis board and the self-playing game on the home page, so none of that costs server time.

## Project structure

```
client/          React app
  src/
    components/  UI kit, chess boards, game screen and page sections
    pages/       one component per route
    hooks/       online games, computer games, puzzles, analysis, sockets
    lib/         API client, socket client, Stockfish worker, chess rules
    data/        lessons, board themes, computer levels
server/          Express API and Socket.IO server
  src/
    routes/      REST endpoints
    realtime/    live games, lobby, challenges, presence
    models/      Mongoose schemas
    services/    ratings, email, tokens, daily puzzle
    middleware/  auth, validation, rate limiting, errors
  scripts/       puzzle import, storage report, email test
  test/          unit tests
```

## Running locally

You need Node.js 22.15 or newer and a MongoDB database (a free Atlas cluster or a local `mongod`).

```bash
# API
cd server
cp .env.example .env    # set MONGODB_URI and JWT_SECRET
npm install
npm run dev             # http://localhost:3001

# Client, in a second terminal
cd client
cp .env.example .env
npm install
npm run dev             # http://localhost:3000
```

Vite proxies `/api` to the local API. Without email settings, verification codes are printed to the server console, so sign-up works locally without any extra setup.

### Puzzles

Puzzles are imported from the [Lichess puzzle database](https://database.lichess.org/#puzzles), sampled evenly across the rating range:

```bash
cd server
npm run import:puzzles -- --dry-run   # preview the sample without writing anything
npm run import:puzzles                # download and import
```

### Tests

```bash
cd server && npm test                # chess rules, premoves, Glicko-2, puzzles, game sessions, lobby, rate limits
cd client && npm run lessons:check   # checks every lesson position is valid and solvable
```

## Environment variables

**Server** (`server/.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | At least 32 random bytes |
| `CLIENT_ORIGIN` | | Allowed frontend origin (default `http://localhost:3000`) |
| `PORT` | | API port (default `3001`) |
| `NODE_ENV` | | `production` when deployed |
| `PROXY_SECRET` | in production | Shared with Vercel to sign the forwarded client IP |
| `GOOGLE_CLIENT_ID` | | Enables Google Sign-In |
| `MAIL_SCRIPT_URL`, `MAIL_SCRIPT_SECRET` | for email | Google Apps Script mailer ([`server/scripts/appsScriptMailer.gs`](server/scripts/appsScriptMailer.gs)) |
| `SMTP_USER`, `SMTP_PASS` | for email | Gmail address and app password, as an alternative to Apps Script |
| `MAIL_DAILY_LIMIT` | | Maximum emails per day (default `90`) |

Production needs one of the two email options. The deployed site uses Apps Script because Render's free tier blocks SMTP ports.

**Client** (`client/.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_URL` | yes | API origin, used for the Socket.IO connection |
| `VITE_GOOGLE_CLIENT_ID` | | Same as `GOOGLE_CLIENT_ID` |
| `PROXY_SECRET` | on Vercel | Same value as on the server |

## Deployment

The client is deployed on Vercel and the API on Render, with MongoDB Atlas as the database. REST calls go through a Vercel rewrite so the session cookie stays first-party, while Socket.IO connects to the API directly over WebSockets. Live games are kept in memory, so the API runs as a single instance. The Render URL and security headers are configured in [`client/vercel.json`](client/vercel.json).

## Credits

- Piece sets from [Lichess](https://github.com/lichess-org/lila): cburnett and merida (GPLv2+), staunty and california (CC BY-NC-SA 4.0), chessnut (Apache 2.0), fantasy (MIT)
- Puzzles from the [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0)
- [Stockfish.js](https://github.com/nmrugg/stockfish.js) (GPLv3), a WebAssembly build of [Stockfish](https://github.com/official-stockfish/Stockfish)
- [chessops](https://github.com/niklasf/chessops) (GPL-3.0-or-later) for chess rules and Chess960
