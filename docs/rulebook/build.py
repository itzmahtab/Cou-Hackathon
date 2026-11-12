"""Builds the revised CoU AI Hackathon 2026 rule book as HTML (one 16:9 slide per page).

Layout and palette follow the original PptxGenJS deck. Each slide is drawn on a
1000 x 562.5 px canvas and scaled to the 720 x 405 pt PDF page at print time.
"""
from html import escape as e

DARK, TEAL, AMBER, RED, BG, INK, MUTED = "#0b3c49", "#1b998b", "#f2a93b", "#e4572e", "#edf3f4", "#14262d", "#5f7e8c"
slides = []
page = [0]


def frame(tag, title, body):
    page[0] += 1
    slides.append(f"""
<section class="slide">
  <div class="pill">{e(tag)}</div>
  <h1>{title}</h1>
  {body}
  <div class="foot">CoU AI Hackathon 2026&nbsp;&nbsp;|&nbsp;&nbsp;Official Rule Book</div>
  <div class="num">{page[0]}</div>
</section>""")


def card(head, text, x, y, w, h, dark=False, head_color=None):
    cls = "card dark" if dark else "card"
    hc = f' style="color:{head_color}"' if head_color else ""
    return f'<div class="{cls}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px"><h3{hc}>{head}</h3><p>{text}</p></div>'


def listcard(head, items, x, y, w, h, dark=False):
    cls = "card dark" if dark else "card"
    lis = "".join(f"<li>{i}</li>" for i in items)
    return f'<div class="{cls}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px"><h3>{head}</h3><ul>{lis}</ul></div>'


def grid6(cards):
    out = []
    for i, (h, t) in enumerate(cards):
        x = 50 + (i % 3) * 305
        y = 150 if i < 3 else 330
        out.append(card(h, t, x, y, 290, 165))
    return "".join(out)


def note(text, y=455):
    return f'<p class="note" style="top:{y}px">{text}</p>'


def cover(kicker, title, sub, line, closing=False):
    page[0] += 1
    big = "h-cover-big" if closing else "h-cover"
    slides.append(f"""
<section class="slide cover">
  <div class="circle teal"></div><div class="circle amber"></div>
  {f'<div class="kicker">{kicker}</div>' if kicker else ''}
  <div class="{big}">{title}</div>
  <div class="cover-sub">{sub}</div>
  {line}
</section>""")


# 1. Cover
cover("AI FOR HUMANITY", "CoU AI Hackathon 2026", "Official Rule Book",
      '<div class="cover-line">Pre-build 21 – 23 November&nbsp;&nbsp;|&nbsp;&nbsp;Final 24 November 2026&nbsp;&nbsp;|&nbsp;&nbsp;Comilla University</div>'
      '<div class="revised">Revised edition, 12 November 2026</div>')

# 2. Event at a glance
stats = [("3 days", "Pre-build (21 – 23 Nov)"), ("5 hrs", "On-site final (24 Nov)"), ("30", "Finalist teams"), ("Tk 25,000", "Total prize pool")]
body = "".join(f'<div class="stat" style="left:{50 + i * 230}px"><b>{v}</b><span>{l}</span></div>' for i, (v, l) in enumerate(stats))
body += card("Who can join", "Currently enrolled students of any university in Bangladesh, in teams of 1 – 3. Cross-university teams are welcome.", 50, 330, 290, 170)
body += card("What you build", "A working AI project that solves a real problem: built during the 21 – 23 Nov pre-build and finished at the five-hour on-site final.", 355, 330, 290, 170)
body += card("What it costs", "Pre-registration is free. Only the Top 30 selected teams pay Tk 1,350 per team.", 660, 330, 290, 170)
frame("EVENT OVERVIEW", "The event at a glance", body)

# 3. Key dates
steps = [("12 – 18 Nov", "Phase 1: Pre-registration", "Free registration and idea proposal submission"),
         ("19 – 20 Nov", "Idea evaluation", "Organizers review proposals and publish the Top 30"),
         ("21 – 23 Nov", "Phase 2: Pre-build and payment", "Selected teams build their project and pay the fee to confirm their seat"),
         ("24 Nov", "Final day", "Five-hour on-site final: finish, submit, present and judging")]
body = '<div class="tl-line"></div>'
for i, (d, t, x) in enumerate(steps):
    left = 50 + i * 230
    body += f'<div class="tl-dot" style="left:{left + 55}px">{i + 1}</div>'
    body += f'<div class="card tl" style="left:{left}px;top:225px;width:215px;height:210px"><div class="date">{d}</div><h3>{t}</h3><p>{x}</p></div>'
body += note("All deadlines follow Bangladesh Standard Time (UTC+6). A phase closes at 11:59 PM on its last date. Official communication is by email and the hackathon website - check spam folders too.", 458)
frame("KEY DATES", "Four steps to the final", body)

# 4. Prizes
body = """
<div class="podium" style="left:90px;top:250px;width:250px;height:225px"><div class="pos">2nd</div><div class="amt">Tk 8,000</div></div>
<div class="podium first" style="left:375px;top:185px;width:250px;height:290px"><div class="pos">1st</div><div class="amt">Tk 10,000</div></div>
<div class="podium" style="left:660px;top:290px;width:250px;height:185px"><div class="pos">3rd</div><div class="amt">Tk 7,000</div></div>"""
body += note("Prizes, categories and certificates are announced separately by the organizers.", 490)
frame("PRIZES", "Tk 25,000 prize pool", body)

# 5. Who can participate
frame("RULES 2.1 - 2.5", "Who can participate", grid6([
    ("Enrolled students", "Open to currently enrolled students of any university in Bangladesh."),
    ("Cross-university", "Teammates may come from different universities."),
    ("Valid student ID", "Upload a clear ID image at registration. Show the original at check-in."),
    ("One team per person", "A duplicate registration cancels every team that person appears in."),
    ("Not eligible", "Organizers, judges, mentors and volunteers cannot participate."),
    ("True information", "False or borrowed documents mean disqualification, even after results."),
]))

# 6. Team formation
body = "".join(f'<div class="band" style="left:{50 + i * 305}px"><b>{a}</b>&nbsp; {b}</div>' for i, (a, b) in enumerate([("Solo", "1 member"), ("Duo", "2 members"), ("Trio", "3 members (max)")]))
body += card("Team leader", "One official contact, responsible for registration, payment and final submission.", 50, 245, 440, 120)
body += card("Team name", "Required for Duo and Trio, optional for Solo. No offensive, political or brand names.", 510, 245, 440, 120)
body += card("Locked after 18 Nov", "No adding, removing or replacing members. Emergencies: leader emails the organizers.", 50, 380, 440, 130)
body += card("On final day", "Absent member: compete short-handed, no substitute. Attendees stay on-site for the whole five-hour final.", 510, 380, 440, 130)
frame("RULES 3.1 - 3.7", "Team formation", body)

# 7. Phase 1 form
body = listcard("Every member provides", ["Full name and email", "Phone and WhatsApp number", "University name and student ID number", "Student ID card image", "T-shirt size (S, M, L, XL, XXL, XXXL)"], 50, 150, 440, 350)
body += listcard("How it works", ["Free, open 12 - 18 Nov on the hackathon website", "Team leader submits one form for the whole team", "Confirmation email goes to every member", "No email in 24 hours? Contact the organizers", "Submissions cannot be edited - ask the organizers to fix an error before the deadline"], 510, 150, 440, 350, dark=True)
frame("RULES 4.1 - 4.2, 4.7 - 4.8", "Phase 1: pre-registration form", body)

# 8. Idea proposal
cards = [("Project title", "Required"), ("Problem statement", "Required"), ("Proposed AI solution", "Required"), ("Proposal file", "Required: PDF or DOCX"), ("Technologies planned", "Optional"), ("Additional description", "Optional")]
body = "".join(card(h, t, 50 + (i % 3) * 305, 150 if i < 3 else 265, 290, 100) for i, (h, t) in enumerate(cards))
body += '<div class="card dark" style="left:50px;top:395px;width:900px;height:115px"><ul>' + "".join(
    f"<li>{x}</li>" for x in ["One idea per team, and it must be the team's own original work", "AI tools may help write the proposal, but the team must be able to defend the idea", "Incomplete forms, unreadable IDs and corrupted files count as not submitted"]) + "</ul></div>"
frame("RULES 4.3 - 4.6", "The idea proposal", body)

# 9. Evaluation
body = card("Problem clarity", "A real, well-defined problem and a clear target user.", 50, 150, 265, 145)
body += card("AI relevance", "AI is central to the solution, not an add-on.", 330, 150, 265, 145)
body += card("Feasibility", "A working prototype can realistically be built in the three-day pre-build and the five-hour final.", 50, 310, 265, 145)
body += card("Originality", "A fresh idea or a new approach to a known problem.", 330, 310, 265, 145)
for i, t in enumerate(["Admin panel lists every team, member and idea file", "Admins select the Top 30 ideas", "Selected teams are emailed and may start building on 21 Nov"]):
    body += f'<div class="card dark step" style="left:610px;top:{150 + i * 120}px;width:340px;height:105px"><div class="dot">{i + 1}</div><p>{t}</p></div>'
body += note("Decisions are final. A waiting list may fill seats left unpaid.", 470)
frame("RULES 5.1 - 5.5", "Idea evaluation and Top 30", body)

# 10. Payment
body = """<div class="card dark fee" style="left:50px;top:150px;width:330px;height:355px">
  <div class="big">Tk 1,350</div><p class="lede">per team, one payment</p><h3 style="color:#fff">bKash or Nagad Send Money</h3>
  <p>Pay by 11:59 PM, 23 Nov or the seat is lost, even if your team has started building.</p>
  <p>Non-refundable and non-transferable, unless the organizers cancel the event.</p></div>"""
for i, t in enumerate(["Selection email arrives with the amount, receiving number and instructions",
                       "Pay only to the number in that email and on the official Payment page",
                       "Leader submits the sender's mobile number and Transaction ID (TrxID)",
                       "Organizers verify manually; the final confirmation email secures the seat",
                       "Organizers never ask for a PIN, OTP or password - report any such request"]):
    body += f'<div class="card step light" style="left:405px;top:{150 + i * 72}px;width:545px;height:62px"><div class="dot">{i + 1}</div><p>{t}</p></div>'
frame("RULES 6.1 - 6.9", "Phase 2: payment and confirmation", body)

# 11. Final day rules
frame("RULES 7.1 - 7.10", "Rules on final day", grid6([
    ("Check-in", "Every member shows the original student ID. Over 30 minutes late may mean refused entry."),
    ("Five continuous hours", "The organizers' clock is the only reference. No extra time for late arrival."),
    ("Bring your own", "Laptops, chargers, extension cords, hardware and backup mobile data."),
    ("Best-effort internet", "A network failure is not grounds for extra time."),
    ("No outside help", "Only registered members work on the project, during pre-build and the final. Hiring freelancers is cheating."),
    ("Mentors guide only", "They answer questions but never write code. Stay in the hackathon area."),
]))

# 12. Project building rules (changed: pre-build period)
body = listcard("Until 20 Nov (before the shortlist)", ["Research, planning, architecture diagrams", "UI wireframes and design mockups", "Collecting or choosing public datasets", "Creating accounts and API keys", "Learning frameworks and tools", "<b>No project-specific code yet</b>"], 50, 145, 440, 290)
body += listcard("From 21 Nov (pre-build, selected teams)", ["Writing the project code", "Building the frontend, backend and database", "Training or fine-tuning models", "Deploying test versions", "On 24 Nov: finish, test, submit and present"], 510, 145, 440, 290, dark=True)
body += note("Project code may be written only from 21 November, after the shortlist is published. Reusing an old, previously submitted or someone else's project is not allowed. Open-source libraries, public APIs, UI kits and official starters are allowed - list them in the README. Any product type is accepted; it must not be illegal, harmful, hateful or deceptive.", 445)
frame("RULES 8.1 - 8.8", "Project building rules", body)

# 13. AI tools
frame("RULES 9.1 - 9.11", "AI tools, models and data", grid6([
    ("Coding assistants OK", "ChatGPT, Claude, Gemini, Copilot, Cursor and similar. Disclose each one in the README."),
    ("Models and APIs", "OpenAI, Anthropic, Gemini, Hugging Face, Groq, Ollama. Name each in the README."),
    ("Real AI only", "Hard-coded, pre-recorded or human-faked AI output means disqualification."),
    ("Understand your code", "Judges score what you designed and can explain, not volume of generated code."),
    ("Add real value", "A bare prompt-forwarding wrapper scores low on innovation and technical depth."),
    ("Data and keys", "Public, licensed or own data, credited. Bring your own API keys and credits."),
]))

# 14. GitHub (changed: dates)
body = listcard("Repository rules", ["One public repo, created on or after 21 Nov", "First code commit on or after 21 Nov", "Commit regularly from each member's own account; at least hourly during the final", "No force-push, squashing or back-dating", "Last commit before the final deadline on 24 Nov is judged", "Never commit keys; add a .env.example"], 50, 145, 440, 365)
body += listcard("README must contain", ["Project, team and member names", "Problem and solution summary", "Features and how the AI works", "Tech stack, models, APIs, datasets", "AI tools used, and for what", "Third-party code and assets, credited", "Setup steps, live link, demo video"], 510, 145, 440, 365, dark=True)
frame("RULES 10.1 - 10.10", "GitHub repository", body)

# 15. Deployment
body = listcard("Deploy publicly", ["Live link built from your repo", "Free tiers are fine", "Stay live until results", "Login? Give test credentials"], 50, 145, 290, 275)
body += listcard("Can't deploy?", ["Demo video, 3 minutes max", "Show the real project working", "Add an installable build, e.g. APK"], 355, 145, 290, 275)
body += listcard("Live demo", ["Must run the real project", "Slides or recordings only as network backup", "Keep a local copy and recording"], 660, 145, 290, 275, dark=True)
body += note("Hosting examples: Vercel, Netlify, Render, Railway, Hugging Face Spaces, Streamlit Cloud, Firebase, GitHub Pages.", 450)
frame("RULES 11.1 - 11.8", "Deployment and live demo", body)

# 16. Submission checklist
rows = [("Title and short description", "Required, max 150 words"), ("GitHub repository link", "Required, public"), ("Live deployment link", "Required, or a demo video (rule 11.4)"), ("Test login credentials", "Required if the app has a login"), ("AI tools and models disclosure", "Required"), ("Demo video", "Optional, max 3 minutes")]
body = '<table class="tbl"><tr><th>Item</th><th>Requirement</th></tr>' + "".join(f"<tr><td><b>{a}</b></td><td>{b}</td></tr>" for a, b in rows) + "</table>"
body += note("One submission per team, by the leader, before the five-hour final ends on 24 Nov. The deadline is strict - submit at least 10 minutes early. Links must be public; a broken or private link counts as missing.", 445)
frame("RULES 12.1 - 12.6", "Final submission checklist", body)

# 17. Conduct (changed: disqualification wording)
body = listcard("Code of conduct", ["Respect everyone; no harassment or abuse", "No smoking, alcohol, drugs or weapons", "Never touch another team's code or accounts", "Do not contact judges about scoring"], 50, 145, 440, 285)
body += listcard("Disqualification for", ["Code started before 21 Nov, or an old or previously submitted project", "Plagiarism or copying another team", "Outside help during the pre-build or the final", "Faked demo or AI output", "Rewritten history or post-deadline changes", "False information or fake TrxID"], 510, 145, 440, 285, dark=True)
body += note("Lesser breaches, such as a missing README item or undisclosed AI tool, can mean point deductions or a warning. Disqualified teams forfeit fee, prizes and certificates.", 450)
frame("RULES 13.1 - 13.8", "Conduct and disqualification", body)

# 18. Ownership
body = listcard("Ownership and privacy", ["Teams own their idea, code and project", "Organizers may show name, screenshots and demo, with credit", "You must respect licences and copyright", "ID images used only for verification", "Proposals are never shared with other teams", "Event photos and videos may be taken"], 50, 145, 440, 365)
body += listcard("General provisions", ["Organizers may change schedule or rules, announced by email or website", "Postponed: registrations carry over", "Cancelled: fees are refunded", "You arrange your own travel and health cover", "Questions: Contact page or helpline", "Organizers' interpretation is final"], 510, 145, 440, 365, dark=True)
frame("RULES 14 - 15", "Ownership, privacy and general terms", body)

# 19. Domains
doms = [("Healthcare", "Direct human impact"), ("Agriculture", "Important for Bangladesh"), ("Disaster Management", "High national relevance"), ("Education", "Accessible to student innovators"), ("Cybersecurity", "Growing digital threats"), ("Accessibility", "Meaningful social innovation"), ("Smart Cities", "Practical urban challenges"), ("Environment", "Long-term sustainability"), ("FinTech", "Strong startup potential"), ("Business and Industry", "Commercial applications")]
body = "".join(f'<div class="card dom" style="left:{50 + (i % 5) * 182}px;top:{150 if i < 5 else 310}px"><div class="dot">{i + 1}</div><h3>{h}</h3><p>{t}</p></div>' for i, (h, t) in enumerate(doms))
body += note("Suggested: keep all 10 domains open. Each team picks one primary domain and optionally one secondary.", 478)
frame("HACKATHON FIELDS", "Ten AI domains, in priority order", body)

# 20. Sample challenge
body = card("Problem: rural healthcare access", "A patient in a remote village gets a medical report but cannot understand the technical terms.", 50, 145, 440, 170)
body += card("Your mission", "Build an AI tool that explains reports in simple Bangla, flags key values and suggests questions for a doctor.", 510, 145, 440, 170, dark=True)
for i, t in enumerate(["Upload report", "OCR text", "Explain in Bangla", "Flag out-of-range values", "Medical disclaimer"]):
    body += f'<div class="card flow" style="left:{50 + i * 182}px"><div class="dot">{i + 1}</div><b>{t}</b></div>'
frame("SAMPLE CHALLENGE", "Real problems, not generic AI wrappers", body)

# 21. To be confirmed (contact is now confirmed)
frame("STILL TO CONFIRM", "To be confirmed by the organizers", grid6([
    ("Payment numbers", "Official bKash and Nagad receiving numbers"),
    ("Final day schedule", "Check-in, start, submission deadline, presentation times"),
    ("Venue", "Building and room"),
    ("Prizes and certificates", "Categories and certificates"),
    ("Extras", "Whether food, T-shirts, pen and notebook are provided"),
    ("Contact (confirmed)", "coutechnova2026@gmail.com and the helpline numbers on the website"),
]))

# 22. Closing
cover("", "AI FOR HUMANITY", "Innovate Today. Transform Tomorrow.",
      '<div class="cover-body">Three days to build. Five hours to finish. Thirty teams. One mission: turn artificial intelligence into meaningful solutions for real-world problems.</div>'
      '<div class="cover-line amberline">CoU AI Hackathon 2026&nbsp;&nbsp;|&nbsp;&nbsp;Pre-build 21 – 23 Nov&nbsp;&nbsp;|&nbsp;&nbsp;Final 24 Nov&nbsp;&nbsp;|&nbsp;&nbsp;Comilla University</div>', closing=True)

css = f"""
@page {{ size: 960px 540px; margin: 0; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{ background: {BG}; }}
body {{ font-family: Carlito, Calibri, sans-serif; color: {INK}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
.sheet {{ width: 960px; height: 540px; overflow: hidden; page-break-after: always; break-after: page; }}
.slide {{ position: relative; width: 1000px; height: 562.5px; background: {BG}; transform: scale(0.96); transform-origin: 0 0; overflow: hidden; }}
.pill {{ position: absolute; left: 50px; top: 28px; height: 28px; padding: 0 30px; border-radius: 14px; background: {AMBER}; color: {DARK}; font-weight: 700; font-size: 13.5px; line-height: 28px; letter-spacing: .02em; }}
h1 {{ position: absolute; left: 50px; top: 70px; font-family: Caladea, Cambria, serif; font-weight: 700; font-size: 41px; color: {DARK}; letter-spacing: -.005em; }}
.foot {{ position: absolute; left: 50px; top: 535px; font-size: 12.5px; color: {MUTED}; }}
.num {{ position: absolute; right: 60px; top: 535px; font-size: 12.5px; color: {MUTED}; }}
.card {{ position: absolute; background: #fff; border-radius: 8px; padding: 14px 18px; box-shadow: 0 1px 4px rgba(11,60,73,.12); }}
.card h3 {{ font-size: 19.5px; font-weight: 700; color: {DARK}; margin-bottom: 6px; line-height: 1.2; }}
.card p {{ font-size: 17.5px; line-height: 1.38; }}
.card ul {{ list-style: none; }}
.card li {{ position: relative; padding-left: 38px; font-size: 17.5px; line-height: 1.38; margin-bottom: 6px; }}
.card li::before {{ content: "•"; position: absolute; left: 6px; }}
.card.dark {{ background: {DARK}; color: #fff; box-shadow: none; }}
.card.dark h3 {{ color: {AMBER}; }}
.note {{ position: absolute; left: 50px; width: 905px; font-size: 17.5px; line-height: 1.38; }}
.stat {{ position: absolute; top: 150px; width: 216px; height: 156px; background: {DARK}; border-radius: 8px; text-align: center; color: #fff; }}
.stat b {{ display: block; margin-top: 30px; font-size: 39px; color: {AMBER}; }}
.stat span {{ display: block; margin-top: 18px; font-size: 18.5px; }}
.tl-line {{ position: absolute; left: 132px; top: 178px; width: 690px; height: 1.5px; background: {DARK}; }}
.tl-dot, .dot {{ width: 54px; height: 54px; border-radius: 50%; background: {AMBER}; color: {INK}; font-weight: 700; font-size: 19px; display: flex; align-items: center; justify-content: center; }}
.tl-dot {{ position: absolute; top: 151px; }}
.card.tl .date {{ font-size: 22px; font-weight: 700; color: {RED}; margin-bottom: 4px; }}
.card.tl h3 {{ margin-bottom: 4px; }}
.podium {{ position: absolute; background: #fff; border-radius: 8px; text-align: center; box-shadow: 0 1px 4px rgba(11,60,73,.12); }}
.podium .pos {{ font-size: 34px; font-weight: 700; color: {DARK}; margin-top: 30px; }}
.podium .amt {{ font-size: 33px; font-weight: 700; color: {RED}; margin-top: 18px; }}
.podium.first {{ background: {DARK}; }}
.podium.first .pos {{ color: {AMBER}; }}
.podium.first .amt {{ color: #fff; font-size: 31px; }}
.band {{ position: absolute; top: 145px; width: 290px; height: 80px; background: {DARK}; border-radius: 8px; color: #fff; font-size: 18.5px; display: flex; align-items: center; justify-content: center; }}
.band b {{ color: {AMBER}; font-size: 23px; }}
.card.step {{ display: flex; align-items: center; gap: 16px; }}
.card.step .dot {{ flex: 0 0 auto; }}
.card.step p {{ font-size: 17.5px; }}
.card.step.light {{ padding: 6px 14px; }}
.card.step.light .dot {{ width: 40px; height: 40px; font-size: 17px; }}
.card.fee .big {{ font-size: 50px; font-weight: 700; color: {AMBER}; line-height: 1.05; }}
.card.fee .lede {{ margin: 6px 0 14px; }}
.card.fee p {{ margin-top: 10px; }}
.tbl {{ position: absolute; left: 50px; top: 145px; width: 790px; border-collapse: collapse; font-size: 17.5px; }}
.tbl th {{ background: {DARK}; color: #fff; text-align: left; padding: 7px 10px; font-weight: 700; }}
.tbl td {{ padding: 7px 10px; border: 1px solid #d5dfe2; }}
.tbl tr:nth-child(odd) td {{ background: #eef3f4; }}
.tbl tr:nth-child(even) td {{ background: #fff; }}
.tbl td:first-child {{ width: 270px; }}
.card.dom {{ width: 170px; height: 150px; padding: 12px; }}
.card.dom .dot {{ width: 38px; height: 38px; font-size: 18px; margin-bottom: 6px; }}
.card.dom h3 {{ font-size: 18px; margin-bottom: 2px; }}
.card.dom p {{ font-size: 13.5px; color: {MUTED}; line-height: 1.3; }}
.card.flow {{ top: 370px; width: 165px; height: 110px; text-align: center; padding-top: 38px; font-size: 17.5px; color: {DARK}; overflow: visible; }}
.card.flow .dot {{ position: absolute; left: 61px; top: -21px; width: 42px; height: 42px; font-size: 18px; }}
.cover {{ background: {DARK}; }}
.cover .circle {{ position: absolute; border-radius: 50%; }}
.cover .teal {{ left: 720px; top: -110px; width: 440px; height: 440px; background: {TEAL}; }}
.cover .amber {{ left: 800px; top: 280px; width: 400px; height: 400px; background: {AMBER}; }}
.kicker {{ position: absolute; left: 70px; top: 110px; color: {TEAL}; font-weight: 700; font-size: 18px; letter-spacing: .25em; }}
.h-cover {{ position: absolute; left: 70px; top: 178px; font-family: Caladea, Cambria, serif; font-weight: 700; font-size: 58px; color: #fff; }}
.h-cover-big {{ position: absolute; left: 70px; top: 178px; font-family: Caladea, Cambria, serif; font-weight: 700; font-size: 56px; color: #fff; }}
.cover-sub {{ position: absolute; left: 70px; top: 272px; font-size: 26px; color: {AMBER}; }}
.cover-line {{ position: absolute; left: 70px; top: 448px; font-size: 19px; color: #fff; }}
.cover-line.amberline {{ color: {AMBER}; font-weight: 700; font-size: 17px; top: 470px; }}
.revised {{ position: absolute; left: 70px; top: 486px; font-size: 14px; color: #9fc3c9; }}
.cover-body {{ position: absolute; left: 70px; top: 365px; width: 640px; font-size: 19px; line-height: 1.45; color: #fff; }}
"""

html = "<!doctype html><html><head><meta charset='utf-8'><title>CoU AI Hackathon 2026 - Official Rule Book</title><style>" + css + "</style></head><body>" + "".join(f'<div class="sheet">{s}</div>' for s in slides) + "</body></html>"
open(__file__.replace("build.py", "rulebook.html"), "w").write(html)
print(f"{len(slides)} slides written")
