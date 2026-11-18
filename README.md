# Quiz Night

A no-account live quiz prototype. Hosts open a room, players join with a six-digit code and nickname, and everyone answers timed multiple-choice questions together.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000` in a host tab, create a room, then open another tab or device and join with the displayed code.

Hosts can build a quiz in the browser, add up to 50 multiple-choice questions, set four answer options, and select the correct answer. Players enter a room code once, then choose a nickname. The code is not requested again on the nickname screen.

Player and host sessions are stored in the browser and can resume after a refresh. Disconnected sessions are retained for two minutes to allow reconnection.

## Concurrent player target

The room currently accepts up to 2,500 players, and answer submissions are sent to the host as a small counter update instead of rebroadcasting the full room state. Question and result updates go to the room.

The current room state lives in one Node process. Treat this as a single-instance deployment until shared Redis-backed game state and room coordination are added. A Socket.IO Redis adapter alone would not be enough to share scores and room state across instances. Before relying on a 2,000-player live event, run a load test against the chosen hosting provider and configure connection limits, memory, autoscaling, and monitoring for the expected traffic.

## Next backend steps

- Move room state and answer updates into Redis, using atomic updates for scores and one shared room lifecycle.
- Add reconnect support, host moderation, question authoring, and saved quiz data.
- Add a load-test scenario for 2,000–2,500 simulated players and validate the target deployment.
