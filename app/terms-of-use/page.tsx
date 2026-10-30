import { PolicyDocument, type PolicySection } from "@/components/legal/PolicyDocument";

const sections: readonly PolicySection[] = [
  {
    id:"scope", heading:"About FieldsConnect and these terms",
    paragraphs:[
      "These Terms of Use govern access to and use of FieldsConnect, a platform for educational and professional connections, mentorship, community discussion, skills, shared resources and related services. References to “FieldsConnect”, “we”, “us” or “our” mean the South African registered business operating the platform. “User” includes visitors, account holders, mentors, mentees and institutional users.",
      "The Terms, Privacy Policy and Community Guidelines operate together. Additional terms may apply to optional paid mentorship, sponsorship or other future services, and must be shown before the relevant transaction. If a mandatory consumer or privacy law gives you greater protection, that law prevails.",
    ]
  },
  {
    id:"acceptance", heading:"Acceptance, records and updates",
    paragraphs:[
      "By selecting the registration agreement and creating an account, you accept these Terms of Use and our Community Guidelines, and you can review our Privacy Policy through the same sign-up disclosure. FieldsConnect records the version and time of acceptance to maintain an accurate account history. Additional permissions required by law are handled separately.",
      "We may change these policies to reflect material changes in features, law or safeguards. Material changes will be communicated through a reasonable in-app or account notice and may require renewed acceptance. Changes do not retroactively remove statutory rights.",
    ]
  },
  {
    id:"eligibility", heading:"Eligibility, age and necessary consent",
    paragraphs:[
      "FieldsConnect is intended to support learners, university students, mentors and professionals. Participation is subject to applicable legal capacity, permissions and safeguarding requirements, which may vary by age.",
      "You must supply accurate information and have the legal authority and permissions necessary for your participation. For a person under 18, FieldsConnect may require prior consent from a legally competent parent or guardian, or another lawful basis permitted by applicable legislation, before the person's information may be processed or participation enabled. A minor's own tick-box acceptance does not replace legally required consent.",
      "Where legal permission or additional protections are required, FieldsConnect may limit access to relevant features until those requirements are met. Parents, guardians, schools and institutions do not gain access to private user information merely by claiming a relationship; requests are verified and assessed under applicable law."
    ]
  },
  {
    id:"accounts", heading:"Registration and account security",
    paragraphs:[
      "Provide accurate registration and profile details and keep them reasonably current. You must not impersonate another person or institution, misstate qualifications, create deceptive identities or share access in ways that undermine account security.",
      "Keep credentials confidential and notify FieldsConnect through in-app support if you suspect account compromise. We may ask for reasonable verification in connection with safety, suspected fraud, access restoration or statutory duties. Verification of an email address does not constitute verification of professional qualifications or institutional affiliation."
    ]
  },
  {
    id:"profile", heading:"Profile information and visibility",
    paragraphs:[
      "Profiles may include a name, username, educational or professional category, field, bio, avatar, skills and mentorship preferences. Visibility controls and specific sharing choices determine whether available information is shown publicly, to connections or privately. Do not enter information that you are not entitled to publish, including confidential employer material, third-party personal information or sensitive information about children.",
      "You are responsible for profile accuracy and the lawful publication of documents or images you upload. FieldsConnect may remove or restrict profile details that violate law, intellectual-property rights or the Community Guidelines."
    ]
  },
  {
    id:"connections", heading:"Connections, posts and messages",
    paragraphs:[
      "FieldsConnect provides networking features such as connection requests, posts, comments, reactions, notifications and direct messages. Do not assume that a connection, response or profile listing constitutes an endorsement, a credential check or a promise of mentoring.",
      "Communicate respectfully and observe the recipient's boundaries. Messages and connection activity may be assessed by authorised moderation personnel where properly reported, lawfully required or necessary to investigate a safety incident, subject to role-based access and applicable privacy rules."
    ]
  },
  {
    id:"mentors", heading:"Mentors, mentees and mentorship arrangements",
    paragraphs:[
      "Mentors decide which supported fields, levels, capacity, frequency and programmes they offer. Mentees are responsible for stating their goals honestly and respecting agreed session boundaries. Mentorship requests, counterproposals, acceptance, milestones and completion follow the workflow presented in FieldsConnect.",
      "A mentor is not automatically an employee, partner, accredited educator or professional adviser of FieldsConnect. Users must verify any credentials or approvals necessary for high-stakes educational, financial, legal, healthcare or employment decisions. Mentors must not promise admission, employment, professional licensing, funding or guaranteed outcomes.",
      "Mentorships involving learners who are children may require guardian or institutional participation, supervision and appropriately restricted communications. A mentor must not bypass such arrangements or seek private off-platform contact where it creates a safety risk."
    ]
  },
  {
    id:"reviews", heading:"Ratings, reviews and endorsements",
    paragraphs:[
      "Ratings are associated with relevant mentorship events where the application provides for verified feedback. Star scores and aggregate ratings may be displayed independently of permission to publish written comments. A mentee's written feedback or name is published only in accordance with the publication choice presented for that review.",
      "Ratings must be genuine and may not be bought, coerced, fabricated or manipulated. We may investigate, moderate or remove fraudulent or prohibited review content in accordance with our reporting process."
    ]
  },
  {
    id:"user-content", heading:"Ownership and permitted use of user content",
    paragraphs:[
      "You retain rights in original content that you lawfully own. By submitting content, you grant FieldsConnect a non-exclusive, worldwide, royalty-free licence, limited to what is reasonably necessary to store, reproduce, display, transmit, secure, moderate and deliver it within the platform in line with your chosen sharing settings. This licence ends when content is deleted except where retention is legally required or copies remain in lawful backups, audit records or already-authorised sharing.",
      "You confirm that you have the right to upload content, that it does not infringe intellectual-property, privacy or confidentiality obligations, and that publication will not unlawfully disclose third-party information."
    ]
  },
  {
    id:"library", heading:"Library, shared resources and intellectual property",
    paragraphs:[
      "Users may store or share resources subject to supported size limits, permissions and library-specific terms. A shared resource remains subject to the uploader's rights and the recipient's authorised scope of use. No transfer of ownership occurs merely because a resource is visible or downloadable.",
      "Do not upload copyright-infringing, plagiarised, deceptive, malicious or confidential materials without permission. Where relevant, users must comply with institutional and employer obligations, research ethics and any signed non-disclosure agreement."
    ]
  },
  {
    id:"conduct", heading:"Community safety and prohibited behaviour",
    paragraphs:[
      "All participation must comply with the Community Guidelines. We prohibit harassment, hate, threats, exploitation, grooming, impersonation, scams, unauthorised data disclosure, spam, credential harvesting, malicious code, unlawful solicitation and efforts to evade platform safeguards.",
      "In particular, exploitation of children, sexual solicitation of minors, attempts to move a learner into unsafe private communication, or requests for unnecessary sensitive information are prohibited. Urgent safety concerns may require immediate restrictions, evidence preservation and referral to appropriate authorities."
    ]
  },
  {
    id:"content-moderation", heading:"Moderation, reporting and appeals",
    paragraphs:[
      "You may report profiles, posts, messages, reviews or shared resources through available platform reporting channels. A report is assessed; it is not proof of wrongdoing. Depending on the evidence and risk, we may dismiss it, issue guidance or warnings, redact or remove content, restrict features, temporarily suspend access or terminate an account.",
      "Moderation decisions consider the circumstances and seriousness of a report. Users may raise concerns about a decision through the available support or review channels. Retaliation against people reporting in good faith is prohibited. FieldsConnect may preserve records reasonably needed for investigations, legal claims or statutory duties."
    ]
  },
  {
    id:"optional-paid-services", heading:"Paid mentorship option coming soon",
    paragraphs:[]
  },
  {
    id:"third-parties", heading:"Third-party sites and services",
    paragraphs:[
      "FieldsConnect relies on external service providers for infrastructure, account management and some optional features. Links to third-party websites and services do not amount to an endorsement or guarantee of their accuracy, safety or availability. Separate third-party terms may apply where clearly presented.",
      "When interacting with another user's off-platform site, external service or organisation, apply independent judgment and do not share credentials or personal information without understanding why it is needed."
    ]
  },
  {
    id:"availability", heading:"Service changes, suspension and continuity",
    paragraphs:[
      "We work to maintain a safe and reliable service, but technical outages, maintenance, security incidents and feature changes may occur. We may modify or suspend a feature where reasonably needed to protect users, comply with law, respond to service limitations or improve the platform.",
      "We may suspend an account for violations, suspected compromise, unsafe contact involving minors, payment-related risk or lawful requests. We will apply fair review and reasonable communication where appropriate, except where urgent action or law prevents advance notice."
    ]
  },
  {
    id:"no-guarantees", heading:"User decisions and absence of guaranteed outcomes",
    paragraphs:[
      "Profiles, posts, reviews, learning resources and mentorship discussions are predominantly user-generated. FieldsConnect does not guarantee the identity, qualifications, advice, employability, funding, admission, academic results or conduct of any user. Users must exercise reasonable care and seek accredited professional advice when necessary.",
      "Nothing in these Terms excludes rights or remedies that cannot lawfully be excluded under South African law."
    ]
  },
  {
    id:"liability", heading:"Liability and consumer rights",
    paragraphs:[
      "To the extent permitted by applicable law, FieldsConnect is not liable for losses caused solely by inaccurate user-created material, unauthorised dealings outside the platform or circumstances outside its reasonable control. This does not exclude liability that cannot legally be limited, including responsibilities arising from unlawful processing of personal information, negligence where exclusion is prohibited, or other mandatory consumer protections.",
      "Users are responsible for unlawful content or conduct attributable to them, including infringements of intellectual-property rights and breaches of confidentiality, subject to applicable law."
    ]
  },
  {
    id:"deactivation", heading:"Account closure and retained records",
    paragraphs:[
      "You may request account closure or deletion through FieldsConnect's available account-support channels. Removing an account does not automatically cancel completed transactions, retract lawfully published records already shared with others or eliminate legal obligations.",
      "Some information may be retained for tax, fraud prevention, accounting, moderation evidence, dispute resolution or other lawful purposes, subject to POPIA's limitations and the Privacy Policy. We restrict access to retained records and delete or de-identify information when continued retention is no longer lawful or necessary."
    ]
  },
  {
    id:"law", heading:"Applicable law and resolving disagreements",
    paragraphs:[
      "These Terms are governed by the laws of the Republic of South Africa, subject to any overriding mandatory rights. Before commencing formal proceedings, users may submit a support request and provide sufficient detail to allow an appropriate response. This does not remove a right to approach a regulator, consumer body, court or other competent authority.",
      "If a clause is invalid or unenforceable, the remaining provisions continue to apply where legally possible. Failure to enforce one breach does not mean future breaches must be accepted."
    ]
  },
  {
    id:"contact", heading:"Contact and legal notices",
    paragraphs:[
      "For account assistance, policy questions, mentorship disputes or community-safety concerns, use FieldsConnect's Feedback and support facility. Privacy requests may be directed to the privacy or Information Officer function through the same support channel."
    ]
  },
];

export default function TermsOfUsePage() {
  return (
    <PolicyDocument
      title="Terms of Use"
      version="2026-10-24-v1"
      summary="The rules governing registration, community participation, mentorship, content, paid services, dispute resolution and accountability on FieldsConnect."
      sections={sections}
      footer={<p>Need help or want to report a concern? Signed-in members can contact FieldsConnect through the <a className="font-semibold text-blue-700 underline" href="/feedback">Feedback centre</a>.</p>}
    />
  );
}
