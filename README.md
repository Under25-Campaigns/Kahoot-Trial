# Quiz Night

Quiz Night is a live, multiple-choice game. The host builds a quiz and shares a six-digit room code. Players join with a nickname and play on their own screens. Everyone sees the standings between questions.

## Run on a Mac

Install Node.js 20 or newer. Unzip the download, open Terminal in the extracted `quiz-night` folder and run these commands.

```sh
npm install
npm start
```

Open [localhost:3000](http://localhost:3000) on the Mac and select **Create a quiz**. To try a second player on the same Mac, open a new tab and choose **I have a code**. On the same Wi-Fi, other players can open `http://YOUR-MAC-IP:3000` on their devices and enter the code. You can find the Mac’s Wi-Fi IP address in its network settings.

## Update an existing copy

Copy the new `server.js` and the entire `public` folder into your existing project. From its root, restart the server with `npm start`, or redeploy your existing Node web service. Restart between games because restarting clears active rooms. For a first installation, use the whole extracted folder.

For a public game, run this project on a Node web service that supports WebSockets, with `npm install` as the install command and `npm start` as the start command. The server reads the host’s `PORT` environment variable. Players open that service’s public URL and enter the code. GitHub can store the source. GitHub Pages serves static files, while the live game requires the running Node server.

## Build a quiz

Each quiz supports up to 50 questions. Each question has its own settings.

- Write a prompt, add a picture, or use both. Pictures can be JPG, PNG or WebP, up to 12 MB per source file. The builder resizes them before upload. An optional description is available for screen readers.
- Enter four answer choices and select the correct one.
- Set the timer from 5 to 300 whole seconds. A new question starts at 20 seconds.
- Set the point multiplier from 0× to 10×, with up to two decimal places. The default is 1×. Use 0× for a practice round or 2× for double points.

Select **Create room**, share the code and choose **Start the quiz** when players have joined.

## Play and scoring

The round closes when everyone has answered, time runs out, or the host selects **Reveal answers**. Correct answers earn 500 to 1,000 base points according to how quickly the player answers. The server multiplies that amount by the question’s multiplier and rounds to a whole point. Skipped and incorrect answers earn zero.

The host and every player see the round leaderboard. A rocket shows how many places someone climbed and a parachute shows how many they dropped. Equal scores keep their previous order, using join order at the start of the game. The board displays ten players at a time. Players can browse every page and see their own rank even when it is outside the displayed page.

After the last round the host selects **See the winners**. Everyone sees the first-place player with confetti, and the winner sees **You won!**. Devices set to reduced motion show the same rankings and winner with static indicators.

Refreshing the same tab restores the host or player session, including an answer already submitted. The room allows two minutes to reconnect after a disconnection.

## Hosting capacity

A room is limited to 2,500 players. Game state and pictures live in memory in one Node process. Use a single server instance for this version. The live updates carry small leaderboard pages and picture URLs, and browsers can cache pictures.

In a local test, 2,001 simultaneous simulated players each fetched a question picture, submitted an answer and received the round and final standings. For a 2,000-person public event, verify concurrent connections, bandwidth for picture rounds and round transitions on the hosting plan and instance size you will use.
