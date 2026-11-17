# Motion Arena – phone camera + Android TV motion games

Your body is the controller. The OnePlus phone's front camera tracks your body with on‑device AI
(MediaPipe Pose) and sends only body points (no video) over Wi‑Fi to the TV, where your
stick‑figure copies every move. Four sections – **Arena** (17 games), **Exercise** (rep counting + auto workout plan),
**Yoga** (guided flow, asanas, breathing) and **Dance Studio** – for 1 or 2 players. Every button can be chosen with the
TV remote **or by raising a hand and holding it on the button** (pause during a game: hold the hand on ⏸ top‑left).

Made with ❤️ by Mohit · Like the game? Contribute for future development 🙏 UPI: `7387302451@ybl` (QR: `assets/support-qr.png`).

## Files
- `index.html` – start page (choose TV / phone / one‑device / keyboard demo)
- `tv.html` – the arena for the TV (menu, games, QR pairing)
- `phone.html` – the camera page for the phone
- `js/` – game code, `lib/` – offline copies of the AI model and libraries

## 1. Put it online (one time)
The phone camera only works on an **https://** website, so host this folder for free:
- **GitHub Pages:** create a repo, upload this folder, Settings → Pages → Deploy from branch `main` / root.
- **Netlify Drop:** open app.netlify.com/drop and drag this folder in (free account keeps it online).

You will get a link like `https://yourname.github.io/motion-arena/`.

## 2. Setup / सेटअप
1. TV aur phone **ek hi Wi‑Fi** par hon. (दोनों एक ही वाई‑फ़ाई पर)
2. **TV:** Play Store se **TV Bro** (ya koi bhi Chrome‑based browser) install karo. Apna link kholo → **“This is the TV”**. QR code aur 4‑digit code dikhega.
3. **Phone:** Chrome se QR scan karo (ya link kholo → “This is the phone camera” → code daalo). **Camera allow** karo.
4. **Phone ko rakho:** landscape (आड़ा), kamar ki unchai par, TV ke paas, aapki taraf. 2–3 meter peeche khade ho – **sir se pair tak** dikhna chahiye. Charger laga do. “🌙 Screen dim” se screen kaali kar sakte ho, camera chalta rahega.
5. **Khelo:** game chunne ke liye haath upar karke game tile par 1–2 second rakho, ya TV remote ke arrow + OK. **Back** = menu.

**2 players:** dono log phone ke frame mein side‑by‑side khade ho jao (left = P1 blue, right = P2 pink). Game shuru hote waqt jitne log dikhte hain utne players ban jaate hain. Do phone bhi jod sakte ho – har phone ek player.

## If the TV browser doesn't work / अगर टीवी पर न चले
- **Cast mode:** phone par “One device mode” kholo, phone stand par player ki taraf rakho, aur phone screen ko TV par **Cast / Screen mirror** karo.
- **Laptop:** laptop HDMI se TV par lagao, laptop par “This is the TV” kholo.
- Pairing needs internet once (free PeerJS server, 0.peerjs.com). After pairing, data goes directly phone → TV on your Wi‑Fi.

## Arena games
| # | Game | Move |
|---|------|------|
| 1 | 🏃 Jungle Dash – जंगल दौड़ | Step left/right to change lane, jump over logs, squat under branches |
| 2 | 🍉 Slice Storm – फल काटो | Swipe hands fast through fruit, avoid bombs |
| 3 | 🧱 Shape Gate – दीवार का छेद | Make the pose cut in the wall before it hits you |
| 4 | 🤸 Jack Attack – जंपिंग जैक | Jumping jacks in 45 s |
| 5 | 🏗️ Squat Tower – स्क्वाट टावर | Each squat adds a block |
| 6 | 🫧 Bubble Pop – बुलबुले फोड़ो | Touch bubbles, gold +5, red spiky −3 |
| 7 | 🧤 Goal Guard – गोलकीपर | Block the ball at the ring |
| 8 | 🥊 Punch Pads – मुक्का पैड | Punch targets around you, build combos |
| 9 | 🐦 Sky Glider – उड़ती चिड़िया | Flap arms (up → down) to fly through gaps |
| 10 | ☄️ Meteor Dodge – उल्का से बचो | Dodge meteors with your body, grab stars |
| 11 | 🧘 Yoga Freeze – योग फ्रीज़ | Hold 8 yoga poses for 3 s each |
| 12 | 🏁 Sprint Race – दौड़ रेस | Run in place with high knees, 60 m race |
| 13 | 🧺 Fruit Basket – फल पकड़ो | Step left/right to catch fruit in your basket, avoid bombs |
| 14 | 🪢 Skip Rope – रस्सी कूद | Jump each time the rope reaches your feet |
| 15 | 👑 Raja Bole – राजा बोले | Simon‑says: do the pose only when “Raja bole” |
| 16 | 🎨 Paint Splash – रंग भरो | Paint the wall with your hands (2P: most colour wins) |
| 17 | 🎈 Balloon Keep‑Up – गुब्बारा | Keep balloons in the air with hands/head |

## 💪 Exercise
- **Auto workout plan:** choose Level (Easy/Medium/Hard), Time (10–30 min) and Focus (Auto changes daily: full body,
  legs, arms & chest, cardio). The app builds the schedule itself: warm‑up → rounds of sets (e.g. push‑ups → squats →
  jumping jacks) with rest in between → cool‑down stretches + breathing. Reps grow slowly as you complete workouts.
- **Single exercise:** 60‑second rep counter (squats, jacks, push‑ups, high knees, crunches, punches, overhead reach,
  toe touches, side bends) or 30‑second hold (plank, wall sit, balance).
- Push‑ups / plank: put the phone low and to your side (side view).
- Streak, workouts done and minutes are saved on the TV. A voice coach can call out each exercise (Settings).

## 🧘 Yoga
Yoga Flow (11 asanas with holds + breathing), Yoga Freeze game, Breathing (2 min), or practise one asana.

## ⚙️ Settings & players
Motion sensitivity (Low/Normal/High/Max), hand‑select time, graphics (Auto lowers effects on slow TVs), sound, voice.
Player names: TV → Players (quick names or type), or the Players box on the phone page.

## Performance / many users
- Everything is a static website. The pose AI runs on each phone, the drawing runs on each TV – the web host only serves
  files, so many families can play at the same time without slowing each other down.
- Phone: the AI runs once per new camera frame (max 30/s, or 20/s in 🔋 Saver). 1‑player mode is lighter.
- The only shared online piece is the free PeerJS pairing server (0.peerjs.com) used for the first handshake. If it is
  down or busy, pairing fails (games keep working once connected). For heavy use, run your own (see below).

## 💃 Dance Studio – गाने के स्टेप्स सीखो
Menu ke neeche **DANCE STUDIO** chuno.
1. **Song add karo:** phone page par “Dance Studio” box mein YouTube link paste karke *Send to TV* dabao (YouTube → Share → Copy link). Ya TV par “+ Add YouTube song” mein link type karo.
2. **● Record (ek baar):** jo dance jaanta hai, woh video ke saath poora dance kare. Phone uske steps ko video ke time ke saath save kar leta hai. Video khatam hote hi ya OK/Back dabane par save ho jaata hai.
3. **▶ Practice:** video baayein (left) chalega, daayein (right) aapki stick figure aur ek **safed parchhai (white shadow)** jo recorded steps dikhati hai. Usse match karo.
   - Har 2 second ke move par **PERFECT / GREAT / OK / MISS** aur “Fix: Left forearm” jaisa hint milega.
   - Remote **↑/↓ = speed** (0.5x, 0.75x, 1x) – dheere seekhne ke liye.
   - End mein % score aur best score. 2 log ek saath practice kar sakte hain.
- YouTube ka video seedha AI se nahi padha ja sakta, isliye steps ek baar record karne padte hain.
- Kuch videos doosri sites par chalne nahi dete (“blocks playing on other sites”) – us gaane ka doosra upload try karo.
- Songs aur recordings TV ke browser mein save hote hain.

## Try without a camera
Open `tv.html?sim=1` on a computer: ←/→ move, ↑ jump, ↓ squat, 1/2/3/4 arms, Q/E lean, K one leg,
J jumping jacks, R run, F flap, P add player 2, mouse = right hand.

## Optional: your own pairing server
Run `npx peerjs --port 9000` on a computer and open `tv.html?peerhost=<computer-ip>&peerport=9000`
(the QR code passes it to the phone automatically).
