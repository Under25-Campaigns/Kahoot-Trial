# Quiz Night

A no-account live quiz prototype. Hosts open a room, players join with a six-digit code and nickname, and everyone answers timed multiple-choice questions together.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000` in a host tab, create a room, then open another tab or device and join with the displayed code.

The first version includes a three-question demo quiz so the complete host and player flow is usable right away.

## Concurrent player target

The room currently accepts up to 2,500 players, and answer submissions are sent to the host as a small counter update instead of rebroadcasting the full room state. Question and result updates go to the room. This keeps the event pattern suitable for a 2,000-player room on a properly sized Node host.

The current room state lives in one Node process. Treat this as a single-instance deployment until shared Redis-backed game state and room coordination are added. A Socket.IO Redis adapter alone would not be enough to share scores and room state across instances. Before relying on a 2,000-player live event, run a load test against the chosen hosting provider and configure connection limits, memory, autoscaling, and monitoring for the expected traffic.

## Next backend steps

- Move room state and answer updates into Redis, using atomic updates for scores and one shared room lifecycle.
- Add reconnect support, host moderation, question authoring, and saved quiz data.
- Add a load-test scenario for 2,000–2,500 simulated players and validate the target deployment.
