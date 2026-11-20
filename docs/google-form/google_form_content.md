# Google Form: CoU AI Hackathon 2026 – Final Round Payment Confirmation

**Header image:** upload `google_form_banner.png` (1600 × 400) via Customize theme (palette icon) → Header → Upload.
**Theme colour:** #6D28D9 (purple) · **Background:** light · **Font:** Basic

---

## Form title
CoU AI Hackathon 2026 – Final Round Payment Confirmation

## Form description
Congratulations on being selected for the Final Round of the CoU AI Hackathon 2026! 🎉

To confirm your team's place, pay the participation fee and submit this form.

• Fee: BDT 1,350 per team (one payment for the whole team)
• Pay by bKash "Send Money" to: [bKash number]
• Deadline: 22 November 2026, 11:59 PM
• One submission per team, filled in by the team leader
• Keep your bKash SMS or a screenshot until your payment is verified

Questions? Email coutechnova2026@gmail.com or ask in our Telegram group: https://t.me/+i1nLFtZoiLkzYThl

---

## Questions

### 1. Team name *(required)*
- Type: Short answer
- Help text: Exactly as registered on coutechnova.xyz

### 2. Registration ID *(required)*
- Type: Short answer
- Help text: Your team's ID, e.g. COU26-2572E1 (in your selection email)
- Response validation: Regular expression → Matches → `^COU26-[0-9A-Z]{6}$`
- Error text: Enter your Registration ID in capitals, e.g. COU26-2572E1

### 3. Team leader's full name *(required)*
- Type: Short answer

### 4. Team leader's phone number *(required)*
- Type: Short answer
- Help text: 11 digits, e.g. 01712345678
- Response validation: Regular expression → Matches → `^01[3-9][0-9]{8}$`
- Error text: Enter an 11-digit Bangladeshi mobile number starting with 01

### 5. bKash number you paid from *(required)*
- Type: Short answer
- Help text: The bKash account the money was sent from, e.g. 01712345678
- Response validation: Regular expression → Matches → `^01[3-9][0-9]{8}$`
- Error text: Enter the 11-digit bKash number starting with 01

### 6. bKash Transaction ID (TrxID) *(required)*
- Type: Short answer
- Help text: From the bKash confirmation SMS, e.g. 9JK4L2M8NP
- Response validation: Regular expression → Matches → `^[A-Za-z0-9]{8,12}$`
- Error text: Enter the Transaction ID exactly as in the SMS (letters and numbers, no spaces)

### 7. Amount sent (BDT) *(required)*
- Type: Short answer
- Response validation: Number → Equal to → `1350`
- Error text: The team fee is BDT 1,350

### 8. Payment date and time *(required)*
- Type: Date (turn on "Include time")

### 9. Payment screenshot *(optional)*
- Type: File upload → Specific file types: Image, PDF · Max 1 file · Max size 10 MB
- Note: File upload makes respondents sign in to Google. Skip this question if you don't want that.

### 10. Confirmation *(required)*
- Type: Checkboxes (one option)
- Option: I confirm that the details above are correct and that the fee was sent from the bKash number above.

---

## Settings (gear icon / Settings tab)
- Responses → Collect email addresses: **Verified** (or "Responder input")
- Responses → Limit to 1 response: on (needs Google sign-in), optional
- Presentation → Confirmation message:
  > Thank you! We have received your payment details. We will verify them and confirm your place in the Telegram group. Keep your bKash SMS until then.
- Responses tab → Link to Sheets, so payments can be checked against the team list (Registration ID, Transaction ID, Payment Accept/Due).
