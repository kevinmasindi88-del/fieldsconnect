import { PolicyDocument, type PolicySection } from "@/components/legal/PolicyDocument";

const sections: readonly PolicySection[] = [
  {
    id:"purpose", heading:"Our community standard",
    paragraphs:[
      "FieldsConnect connects people to learning, mentorship, skills, knowledge, professional relationships and opportunities. Community Guidelines apply to all members, mentors, mentees, institutional accounts, posts, comments, messages, files, reviews and interactions associated with the platform.",
      "We aim for a community that is welcoming to learners and professionals while upholding safety, honesty, respect and responsible participation. These Guidelines supplement our Terms of Use and Privacy Policy."
    ]
  },
  {
    id:"respect", heading:"Respect, dignity and constructive engagement",
    paragraphs:[
      "Treat people with dignity even when their educational experience, views, qualifications or career goals differ from yours. Disagreement and constructive criticism are permitted; personal abuse, threats and repeated unwanted contact are not.",
      "Harassment, bullying, stalking, intimidation, coordinated abuse, humiliation and targeting a person's protected or personal characteristics are prohibited."
    ]
  },
  {
    id:"fair-treatment", heading:"Discrimination and hate",
    paragraphs:[
      "Do not attack, threaten, dehumanise or encourage hatred or discrimination based on race, ethnicity, nationality, religion, sex, gender, disability, age, sexual orientation or another protected characteristic.",
      "A debate about institutions or professional practices is not automatically discriminatory; moderators consider the actual language, context, risk and behaviour."
    ]
  },
  {
    id:"child-safety", heading:"Young learners and child protection",
    paragraphs:[
      "Any communication with a child must be appropriate to an educational or professional purpose, respectful of the child's age, and consistent with applicable guardian, institutional and platform rules. Adults must not exploit their position, solicit romantic or sexual engagement with minors, request intimate images, groom learners, or use mentorship to gain inappropriate personal control.",
      "Do not pressure children to share their school timetable, live location, home address, personal number, family details, identity documents, bank information or other unnecessary sensitive information. Do not persuade a young learner to bypass guardian or school involvement or move communications off-platform to avoid scrutiny.",
      "Report suspected grooming, exploitation or unsafe contact promptly. FieldsConnect may restrict access, preserve relevant evidence and involve appropriate authorities where lawful or required. A policy checkbox does not by itself verify legal guardian permission."
    ]
  },
  {
    id:"identity", heading:"Truthful identity and representation",
    paragraphs:[
      "Use authentic, accurate account information. Do not impersonate individuals, lecturers, institutions, employers, companies or professional bodies. Do not misrepresent credentials, licences, academic achievements, mentor availability, employment offers or funding opportunities.",
      "Do not create false accounts to manipulate ratings, gain prohibited access, evade suspensions, deceive younger users or conduct fraudulent transactions."
    ]
  },
  {
    id:"mentorship", heading:"Safe and ethical mentorship",
    paragraphs:[
      "Mentors must set realistic boundaries, accurately describe the expertise they can offer, honour agreed commitments where reasonably possible, and communicate respectfully. Mentees should explain their objectives honestly, respect the mentor's time and avoid repeated demands for unavailable services.",
      "Mentorship is not permission for coercion, conflicts of interest, exploitative relationships, confidential-data collection, unauthorised paid solicitation or guaranteed-result advertising. High-stakes professional advice must stay within the provider's applicable qualification and licensing boundaries."
    ]
  },
  {
    id:"financial-safety", heading:"Payments, scams and financial pressure",
    paragraphs:[
      "Do not request money, bank login credentials, PINs, OTPs or card details by private message or through profile posts. Do not claim that an unverified transfer will activate a FieldsConnect mentorship. Approved paid transactions must use the platform's official checkout when the payment system is live.",
      "Investment scams, fraudulent sponsorships, fabricated jobs, fake scholarships, deceptive referrals, fake payment confirmations, chargeback abuse and coercive fee demands are prohibited.",
      "Paid mentorship is not live merely because a mentor has configured a draft price. Users must not solicit payments in circumvention of the platform's applicable arrangements."
    ]
  },
  {
    id:"privacy", heading:"Privacy, consent and confidentiality",
    paragraphs:[
      "Respect personal boundaries, account visibility settings and the confidentiality of mentorship and workplace information. Do not publish another person's address, ID number, contact details, medical information, financial records, private messages or academic records without lawful authority.",
      "Screenshots, recordings, meeting content and uploaded files must not be shared beyond their authorised audience. Any access granted to you as a mentor, mentee, connection or moderator is limited to its legitimate purpose."
    ]
  },
  {
    id:"content", heading:"Posts, images, messages and resources",
    paragraphs:[
      "Do not post threats, graphic abuse, explicit sexual content, exploitation, malware, phishing links, scams or instructions to commit unlawful acts. Copyright infringement, plagiarism, fabricated research results and deliberate misinformation about professional credentials or institutional outcomes are also prohibited.",
      "Images and avatar uploads must comply with the privacy and dignity of any depicted person. Content involving children receives heightened scrutiny. Educational discussion may cover difficult topics when lawful, relevant and handled responsibly."
    ]
  },
  {
    id:"skills", heading:"Credentials, ratings and endorsements",
    paragraphs:[
      "Skill descriptions, qualifications, mentor reviews and public ratings must reflect genuine experience. Users must not coordinate false reviews, offer rewards for positive ratings, threaten users over feedback or suppress reports of professional misconduct.",
      "Ratings and private review comments are different kinds of information; do not publish a reviewer's identity or written feedback without the relevant publication permission."
    ]
  },
  {
    id:"spam", heading:"Unwanted contact and platform abuse",
    paragraphs:[
      "Mass unsolicited messages, repeated recruitment spam, irrelevant advertisements, affiliate schemes, aggressive commercial solicitation, automated account creation and manipulation of engagement or connection metrics are prohibited.",
      "Do not harvest user data, scrape profiles contrary to the Terms, bypass platform limits, probe private systems without authorisation, exploit security weaknesses or evade moderation sanctions."
    ]
  },
  {
    id:"professional-boundaries", heading:"Educational, institutional and workplace responsibilities",
    paragraphs:[
      "Respect your institution's examination, plagiarism, intellectual-property, research ethics, workplace and confidentiality rules. Do not upload confidential client files, unpublished research or proprietary manufacturing and business information without authority.",
      "Do not represent FieldsConnect as formally affiliated with a school, university, employer or regulator unless that relationship is expressly authorised."
    ]
  },
  {
    id:"report", heading:"How to report a concern",
    paragraphs:[
      "Use the relevant report feature or the in-app Feedback centre to describe what happened and, where possible, identify the relevant account, post, message, mentorship or resource. Avoid submitting unnecessary third-party personal information or publishing allegations to the community instead of using reporting channels.",
      "For urgent threats or suspected crimes, contact appropriate local emergency, law-enforcement or child-protection services as necessary; in-app reporting is not an emergency response service."
    ]
  },
  {
    id:"investigations", heading:"Fair moderation and evidence",
    paragraphs:[
      "Moderators assess reports on their available evidence, severity, likelihood of harm, prior conduct and applicable law. A report alone does not prove misconduct. Relevant evidence should be viewed only by authorised personnel and handled confidentially.",
      "Moderators must record material decisions, avoid conflicts of interest, protect reporters where feasible and offer proportionate appeal or escalation routes for consequential actions. Knowingly false, malicious or retaliatory reporting is itself prohibited."
    ]
  },
  {
    id:"outcomes", heading:"Possible moderation outcomes",
    paragraphs:[
      "Outcomes may include no action, guidance, warnings, content removal, redaction, profile-image removal, feature restrictions, temporary suspensions or permanent account termination. The existing moderation workflow may use defined 12-day or 30-day suspensions and temporary protective restrictions pending review.",
      "Serious cases involving exploitation, credible threats, fraud or repeated abuse can result in immediate restrictions, even while a review is pending. Where needed, FieldsConnect may retain relevant evidence for a lawful investigation or statutory duty."
    ]
  },
  {
    id:"appeals", heading:"Questions, appeals and accountability",
    paragraphs:[
      "Affected users may ask for a moderation decision to be reviewed through available appeal or support channels. Reviews should be handled impartially and, where feasible, by someone other than the original decision-maker. Abuse of the appeals or reports process can also be moderated.",
      "Moderation messages may be issued through a shared platform moderator identity while individual moderator actions remain internally attributable for audit where the system supports this."
    ]
  },
  {
    id:"change", heading:"Updates and relationship to other policies",
    paragraphs:[
      "These Guidelines may evolve as new safety tools, community features, institutional partnerships and legal obligations arise. Material amendments will be disclosed appropriately. They should be read alongside the Terms of Use and Privacy Policy.",
      "Nothing in these Guidelines removes legal privacy rights, mandatory consumer protections, or reporting obligations under applicable law."
    ]
  },
];

export default function CommunityGuidelinesPage() {
  return (
    <PolicyDocument
      title="Community Guidelines"
      version="2026-10-24-v1"
      summary="Standards for respectful discussion, trustworthy mentorship, child safety, confidentiality, reporting and fair moderation."
      sections={sections}
      footer={<p>To report content or conduct, use the relevant in-app report action or the <a className="font-semibold text-blue-700 underline" href="/feedback">Feedback centre</a>. Urgent safety emergencies require appropriate local emergency services.</p>}
    />
  );
}
