# Skyrift Brawl online server

This small server connects players for online matches when the game runs outside claude.ai (for example on CrazyGames). It only relays tiny messages between players; each match runs inside one player's browser.

## Put it online (free, about 10 minutes) with Render

1. Create a free GitHub account if you don't have one, then make a new repository (for example `skyrift-brawl-server`) and upload `server.js`, `package.json` and this README to it.
2. Create a free account at https://render.com and choose **New → Web Service**, then pick that repository.
3. Settings: Runtime **Node**, Build command `npm install`, Start command `npm start`, Instance type **Free**.
4. Optional but recommended: under **Environment**, add `ALLOWED_ORIGINS` = `https://www.crazygames.com,https://crazygames.com` so only the game on CrazyGames can connect.
5. Click **Create Web Service**. When it says "Live", copy its address, for example `https://skyrift-brawl-server.onrender.com`.
6. Your game server address is the same with `wss://` instead of `https://`, for example `wss://skyrift-brawl-server.onrender.com`. Send that to Claude, or run:
   `python3 build-crazygames.py wss://skyrift-brawl-server.onrender.com`
   to rebuild the CrazyGames upload with online play turned on.

Note: Render's free plan sleeps after about 15 minutes with nobody connected, and the first player after that waits up to a minute while it wakes up. A paid plan (about $7/month) stays awake.

## Run it on your own computer (for testing)

    npm install
    npm start

It listens on port 8080 (or the `PORT` environment variable).
