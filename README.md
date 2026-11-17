# Motion Arena – phone camera + Android TV motion games

Your body is the controller. The OnePlus phone's front camera tracks your body with on‑device AI
(MediaPipe Pose) and sends only body points (no video) over Wi‑Fi to the TV, where your
stick‑figure copies every move. 12 original games plus a Dance Studio, 1 or 2 players.

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

## The 12 games
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
