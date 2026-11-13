/**
 * Editorial copy for the public site. Facts (dates, fee, numbers) are passed in
 * from settings so the pages stay correct when an admin changes them.
 */
export const WHY = [
  { title: "Ship something real", body: "Three days to build after the shortlist, then a five-hour on-site final to finish and present. You leave with a project, not a slide." },
  { title: "Be judged on the idea first", body: "Phase 1 is free. Every team is scored on the strength of its idea before anyone pays anything." },
  { title: "Build with people from anywhere", body: "Teams can mix universities. Bring a friend from another campus, or come alone." },
  { title: "Compete for BDT 25,000", body: "Three prizes, one stage, and an audience of faculty, sponsors and fellow builders." },
  { title: "Learn from mentors", body: "Mentors circulate during the build. Use them to unblock a model, a dataset or a pitch." },
  { title: "Start something that continues", body: "The best hackathon projects become final-year theses, startups and open-source tools." },
];

export const RULES = [
  {
    title: "Eligibility and teams",
    items: [
      "The hackathon is open to current university students. Every participant must hold a valid student ID.",
      "You may take part alone or in a team of two or three. Three is the maximum.",
      "Team members may come from different universities.",
      "A person may belong to only one team. One email address and one student ID can be registered once.",
    ],
  },
  {
    title: "Phase 1: idea submission",
    items: [
      "Phase 1 is free. Submit your team details, each member's student ID card image and your idea document (PDF or DOCX).",
      "Ideas are scored out of 100: problem relevance 20, innovation 25, AI application 25, feasibility 15, potential impact 15.",
      "The top 30 teams are shortlisted for the on-site round. Results are sent by email to every team member.",
      "A registration cannot be edited after it is submitted. Check the review step carefully.",
    ],
  },
  {
    title: "Phase 2: pre-build and confirmation (21 – 23 November)",
    items: [
      "Once the shortlist is published, selected teams may start building their project. 21 – 23 November is the pre-build period.",
      "Project code may be written only from 21 November. Before that, only research, planning, design and dataset preparation are allowed.",
      "Shortlisted teams confirm their place by paying the team fee through bKash or Nagad Send Money and submitting the transaction ID on this website.",
      "The fee is per team, not per person.",
      "Payments are verified by hand by the organisers. A place is confirmed only when you receive the confirmation email.",
      "Only send money to the numbers shown on this website's payment page.",
      "A team that has not paid by 23 November loses its seat, even if it has started building.",
    ],
  },
  {
    title: "Final day (24 November)",
    items: [
      "The on-site final lasts five hours: finish the project you started in the pre-build, submit it and present it to the judges.",
      "Your solution must make meaningful use of artificial intelligence.",
      "You may use open-source libraries, public datasets, pretrained models and AI coding assistants. Credit what you use.",
      "Bring your own laptop and chargers. Bring your student ID card for check-in.",
      "Projects must be your own work, started on or after 21 November. Reusing an earlier project, plagiarism or outside help leads to disqualification.",
    ],
  },
  {
    title: "Conduct and decisions",
    items: [
      "Treat participants, mentors, volunteers and judges with respect. Harassment of any kind is not tolerated.",
      "The judges' decisions are final.",
      "The organisers may disqualify a team that breaks these rules or provides false information.",
    ],
  },
];

export const faq = (v: { fee: number; announcement: string }) => [
  { q: "Who can take part?", a: "Any current university student with a valid student ID. Teams can mix universities." },
  { q: "How big can a team be?", a: "One, two or three people. You can take part alone." },
  { q: "Does it cost anything to register?", a: `Phase 1 is free. Only the 30 shortlisted teams pay, and the fee is BDT ${v.fee.toLocaleString("en-US")} per team, not per person.` },
  { q: "What do I need to register?", a: "For every member: name, email, phone and WhatsApp numbers, university, student ID, T-shirt size and a photo of the student ID card. For the team: an idea title, short written answers and one idea document in PDF or DOCX." },
  { q: "How are teams selected?", a: "Reviewers score each idea out of 100 on problem relevance, innovation, AI application, feasibility and potential impact. The top 30 are shortlisted." },
  { q: "When will I hear back?", a: `Selection results are emailed to every team member on ${v.announcement}. You can also check your status on this website.` },
  { q: "When can we start building?", a: "From 21 November, once your team is on the published shortlist. 21 – 23 November is the pre-build period, and the five-hour on-site final on 24 November is for finishing, submitting and presenting. Before 21 November, only research, planning and design are allowed." },
  { q: "How do I pay if we are shortlisted?", a: "Send the team fee by bKash or Nagad Send Money to the number on the payment page, then submit the transaction ID through your status page. An organiser verifies it by hand and you receive a confirmation email." },
  { q: "Can I change my registration after submitting?", a: "No. Review everything on the last step before you submit. If something is seriously wrong, contact the organisers." },
  { q: "Can we use AI tools and pretrained models?", a: "Yes. Open-source libraries, public datasets, pretrained models and coding assistants are allowed. Project code may be written from 21 November (the pre-build period) until the end of the five-hour final, and you should credit what you use." },
  { q: "What should I bring?", a: "Your laptop, chargers and your student ID card." },
  { q: "Where are the full rules?", a: "The official rule book is a PDF linked on the Rules page and in the footer. If anything on this website and the rule book differ, ask the helpline." },
  { q: "Who can I call for help?", a: "Call or WhatsApp any number in the Helpline section on the home page or the Contact page." },
  { q: "I lost my registration ID. What now?", a: "It is in your confirmation email, along with a personal link to your status page. Search your inbox and spam folder for “CoU AI Hackathon”." },
];

/** Official rule book (PDF on Google Drive). */
export const RULEBOOK_URL = "https://drive.google.com/file/d/18jOb_YtET5U4La5vQ924Ajes-Z_f-B0p/view?usp=sharing";

/** Helpline for participant questions. Numbers in international format. */
export const HELPLINE = [
  { name: "Mahtab Mahi", phone: "+8801875445951" },
  { name: "Rafiq", phone: "+8801886845488" },
  { name: "Rafi", phone: "+8801644237845" },
  { name: "Emon", phone: "+8801867164146" },
  { name: "Mehedi", phone: "+8801752166856" },
  { name: "Tareq", phone: "+8801793165308" },
  { name: "Rifat", phone: "+8801642532704" },
];

/** Helpline email, shown with the helpline numbers. */
export const HELPLINE_EMAIL = "coutechnova2026@gmail.com";

/** +8801875445951 -> +880 1875-445951 */
export const formatPhone = (p: string) => p.replace(/^\+880(\d{4})(\d{6})$/, "+880 $1-$2");
