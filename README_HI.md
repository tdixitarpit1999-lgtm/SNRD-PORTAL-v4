# SNRD PORTAL v3 — Option 1 (Modern Professional)

**School:** S.S.S.NR.DIXIT IC/PS TODARPUR, BEWAR, MAINPURI  
**Design:** Navy Blue + White  
**Deliverables:** Responsive Website / PWA + Android (Capacitor) starter project

## इस ZIP में क्या है?
- `web/` — responsive website, mobile-friendly dashboard, PWA install support; आपके भेजे हुए स्कूल Logo को header/login में लगाया गया है.
- `android/` — Capacitor Android setup guide and configuration.
- `database/` — Supabase SQL verification notes (existing tables/policies को दोबारा create नहीं करता).
- `capacitor.config.json` और `package.json` — Android wrapper बनाने के लिए project configuration.

## अभी क्या काम करता है?
- Website पर login form और Supabase Email/Password Auth integration का starter.
- Login के बाद `user_profiles` से role पढ़ने का प्रयास.
- Super Admin और Parent के लिए अलग-अलग dashboard navigation.
- Parent के लिए linked students और enrollment list fetch करने का प्रयास.
- Mobile navigation और PWA install prompt.
- Supabase credentials `web/config.js` में local रूप से डालने के लिए placeholder.

## जरूरी सीमा
यह **v3 starter / integration prototype** है, Production-ready School ERP या तैयार APK नहीं।
आपके Supabase project में अभी:
- Super Admin policies मौजूद हैं.
- Parent read policies अभी हाल में जोड़ी गई हैं; live user से end-to-end test बाकी है.
- Office Admin और Teacher की table-level permissions अभी पूरी नहीं हैं.
- Fees, attendance, marks, documents, payment gateway, audit logs, backup automation और single-active-device login अभी implement नहीं हैं.
- Student photo Storage bucket और उसकी policies अभी बनानी बाकी हैं.

**कृपया असली विद्यार्थियों का डेटा न डालें** जब तक सभी roles, policies, storage, backups और security tests पूरे न हो जाएँ.

## Supabase configure करना (फोन से)
1. ZIP extract करें.
2. `web/config.example.js` की copy बनाकर नाम `config.js` रखें.
3. Supabase Dashboard → Project Settings → API में Project URL और **Publishable key / anon public key** लें.
4. `web/config.js` में placeholders बदलें.
5. `service_role` / secret key कभी भी इस file या browser/app में न डालें.
6. `web/index.html` को local preview में खोलें; production hosting पर HTTPS जरूरी है.

## Android App
Android build के लिए Node.js/npm और Android build environment चाहिए. इस ZIP में Capacitor wrapper configuration है, लेकिन APK अभी generated/signed नहीं है.
- `npm install`
- `npx cap add android`
- `npx cap sync android`
- `npx cap open android`

इन commands के लिए PC या cloud build environment (जैसे GitHub Codespaces + Android build workflow) की जरूरत पड़ सकती है. केवल Android फोन से final APK बनाना आसान/सीधा नहीं है; अगला चरण cloud build workflow सेट करना होगा.

## School structure included
- PG, Nursery, LKG, UKG, Classes 1–12
- PG–5 English
- Classes 6–8 English + Hindi separate offerings
- Classes 9–12 Hindi
- Classes 11–12 Science + Arts
- Sections A/B/C etc. Admin-defined
- Academic session April–March
