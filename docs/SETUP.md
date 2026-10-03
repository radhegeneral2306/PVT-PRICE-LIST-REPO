# Pricelist Vault: Setup Guide (Hinglish)

Ye guide non-technical owner ke liye hai. Poora kaam lagbhag 20 minute ka hai. Sirf ek baar karna hai.

Aapko chahiye: ek Google account (Gmail), jo aapka hi ho. Saara data aapke Google Sheet aur Google Drive me rahega.

---

## Step 1: Google Sheet banao

1. Browser me `sheets.google.com` kholo, apne Gmail se login karo.
2. **Blank** (khali) spreadsheet banao.
3. Upar left me naam likho: `Pricelist Vault Data`.
4. Is Sheet ko kisi ke saath **share mat karna**. Ye private rehni chahiye.

## Step 2: Apps Script kholo aur code paste karo

1. Sheet me upar menu me **Extensions > Apps Script** click karo. Naya tab khulega.
2. Left me file `Code.gs` dikhegi. Usme jo bhi likha hai (`function myFunction() {}`), sab select karke delete karo (Ctrl+A, phir Delete).
3. Is repository ki file `apps-script/Code.gs` kholo, poora text copy karo (Ctrl+A, Ctrl+C) aur Apps Script ke `Code.gs` me paste karo (Ctrl+V).
4. (Optional, behtar) Left me gear icon **Project Settings** click karo, **Show "appsscript.json" manifest file in editor** tick karo. Wapas **Editor** me jao, `appsscript.json` file kholo, usme `apps-script/appsscript.json` ka text paste karo. Ye step skip karoge to bhi chalega.
5. Upar **Save** (disk icon) dabao.

## Step 3: Apna naam aur PIN likho

`Code.gs` ke bilkul upar ye 2 lines hongi:

```
var OWNER_NAME = 'Owner';
var OWNER_PIN = '';
```

Inko aise badlo (apna naam aur 4 se 8 digit ka PIN, sirf numbers):

```
var OWNER_NAME = 'Ramesh';
var OWNER_PIN = '483920';
```

Quotes `' '` ke andar hi likhna. PIN yaad rakhna. Phir se **Save** karo.

## Step 4: setup chalao

1. Apps Script me upar ek dropdown dikhega jisme function ka naam hota hai. Usme **setup** select karo.
2. **Run** button dabao.
3. Google permission maangega. Ye normal hai:
   - **Review permissions** click karo.
   - Apna Gmail account choose karo.
   - Ek warning aayegi: **"Google hasn't verified this app"**. Ghabrao mat. Ye isliye aati hai kyunki ye script aapne khud banayi hai, Google ne review nahi ki.
   - **Advanced** click karo (neeche left me chhota link).
   - Phir **Go to Untitled project (unsafe)** click karo. (Naam alag ho sakta hai.)
   - **Allow** click karo. Ye script aapki Sheet aur Drive folder use karegi.
4. Neeche **Execution log** me ye likha aayega: `SETUP DONE. ...`. Matlab ho gaya.
5. Sheet wapas kholo. Ab usme tabs honge: Factories, Pricelists, Items, Users, Settings, Log. Drive me ek folder **Pricelist Vault Files** ban gaya hoga.

Agar log me error aaye (red text), "Common errors" section dekho. Setup dobara chalana safe hai, koi data delete nahi hota.

## Step 5: Web app deploy karo

1. Apps Script me upar right me **Deploy > New deployment** click karo.
2. Left me gear icon ke paas **Select type** me **Web app** choose karo.
3. Description me likho: `Pricelist Vault v1`.
4. **Execute as: Me** (aapka email).
5. **Who has access: Anyone**.
6. **Deploy** click karo. (Phir se Authorize maange to Step 4 jaise allow karo.)
7. **Web app URL** dikhega. Ye `https://script.google.com/macros/s/.../exec` jaisa hoga. **Copy** karo. Dhyan rahe ki URL `/exec` pe khatam ho, `/dev` pe nahi.

Browser me ye URL kholo. Ye likha aana chahiye: `Pricelist Vault API is running`. Ye aaya matlab backend theek hai.

## Step 6: URL app me lagao

**GitHub pe app chalane ke liye:**
1. GitHub repository kholo > **Settings** > **Secrets and variables** > **Actions** > **Variables** tab.
2. **New repository variable** click karo.
3. Name: `VITE_API_URL`. Value: aapka `/exec` URL. **Add variable**.
4. Phir repository me **Actions** tab me deploy workflow dobara run karo (Re-run). Kuch minute baad app me live data chalega.

**Apne computer pe test karne ke liye (developer):**
Project folder me `.env.local` naam ki file banao, usme ek line:

```
VITE_API_URL=https://script.google.com/macros/s/XXXXXXXX/exec
```

Phir app dobara start karo. Agar `VITE_API_URL` khali ho to app demo (mock) data pe chalta hai, Google se nahi judta.

---

## Staff add karna

1. App me apne naam aur PIN se login karo.
2. Settings (users wala section) me jao, **Add user** dabao.
3. Staff ka naam, role **staff**, aur 4 se 8 digit ka PIN daalo. Save karo.
4. Staff ko naam aur PIN batao. PIN bhoolne par aap naya PIN set kar sakte ho (wahi user edit karo).
5. Staff ko rates dikhane ya chhupane ka switch Settings me hai (**Hide rates from staff**).

## Code badalne ke baad dobara deploy

Agar code update karna ho (naya `Code.gs` aaya):
1. Naya code `Code.gs` me paste karo. **OWNER_NAME/OWNER_PIN** wapas likhne ki zarurat nahi, setup dobara chalane ki bhi zarurat nahi (sirf tab chalao jab kaha jaye).
2. **Deploy > Manage deployments** kholo.
3. Apni deployment ke saamne **pencil (edit)** icon click karo.
4. **Version** me **New version** choose karo.
5. **Deploy** dabao. URL wahi rehta hai, GitHub variable badalne ki zarurat nahi.

Dhyan do: **New deployment** mat banana, usse URL badal jata hai. Hamesha purani deployment ko edit karke new version do.

## Common errors aur fix

| Problem | Fix |
|---|---|
| `Edit OWNER_PIN at the top of the file` | Step 3 me PIN 4 se 8 digit likho, quotes ke andar, save karo, setup dobara run karo. |
| `Open this script from inside your Google Sheet` | Script Sheet ke andar se kholo: Sheet > Extensions > Apps Script. Alag se `script.google.com` pe naya project mat banao. |
| App me "Wrong name or PIN" | Naam aur PIN check karo. Capital/small letters ka farak nahi padta naam me. |
| "Too many wrong tries. Wait 5 minutes" | 5 baar galat PIN daala. 5 minute ruko. |
| "Session expired", login screen aa gayi | Normal hai, 6 ghante baad dobara login karna padta hai. |
| App me network error / data nahi aa raha | `VITE_API_URL` sahi `/exec` URL hai? Deployment me Who has access = **Anyone** hai? URL browser me kholke "API is running" dikhta hai? |
| Code badla par app purana behave kar raha | Naya **version** deploy karna bhoole. "Code badalne ke baad dobara deploy" dekho. |
| "Server is busy" | Do log ek saath save kar rahe the. 5 second baad dobara try karo. |
| "File is too big" | File 8 MB se chhoti rakho. PDF ko compress karo. |
| "Not set up yet" ya "Tab ... is missing" | `setup` dobara run karo. Safe hai. |
| Authorize screen me "unsafe" warning | Step 4 dekho, Advanced > Go to project > Allow. |

---

## Limits aur security (seedhi baat)

- **URL secret nahi hai.** Jiske paas `/exec` URL hai wo server tak pahunch sakta hai. Asli suraksha **PIN** hai. Bina login ke koi data nahi milta.
- PIN 4 se 8 digit ka hota hai, isliye lamba PIN (6 se 8 digit) rakho. Ek naam pe 5 galat try ke baad 5 minute ka lock lag jata hai.
- PIN Sheet me seedha nahi rakha jata, sirf uska hash (SHA-256 + salt) hota hai. Phir bhi **Google Sheet ko private rakho**, kisi ko share mat karo. Jisko Sheet ka access hai wo saara data dekh sakta hai.
- Drive folder **Pricelist Vault Files** bhi private rakho. App sirf usi folder ki files de sakta hai.
- Ye chhote business ke liye banaya gaya hai, bank jaisa security system nahi hai. Bahut zyada traffic ya bahut badi files ke liye nahi bana. Har request me 1 se 3 second lagte hain.
- Google ki daily limits hoti hain (Apps Script runtime, Drive). Normal use me problem nahi aati.
- Kuch bhi delete nahi hota: nayi pricelist aane par purani **archived** ho jati hai. Har change `Log` tab me likha jata hai.
- Staff ke liye rates chhupane ka option server pe lagta hai, app ke andar se nahi hatta.
- Sheet me direct edit karoge (rows delete/badloge) to app ko galat data mil sakta hai. Header row (pehli row) kabhi mat badlo.

---

## Final test checklist

Setup ke baad ye sab ek baar karke dekho:

- [ ] Browser me `/exec` URL kholne par `Pricelist Vault API is running` dikha.
- [ ] App me owner naam + PIN se login ho gaya.
- [ ] Galat PIN daalne par "Wrong name or PIN" aaya (lock tak mat jao).
- [ ] Ek **factory** add ki. Sheet ke `Factories` tab me nayi row dikhi.
- [ ] Ek **pricelist** (items ke saath) add ki. `Pricelists` aur `Items` tab me rows dikhi, `status` = `current`.
- [ ] Usi factory + category ki doosri pricelist add ki. Pehli wali `archived` ho gayi.
- [ ] Ek **PDF** upload karke pricelist banai. App me PDF khuli.
- [ ] Google Drive me folder **Pricelist Vault Files** kholke dekha, PDF wahi dikhi.
- [ ] Ek **staff** user banaya, uske login se rates chhupe hue dikhe (agar switch ON hai).
- [ ] `Log` tab me sab actions likhe hue dikhe.
